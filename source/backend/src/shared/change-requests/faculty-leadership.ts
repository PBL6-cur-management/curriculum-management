import {
  ScopeType,
  UserStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { coversDay } from '../time/validity.js';

// R2 (Ban lãnh đạo khoa) is the role of level-3 approvers; pool per faculty.
export const FACULTY_LEADERSHIP_ROLE_CODE = 'R2';

type Db = PrismaService | Prisma.TransactionClient;

export function activeFacultyLeadershipRoleWhere(today: Date) {
  return {
    revokedAt: null,
    ...coversDay(today),
    role: { roleCode: FACULTY_LEADERSHIP_ROLE_CODE },
    user: { status: UserStatus.ACTIVE },
  } satisfies Prisma.RoleAssignmentWhereInput;
}

export function activeFacultyLeadershipWhere(facultyId: string, today: Date) {
  return {
    ...activeFacultyLeadershipRoleWhere(today),
    OR: [
      { scopeType: ScopeType.SYSTEM },
      { scopeType: ScopeType.UNIT, scopeUnitId: facultyId },
    ],
  } satisfies Prisma.RoleAssignmentWhereInput;
}

export async function isFacultyLeadershipHolder(
  db: Db,
  userId: string,
  facultyId: string,
  today: Date,
): Promise<boolean> {
  const row = await db.roleAssignment.findFirst({
    where: { userId, ...activeFacultyLeadershipWhere(facultyId, today) },
    select: { id: true },
  });
  return row !== null;
}

export async function facultyLeadershipScope(
  db: Db,
  userId: string,
  today: Date,
): Promise<{ all: boolean; facultyIds: string[] }> {
  const rows = await db.roleAssignment.findMany({
    where: { userId, ...activeFacultyLeadershipRoleWhere(today) },
    select: { scopeType: true, scopeUnitId: true },
  });
  if (rows.some((row) => row.scopeType === ScopeType.SYSTEM)) {
    return { all: true, facultyIds: [] };
  }
  const facultyIds = [
    ...new Set(
      rows.flatMap((row) =>
        row.scopeType === ScopeType.UNIT && row.scopeUnitId
          ? [row.scopeUnitId]
          : [],
      ),
    ),
  ];
  return { all: false, facultyIds };
}

export async function hasFacultyLeadershipHolder(
  db: Db,
  facultyId: string,
  today: Date,
): Promise<boolean> {
  const row = await db.roleAssignment.findFirst({
    where: activeFacultyLeadershipWhere(facultyId, today),
    select: { id: true },
  });
  return row !== null;
}

export async function otherFacultyLeadershipHolderExists(
  db: Db,
  facultyId: string,
  creatorId: string,
  today: Date,
): Promise<boolean> {
  const row = await db.roleAssignment.findFirst({
    where: {
      userId: { not: creatorId },
      ...activeFacultyLeadershipWhere(facultyId, today),
    },
    select: { id: true },
  });
  return row !== null;
}

export async function facultyLeadershipHolderIds(
  db: Db,
  facultyId: string,
  exceptUserId: string,
  today: Date,
): Promise<string[]> {
  const rows = await db.roleAssignment.findMany({
    where: {
      userId: { not: exceptUserId },
      ...activeFacultyLeadershipWhere(facultyId, today),
    },
    select: { userId: true },
  });
  return [...new Set(rows.map((row) => row.userId))];
}
