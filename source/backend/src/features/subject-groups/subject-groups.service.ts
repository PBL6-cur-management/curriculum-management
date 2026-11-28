import { Injectable, Logger } from '@nestjs/common';
import {
  CourseStatus,
  OrgUnitStatus,
  OrgUnitType,
  SubjectGroupStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import type {
  AccessContext,
  ResolvedScope,
  ScopeTarget,
} from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { mapUniqueViolation } from '../../shared/prisma/unique-violation.js';
import { todayDate } from '../../shared/time/today.js';
import { CreateSubjectGroupDto } from './create-subject-group.dto.js';
import { SubjectGroupQueryDto } from './subject-group-query.dto.js';
import { UpdateSubjectGroupDto } from './update-subject-group.dto.js';
import {
  MEMBER_SELECT,
  toSubjectGroupMemberDto,
} from './subject-group-member.dto.js';
import {
  SubjectGroupDeactivationImpactDto,
  SubjectGroupDetailDto,
  SubjectGroupSummaryDto,
  summaryInclude,
  toSubjectGroupSummaryDto,
} from './subject-group.dto.js';
import { SUBJECT_GROUP_ERRORS } from './subject-groups.errors.js';

@Injectable()
export class SubjectGroupsService {
  private readonly logger = new Logger(SubjectGroupsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: SubjectGroupQueryDto,
    access: AccessContext,
  ): Promise<SubjectGroupSummaryDto[]> {
    const scope = access.scopeFor(PERMISSIONS.SUBJECT_GROUP_VIEW);
    const rows = await this.prisma.subjectGroup.findMany({
      where: {
        facultyId: query.facultyId,
        status: query.status,
        ...scopeWhere(scope),
      },
      include: summaryInclude(todayDate()),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toSubjectGroupSummaryDto);
  }

  async detail(
    groupId: string,
    access: AccessContext,
  ): Promise<SubjectGroupDetailDto> {
    const today = todayDate();
    const row = await this.findOrThrow(groupId, today);
    access.assertCan(PERMISSIONS.SUBJECT_GROUP_VIEW, groupTarget(row));
    const members = await this.prisma.subjectGroupMember.findMany({
      where: { subjectGroupId: row.id },
      select: MEMBER_SELECT,
      orderBy: [{ memberRole: 'desc' }, { validFrom: 'desc' }],
    });
    return Object.assign(toSubjectGroupSummaryDto(row), {
      members: members.map((member) => toSubjectGroupMemberDto(member, today)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  async create(
    dto: CreateSubjectGroupDto,
    actorId: string,
  ): Promise<SubjectGroupSummaryDto> {
    await this.assertFaculty(dto.facultyId);
    try {
      const row = await this.prisma.subjectGroup.create({
        data: {
          groupCode: dto.groupCode,
          groupName: dto.groupName,
          facultyId: dto.facultyId,
        },
        include: summaryInclude(todayDate()),
      });
      this.logger.log(`Subject group ${row.groupCode} created by ${actorId}`);
      return toSubjectGroupSummaryDto(row);
    } catch (error) {
      throw mapUniqueViolation(
        error,
        SUBJECT_GROUP_ERRORS.GROUP_CODE_TAKEN,
        'groupCode',
      );
    }
  }

  async update(
    groupId: string,
    dto: UpdateSubjectGroupDto,
    actorId: string,
  ): Promise<SubjectGroupSummaryDto> {
    await this.findOrThrow(groupId);
    if (dto.facultyId !== undefined) await this.assertFaculty(dto.facultyId);
    const row = await this.prisma.subjectGroup.update({
      where: { id: groupId },
      data: { groupName: dto.groupName, facultyId: dto.facultyId },
      include: summaryInclude(todayDate()),
    });
    this.logger.log(`Subject group ${row.groupCode} updated by ${actorId}`);
    return toSubjectGroupSummaryDto(row);
  }

  async deactivationImpact(
    groupId: string,
  ): Promise<SubjectGroupDeactivationImpactDto> {
    const summary = toSubjectGroupSummaryDto(await this.findOrThrow(groupId));
    // Read through Prisma so this feature does not import the courses feature.
    const courses = await this.prisma.course.findMany({
      where: { ownerGroupId: groupId, status: { not: CourseStatus.CANCELLED } },
      select: { id: true, courseCode: true, courseName: true },
      orderBy: { courseCode: 'asc' },
    });
    return {
      activeMemberCount: summary.activeMemberCount,
      activeCoordinators: summary.activeCoordinators,
      courses,
    };
  }

  async deactivate(
    groupId: string,
    actorId: string,
  ): Promise<SubjectGroupSummaryDto> {
    return this.setStatus(groupId, SubjectGroupStatus.INACTIVE, actorId);
  }

  async activate(
    groupId: string,
    actorId: string,
  ): Promise<SubjectGroupSummaryDto> {
    const group = await this.findOrThrow(groupId);
    if (group.status === SubjectGroupStatus.INACTIVE)
      await this.assertFaculty(group.facultyId);
    return this.setStatus(groupId, SubjectGroupStatus.ACTIVE, actorId);
  }

  private async assertFaculty(facultyId: string): Promise<void> {
    const unit = await this.prisma.orgUnit.findUnique({
      where: { id: facultyId },
    });
    if (
      !unit ||
      unit.unitType !== OrgUnitType.FACULTY ||
      unit.status !== OrgUnitStatus.ACTIVE
    )
      throw new AppException(SUBJECT_GROUP_ERRORS.FACULTY_INVALID);
  }

  private async findOrThrow(groupId: string, today: Date = todayDate()) {
    const row = await this.prisma.subjectGroup.findUnique({
      where: { id: groupId },
      include: summaryInclude(today),
    });
    if (!row)
      throw new AppException(SUBJECT_GROUP_ERRORS.SUBJECT_GROUP_NOT_FOUND);
    return row;
  }

  private async setStatus(
    groupId: string,
    status: SubjectGroupStatus,
    actorId: string,
  ): Promise<SubjectGroupSummaryDto> {
    const today = todayDate();
    const current = await this.findOrThrow(groupId, today);
    if (current.status === status) return toSubjectGroupSummaryDto(current);
    const row = await this.prisma.subjectGroup.update({
      where: { id: groupId },
      data: { status },
      include: summaryInclude(today),
    });
    this.logger.log(
      `Subject group ${row.groupCode} status set to ${status} by ${actorId}`,
    );
    return toSubjectGroupSummaryDto(row);
  }
}

export function groupTarget(group: {
  id: string;
  facultyId: string;
}): ScopeTarget {
  return { subjectGroupIds: [group.id], orgUnitIds: [group.facultyId] };
}

function scopeWhere(scope: ResolvedScope): Prisma.SubjectGroupWhereInput {
  if (scope.all) return {};
  return {
    OR: [
      { id: { in: [...scope.subjectGroupIds] } },
      { facultyId: { in: [...scope.orgUnitIds] } },
    ],
  };
}
