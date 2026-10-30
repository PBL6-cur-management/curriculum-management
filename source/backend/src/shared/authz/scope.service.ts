import { Injectable } from '@nestjs/common';
import {
  OrgUnitStatus,
  ScopeSource,
  ScopeType,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { todayDate } from '../time/today.js';
import { coversDay } from '../time/validity.js';
import {
  AccessContext,
  type ActiveAssignment,
  EMPTY_SCOPE_IDS,
  type PermissionGrant,
  type ResolvedScope,
  type ScopeTarget,
} from './access-context.js';
import type { PermissionCode } from './permission-codes.js';
import { ScopeSourceReader } from './scope-source.reader.js';

const ROLE_WITH_PERMISSIONS = {
  id: true,
  roleCode: true,
  roleName: true,
  scopeSource: true,
  rolePermissions: {
    select: {
      mode: true,
      scope: true,
      permission: { select: { permissionCode: true } },
    },
  },
} as const;

@Injectable()
export class ScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sources: ScopeSourceReader,
  ) {}

  async loadAccess(userId: string): Promise<AccessContext> {
    const today = todayDate();
    const [manual, derived] = await Promise.all([
      this.loadManualAssignments(userId, today),
      this.loadDerivedAssignments(userId, today),
    ]);
    return new AccessContext(userId, [...manual, ...derived]);
  }

  private async loadManualAssignments(
    userId: string,
    today: Date,
  ): Promise<ActiveAssignment[]> {
    const rows = await this.prisma.roleAssignment.findMany({
      where: {
        userId,
        revokedAt: null,
        ...coversDay(today),
      },
      select: {
        id: true,
        scopeType: true,
        scopeUnit: { select: { id: true, unitCode: true, unitName: true } },
        role: { select: ROLE_WITH_PERMISSIONS },
      },
    });
    const needsTree = rows.some((row) => row.scopeType === ScopeType.UNIT);
    const children = needsTree
      ? await this.loadChildrenByParent()
      : new Map<string, string[]>();
    return rows.map((row) => ({
      assignmentId: row.id,
      roleId: row.role.id,
      roleCode: row.role.roleCode,
      roleName: row.role.roleName,
      scopeSource: row.role.scopeSource,
      scopeType: row.scopeType,
      scopeUnit: row.scopeUnit,
      // A self-scoped role (R6) reaches its own record only through the derived assignment; an explicit
      // assignment, whatever its scope type, must not widen SCOPED staff reads to everything (F-20 BE-06).
      scope:
        row.role.scopeSource === ScopeSource.OWN_ENROLLMENT
          ? unitScope([])
          : row.scopeType === ScopeType.SYSTEM
            ? { all: true }
            : unitScope(
                row.scopeUnit
                  ? descendantsAndSelf(row.scopeUnit.id, children)
                  : [],
              ),
      permissions: toGrantMap(row.role.rolePermissions),
    }));
  }

  private async loadDerivedAssignments(
    userId: string,
    today: Date,
  ): Promise<ActiveAssignment[]> {
    const roles = await this.prisma.role.findMany({
      where: { scopeSource: { not: ScopeSource.NONE } },
      select: ROLE_WITH_PERMISSIONS,
    });
    const assignments: ActiveAssignment[] = [];
    for (const role of roles) {
      const target = await this.sources.activeTargets(
        role.scopeSource as Exclude<ScopeSource, 'NONE'>,
        userId,
        today,
      );
      const scope = targetScope(target);
      if (isEmpty(scope)) {
        continue;
      }
      assignments.push({
        assignmentId: null,
        roleId: role.id,
        roleCode: role.roleCode,
        roleName: role.roleName,
        scopeSource: role.scopeSource,
        scopeType: ScopeType.ASSIGNMENT,
        scopeUnit: null,
        scope,
        permissions: toGrantMap(role.rolePermissions),
      });
    }
    return assignments;
  }

  private async loadChildrenByParent(): Promise<Map<string, string[]>> {
    const units = await this.prisma.orgUnit.findMany({
      where: { status: OrgUnitStatus.ACTIVE },
      select: { id: true, parentUnitId: true },
    });
    const children = new Map<string, string[]>();
    for (const unit of units) {
      if (unit.parentUnitId) {
        children.set(unit.parentUnitId, [
          ...(children.get(unit.parentUnitId) ?? []),
          unit.id,
        ]);
      }
    }
    return children;
  }
}

function descendantsAndSelf(
  rootId: string,
  children: Map<string, string[]>,
): string[] {
  const found = [rootId];
  for (let index = 0; index < found.length; index += 1) {
    found.push(...(children.get(found[index]) ?? []));
  }
  return found;
}

function unitScope(orgUnitIds: string[]): ResolvedScope {
  return { ...EMPTY_SCOPE_IDS, all: false, orgUnitIds: new Set(orgUnitIds) };
}

function targetScope(target: ScopeTarget): ResolvedScope {
  return {
    all: false,
    orgUnitIds: new Set(target.orgUnitIds),
    subjectGroupIds: new Set(target.subjectGroupIds),
    programIds: new Set(target.programIds),
    studentIds: new Set(target.studentIds),
  };
}

function isEmpty(scope: ResolvedScope): boolean {
  return (
    !scope.all &&
    scope.orgUnitIds.size +
      scope.subjectGroupIds.size +
      scope.programIds.size +
      scope.studentIds.size ===
      0
  );
}

function toGrantMap(
  rows: {
    mode: PermissionGrant['mode'];
    scope: PermissionGrant['scope'];
    permission: { permissionCode: string };
  }[],
): Map<PermissionCode, PermissionGrant> {
  return new Map(
    rows.map((row) => [
      row.permission.permissionCode as PermissionCode,
      { mode: row.mode, scope: row.scope },
    ]),
  );
}
