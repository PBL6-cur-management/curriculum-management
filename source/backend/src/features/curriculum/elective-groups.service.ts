import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { mapUniqueViolation } from '../../shared/prisma/unique-violation.js';
import { programTarget } from '../../shared/programs/program-target.js';
import {
  assertCurriculumWrite,
  VERSION_SELECT,
  type VersionRow,
} from './curriculum-access.js';
import { CurriculumReadService } from './curriculum-read.service.js';
import {
  CURRICULUM_CONSTRAINT,
  CURRICULUM_ERRORS,
} from './curriculum.errors.js';
import {
  AssignGroupItemsDto,
  CreateElectiveGroupDto,
  GROUP_INCLUDE,
  toElectiveGroupDto,
  UpdateElectiveGroupDto,
  type ElectiveGroupDto,
} from './elective-group.dto.js';

interface AssignableItem {
  id: string;
  versionId: string;
  isElective: boolean;
  electiveGroupId: string | null;
  course: { courseCode: string };
}

// Groups are program-level structure (US-026): the write target is the program, never a course's subject group (D3).
@Injectable()
export class ElectiveGroupsService {
  private readonly logger = new Logger(ElectiveGroupsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reader: CurriculumReadService,
  ) {}

  async create(
    versionId: string,
    dto: CreateElectiveGroupDto,
    access: AccessContext,
  ): Promise<ElectiveGroupDto> {
    const version = await this.reader.findVersion(versionId);
    await assertCurriculumWrite(
      this.prisma,
      access,
      version,
      programTarget(version.program),
    );
    assertHasMinimum(dto.minCredits ?? null, dto.minCourses ?? null);
    const group = await this.prisma.electiveGroup
      .create({
        data: {
          versionId,
          trackId: dto.trackId ?? null,
          groupCode: dto.groupCode,
          groupName: dto.groupName,
          minCredits: dto.minCredits ?? null,
          minCourses: dto.minCourses ?? null,
        },
        include: GROUP_INCLUDE,
      })
      .catch((error: unknown) => {
        throw mapUniqueViolation(
          error,
          CURRICULUM_ERRORS.GROUP_CODE_TAKEN,
          'groupCode',
        );
      });
    this.logger.log(
      `Elective group ${dto.groupCode} created in version ${versionId} by ${access.userId}`,
    );
    return toElectiveGroupDto(group);
  }

  async update(
    groupId: string,
    dto: UpdateElectiveGroupDto,
    access: AccessContext,
  ): Promise<ElectiveGroupDto> {
    const group = await this.findGroup(groupId);
    await this.assertCanWrite(group, access);
    assertHasMinimum(
      dto.minCredits === undefined ? group.minCredits : dto.minCredits,
      dto.minCourses === undefined ? group.minCourses : dto.minCourses,
    );
    const updated = await this.prisma.electiveGroup
      .update({
        where: { id: groupId },
        data: {
          groupCode: dto.groupCode,
          groupName: dto.groupName,
          trackId: dto.trackId,
          minCredits: dto.minCredits,
          minCourses: dto.minCourses,
        },
        include: GROUP_INCLUDE,
      })
      .catch((error: unknown) => {
        throw mapUniqueViolation(
          error,
          CURRICULUM_ERRORS.GROUP_CODE_TAKEN,
          'groupCode',
        );
      });
    this.logger.log(`Elective group ${groupId} updated by ${access.userId}`);
    return toElectiveGroupDto(updated);
  }

  // Rows keep isElective = true and lose the group (onDelete: SetNull).
  async remove(groupId: string, access: AccessContext): Promise<void> {
    const group = await this.findGroup(groupId);
    await this.assertCanWrite(group, access);
    await this.prisma.electiveGroup.delete({ where: { id: groupId } });
    this.logger.log(
      `Elective group ${group.groupCode} removed from version ${group.versionId} by ${access.userId}`,
    );
  }

  async assignItems(
    groupId: string,
    dto: AssignGroupItemsDto,
    access: AccessContext,
  ): Promise<ElectiveGroupDto> {
    const group = await this.findGroup(groupId);
    await this.assertCanWrite(group, access);
    const items = await this.prisma.curriculumItem.findMany({
      where: { id: { in: dto.itemIds } },
      select: {
        id: true,
        versionId: true,
        isElective: true,
        electiveGroupId: true,
        course: { select: { courseCode: true } },
      },
    });
    assertAssignable(group, dto.itemIds, items);
    await this.prisma.$transaction([
      this.prisma.curriculumItem.updateMany({
        where: { electiveGroupId: groupId, id: { notIn: dto.itemIds } },
        data: { electiveGroupId: null },
      }),
      this.prisma.curriculumItem.updateMany({
        where: { id: { in: dto.itemIds } },
        data: { electiveGroupId: groupId },
      }),
    ]);
    this.logger.log(
      `Elective group ${group.groupCode} now holds ${dto.itemIds.length} rows (by ${access.userId})`,
    );
    return toElectiveGroupDto(
      await this.prisma.electiveGroup.findUniqueOrThrow({
        where: { id: groupId },
        include: GROUP_INCLUDE,
      }),
    );
  }

  private assertCanWrite(
    group: { version: VersionRow },
    access: AccessContext,
  ): Promise<void> {
    return assertCurriculumWrite(
      this.prisma,
      access,
      group.version,
      programTarget(group.version.program),
    );
  }

  private async findGroup(groupId: string) {
    const group = await this.prisma.electiveGroup.findUnique({
      where: { id: groupId },
      include: { version: { select: VERSION_SELECT } },
    });
    if (!group) {
      throw new AppException(CURRICULUM_ERRORS.ELECTIVE_GROUP_NOT_FOUND);
    }
    return group;
  }
}

function assertHasMinimum(
  minCredits: Prisma.Decimal | string | null,
  minCourses: number | null,
): void {
  if (minCredits === null && minCourses === null) {
    throw new AppException(CURRICULUM_ERRORS.GROUP_MINIMUM_REQUIRED, [
      {
        field: 'minCredits',
        constraints: [CURRICULUM_CONSTRAINT.GROUP_MINIMUM],
      },
      {
        field: 'minCourses',
        constraints: [CURRICULUM_CONSTRAINT.GROUP_MINIMUM],
      },
    ]);
  }
}

// Checks the database cannot make: same version, and a clear message naming the course.
function assertAssignable(
  group: { id: string; versionId: string },
  ids: readonly string[],
  items: readonly AssignableItem[],
): void {
  if (
    items.length !== ids.length ||
    items.some((item) => item.versionId !== group.versionId)
  ) {
    throw new AppException(CURRICULUM_ERRORS.ITEM_NOT_IN_VERSION);
  }
  const compulsory = items.find((item) => !item.isElective);
  if (compulsory) {
    const base = CURRICULUM_ERRORS.GROUP_REQUIRES_ELECTIVE;
    throw new AppException({
      ...base,
      message: `${base.message}: ${compulsory.course.courseCode}.`,
    });
  }
  const elsewhere = items.find(
    (item) =>
      item.electiveGroupId !== null && item.electiveGroupId !== group.id,
  );
  if (elsewhere) {
    const base = CURRICULUM_ERRORS.ITEM_IN_OTHER_GROUP;
    throw new AppException({
      ...base,
      message: `${base.message}: ${elsewhere.course.courseCode}.`,
    });
  }
}
