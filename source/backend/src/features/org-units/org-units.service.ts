import { Injectable, Logger } from '@nestjs/common';
import {
  OrgUnitStatus,
  OrgUnitType,
  SubjectGroupStatus,
} from '../../generated/prisma/client.js';
import { AppException } from '../../shared/exception/app.exception.js';
import type { ErrorDefinition } from '../../shared/exception/error-definition.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { mapUniqueViolation } from '../../shared/prisma/unique-violation.js';
import {
  CreateOrgUnitDto,
  hasLegacyUnitAbbreviation,
  normalizeUnitName,
} from './create-org-unit.dto.js';
import { OrgUnitQueryDto } from './org-unit-query.dto.js';
import { UpdateOrgUnitDto } from './update-org-unit.dto.js';
import { createsCycle, isAllowedParent } from './org-unit-hierarchy.js';
import { OrgUnitDto, ORG_UNIT_SELECT, toOrgUnitDto } from './org-unit.dto.js';
import { ORG_UNIT_ERRORS } from './org-units.errors.js';

@Injectable()
export class OrgUnitsService {
  private readonly logger = new Logger(OrgUnitsService.name);
  constructor(private readonly prisma: PrismaService) {}

  async list(query?: OrgUnitQueryDto): Promise<OrgUnitDto[]> {
    const rows = await this.prisma.orgUnit.findMany({
      where:
        query?.isExternal !== undefined
          ? { isExternal: query.isExternal }
          : undefined,
      select: ORG_UNIT_SELECT,
      orderBy: { unitName: 'asc' },
    });
    return rows.map(toOrgUnitDto);
  }

  async create(dto: CreateOrgUnitDto, actorId: string): Promise<OrgUnitDto> {
    const parent = await this.findOrThrow(
      dto.parentUnitId,
      ORG_UNIT_ERRORS.PARENT_INVALID,
    );
    assertParentUsable(dto.unitType, parent);
    const unitCode = dto.unitCode.trim().toUpperCase();
    const unitName = normalizeUnitName(dto.unitName);
    if (hasLegacyUnitAbbreviation(unitName)) {
      this.logger.warn(
        `Org unit ${unitCode} uses abbreviated name "${unitName}"; prefer full "Khoa " / "Phòng " prefix`,
      );
    }
    try {
      const row = await this.prisma.orgUnit.create({
        data: {
          unitCode,
          unitName,
          unitType: dto.unitType,
          isExternal: dto.isExternal ?? false,
          parentUnitId: parent.id,
        },
        select: ORG_UNIT_SELECT,
      });
      this.logger.log(`Org unit ${row.unitCode} created by ${actorId}`);
      return toOrgUnitDto(row);
    } catch (error) {
      throw mapUniqueViolation(
        error,
        ORG_UNIT_ERRORS.UNIT_CODE_TAKEN,
        'unitCode',
      );
    }
  }

  async update(
    unitId: string,
    dto: UpdateOrgUnitDto,
    actorId: string,
  ): Promise<OrgUnitDto> {
    const unit = await this.findOrThrow(unitId);
    if (
      dto.parentUnitId !== undefined &&
      dto.parentUnitId !== unit.parentUnitId
    ) {
      if (!unit.parentUnitId)
        throw new AppException(ORG_UNIT_ERRORS.ROOT_UNIT_LOCKED);
      const parent = await this.findOrThrow(
        dto.parentUnitId,
        ORG_UNIT_ERRORS.PARENT_INVALID,
      );
      assertParentUsable(unit.unitType, parent);
      const units = await this.prisma.orgUnit.findMany({
        select: { id: true, parentUnitId: true },
      });
      const parentOf = new Map(
        units.map((item) => [item.id, item.parentUnitId]),
      );
      if (createsCycle(unit.id, parent.id, parentOf))
        throw new AppException(ORG_UNIT_ERRORS.PARENT_CYCLE);
    }
    const unitName =
      dto.unitName !== undefined ? normalizeUnitName(dto.unitName) : undefined;
    if (unitName !== undefined && hasLegacyUnitAbbreviation(unitName)) {
      this.logger.warn(
        `Org unit ${unit.unitCode} updated with abbreviated name "${unitName}"; prefer full "Khoa " / "Phòng " prefix`,
      );
    }
    const row = await this.prisma.orgUnit.update({
      where: { id: unit.id },
      data: {
        unitName,
        isExternal: dto.isExternal,
        parentUnitId: dto.parentUnitId,
      },
      select: ORG_UNIT_SELECT,
    });
    this.logger.log(`Org unit ${row.unitCode} updated by ${actorId}`);
    return toOrgUnitDto(row);
  }

  async deactivate(unitId: string, actorId: string): Promise<OrgUnitDto> {
    const unit = await this.findOrThrow(unitId);
    if (!unit.parentUnitId)
      throw new AppException(ORG_UNIT_ERRORS.ROOT_UNIT_LOCKED);
    if (unit.status === OrgUnitStatus.INACTIVE) return toOrgUnitDto(unit);
    const [children, groups] = await Promise.all([
      this.prisma.orgUnit.count({
        where: { parentUnitId: unit.id, status: OrgUnitStatus.ACTIVE },
      }),
      this.prisma.subjectGroup.count({
        where: { facultyId: unit.id, status: SubjectGroupStatus.ACTIVE },
      }),
    ]);
    if (children > 0)
      throw new AppException(ORG_UNIT_ERRORS.UNIT_HAS_ACTIVE_CHILDREN);
    if (groups > 0)
      throw new AppException(ORG_UNIT_ERRORS.UNIT_HAS_ACTIVE_GROUPS);
    return this.setStatus(unit.id, OrgUnitStatus.INACTIVE, actorId);
  }

  async activate(unitId: string, actorId: string): Promise<OrgUnitDto> {
    const unit = await this.findOrThrow(unitId);
    if (unit.status === OrgUnitStatus.ACTIVE) return toOrgUnitDto(unit);
    const parent = unit.parentUnitId
      ? await this.findOrThrow(unit.parentUnitId)
      : null;
    if (parent && parent.status !== OrgUnitStatus.ACTIVE)
      throw new AppException(ORG_UNIT_ERRORS.PARENT_INACTIVE);
    return this.setStatus(unit.id, OrgUnitStatus.ACTIVE, actorId);
  }

  private async findOrThrow(
    unitId: string,
    error: ErrorDefinition = ORG_UNIT_ERRORS.ORG_UNIT_NOT_FOUND,
  ) {
    const row = await this.prisma.orgUnit.findUnique({
      where: { id: unitId },
      select: ORG_UNIT_SELECT,
    });
    if (!row) throw new AppException(error);
    return row;
  }

  private async setStatus(
    unitId: string,
    status: OrgUnitStatus,
    actorId: string,
  ): Promise<OrgUnitDto> {
    const row = await this.prisma.orgUnit.update({
      where: { id: unitId },
      data: { status },
      select: ORG_UNIT_SELECT,
    });
    this.logger.log(
      `Org unit ${row.unitCode} status set to ${status} by ${actorId}`,
    );
    return toOrgUnitDto(row);
  }
}

function assertParentUsable(
  childType: OrgUnitType,
  parent: { unitType: OrgUnitType; status: OrgUnitStatus },
): void {
  if (!isAllowedParent(childType, parent.unitType))
    throw new AppException(ORG_UNIT_ERRORS.PARENT_INVALID);
  if (parent.status !== OrgUnitStatus.ACTIVE)
    throw new AppException(ORG_UNIT_ERRORS.PARENT_INACTIVE);
}
