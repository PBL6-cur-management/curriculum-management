import { Injectable, Logger } from '@nestjs/common';
import { CourseStatus, Prisma } from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { assertSchoolWideDirect } from '../../shared/authz/edit-path.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { toPage, toSkipTake, type Page } from '../../shared/pagination/page.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { mapUniqueViolation } from '../../shared/prisma/unique-violation.js';
import { CreateEquivalenceGroupDto } from './create-equivalence-group.dto.js';
import { EquivalenceGroupQueryDto } from './equivalence-group-query.dto.js';
import {
  GROUP_INCLUDE,
  toEquivalenceGroupDto,
  type EquivalenceGroupDto,
  type GroupRow,
} from './equivalence-group.dto.js';
import { EQUIVALENCE_ERRORS } from './equivalence-groups.errors.js';
import { UpdateEquivalenceGroupDto } from './update-equivalence-group.dto.js';

const MEMBERS_MIN = 2;

// Equivalence groups sit outside versions and apply to every one (M-4, EC-16, E-11):
// R1 edits them directly at any time, so no release rule applies here.
@Injectable()
export class EquivalenceGroupsService {
  private readonly logger = new Logger(EquivalenceGroupsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: EquivalenceGroupQueryDto,
  ): Promise<Page<EquivalenceGroupDto>> {
    const where: Prisma.EquivalentCourseGroupWhereInput = query.q
      ? {
          OR: [
            { groupCode: { contains: query.q, mode: 'insensitive' } },
            {
              members: {
                some: {
                  courseCode: { contains: query.q, mode: 'insensitive' },
                },
              },
            },
          ],
        }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.equivalentCourseGroup.findMany({
        where,
        include: GROUP_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...toSkipTake(query),
      }),
      this.prisma.equivalentCourseGroup.count({ where }),
    ]);
    return toPage(rows.map(toEquivalenceGroupDto), total, query);
  }

  async detail(groupId: string): Promise<EquivalenceGroupDto> {
    return toEquivalenceGroupDto(await this.findOrThrow(groupId));
  }

  async create(
    dto: CreateEquivalenceGroupDto,
    access: AccessContext,
  ): Promise<EquivalenceGroupDto> {
    assertSchoolWideDirect(access, PERMISSIONS.COURSE_RELATION_EDIT);
    await this.assertJoinable(dto.courseIds);
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const group = await tx.equivalentCourseGroup.create({
          data: { groupCode: dto.groupCode, note: dto.note ?? null },
        });
        await this.attach(tx, group.id, dto.courseIds);
        return tx.equivalentCourseGroup.findUniqueOrThrow({
          where: { id: group.id },
          include: GROUP_INCLUDE,
        });
      });
      this.logger.log(
        `Equivalence group ${row.groupCode} created by ${access.userId}`,
      );
      return toEquivalenceGroupDto(row);
    } catch (error) {
      throw mapUniqueViolation(
        error,
        EQUIVALENCE_ERRORS.GROUP_CODE_TAKEN,
        'groupCode',
      );
    }
  }

  async update(
    groupId: string,
    dto: UpdateEquivalenceGroupDto,
    access: AccessContext,
  ): Promise<EquivalenceGroupDto> {
    assertSchoolWideDirect(access, PERMISSIONS.COURSE_RELATION_EDIT);
    await this.findOrThrow(groupId);
    try {
      const row = await this.prisma.equivalentCourseGroup.update({
        where: { id: groupId },
        data: { groupCode: dto.groupCode, note: dto.note },
        include: GROUP_INCLUDE,
      });
      return toEquivalenceGroupDto(row);
    } catch (error) {
      throw mapUniqueViolation(
        error,
        EQUIVALENCE_ERRORS.GROUP_CODE_TAKEN,
        'groupCode',
      );
    }
  }

  async addMember(
    groupId: string,
    courseId: string,
    access: AccessContext,
  ): Promise<EquivalenceGroupDto> {
    assertSchoolWideDirect(access, PERMISSIONS.COURSE_RELATION_EDIT);
    await this.findOrThrow(groupId);
    await this.assertJoinable([courseId]);
    await this.prisma.$transaction((tx) =>
      this.attach(tx, groupId, [courseId]),
    );
    this.logger.log(
      `Course ${courseId} joined group ${groupId} by ${access.userId}`,
    );
    return this.detail(groupId);
  }

  async removeMember(
    groupId: string,
    courseId: string,
    access: AccessContext,
  ): Promise<EquivalenceGroupDto> {
    assertSchoolWideDirect(access, PERMISSIONS.COURSE_RELATION_EDIT);
    const group = await this.findOrThrow(groupId);
    if (!group.members.some((member) => member.id === courseId)) {
      throw new AppException(EQUIVALENCE_ERRORS.NOT_A_MEMBER);
    }
    if (group.members.length <= MEMBERS_MIN) {
      throw new AppException(EQUIVALENCE_ERRORS.GROUP_MIN_MEMBERS);
    }
    await this.prisma.course.update({
      where: { id: courseId },
      data: { equivalenceGroupId: null },
    });
    this.logger.log(
      `Course ${courseId} left group ${groupId} by ${access.userId}`,
    );
    return this.detail(groupId);
  }

  // Keeps `groupId` (its code and note); the other group's members move over and the other group is deleted.
  async merge(
    groupId: string,
    otherGroupId: string,
    access: AccessContext,
  ): Promise<EquivalenceGroupDto> {
    assertSchoolWideDirect(access, PERMISSIONS.COURSE_RELATION_EDIT);
    if (groupId === otherGroupId) {
      throw new AppException(EQUIVALENCE_ERRORS.MERGE_SAME_GROUP);
    }
    await Promise.all([
      this.findOrThrow(groupId),
      this.findOrThrow(otherGroupId),
    ]);
    // Members move before the delete, or SetNull would clear them first.
    await this.prisma.$transaction([
      this.prisma.course.updateMany({
        where: { equivalenceGroupId: otherGroupId },
        data: { equivalenceGroupId: groupId },
      }),
      this.prisma.equivalentCourseGroup.delete({ where: { id: otherGroupId } }),
    ]);
    this.logger.log(
      `Equivalence group ${otherGroupId} merged into ${groupId} by ${access.userId}`,
    );
    return this.detail(groupId);
  }

  async dissolve(groupId: string, access: AccessContext): Promise<void> {
    assertSchoolWideDirect(access, PERMISSIONS.COURSE_RELATION_EDIT);
    await this.findOrThrow(groupId);
    await this.prisma.$transaction([
      this.prisma.course.updateMany({
        where: { equivalenceGroupId: groupId },
        data: { equivalenceGroupId: null },
      }),
      this.prisma.equivalentCourseGroup.delete({ where: { id: groupId } }),
    ]);
    this.logger.log(
      `Equivalence group ${groupId} dissolved by ${access.userId}`,
    );
  }

  // Joins only courses that are in no group; the conditional update makes a concurrent join lose cleanly.
  private async attach(
    tx: Prisma.TransactionClient,
    groupId: string,
    courseIds: string[],
  ): Promise<void> {
    const { count } = await tx.course.updateMany({
      where: {
        id: { in: courseIds },
        equivalenceGroupId: null,
        status: { not: CourseStatus.CANCELLED },
      },
      data: { equivalenceGroupId: groupId },
    });
    if (count !== courseIds.length) {
      throw new AppException(EQUIVALENCE_ERRORS.COURSE_ALREADY_GROUPED);
    }
  }

  private async assertJoinable(courseIds: string[]): Promise<void> {
    const courses = await this.prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: {
        id: true,
        courseCode: true,
        status: true,
        equivalenceGroup: { select: { groupCode: true } },
      },
    });
    if (courses.length !== courseIds.length) {
      throw new AppException(EQUIVALENCE_ERRORS.MEMBER_COURSE_NOT_FOUND, [
        { field: 'courseIds', constraints: ['exists'] },
      ]);
    }
    if (courses.some((course) => course.status === CourseStatus.CANCELLED)) {
      throw new AppException(EQUIVALENCE_ERRORS.MEMBER_COURSE_CANCELLED);
    }
    const grouped = courses.filter(
      (course) => course.equivalenceGroup !== null,
    );
    if (grouped.length > 0) {
      const base = EQUIVALENCE_ERRORS.COURSE_ALREADY_GROUPED;
      const names = grouped
        .map(
          (course) =>
            `${course.courseCode} (nhóm ${course.equivalenceGroup!.groupCode})`,
        )
        .join(', ');
      throw new AppException({
        ...base,
        message: `${base.message}: ${names}.`,
      });
    }
  }

  private async findOrThrow(groupId: string): Promise<GroupRow> {
    const row = await this.prisma.equivalentCourseGroup.findUnique({
      where: { id: groupId },
      include: GROUP_INCLUDE,
    });
    if (!row) {
      throw new AppException(EQUIVALENCE_ERRORS.GROUP_NOT_FOUND);
    }
    return row;
  }
}
