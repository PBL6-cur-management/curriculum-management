import { Injectable, Logger } from '@nestjs/common';
import { type Prisma } from '../../generated/prisma/client.js';
import { isCourseAddable } from '../../shared/curriculum/curriculum-row-rules.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { itemTarget } from '../../shared/curriculum/item-target.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { mapUniqueViolation } from '../../shared/prisma/unique-violation.js';
import { programTarget } from '../../shared/programs/program-target.js';
import {
  assertCurriculumWrite,
  assertDraft,
  assertSemesterInRange,
} from './curriculum-access.js';
import { CurriculumReadService } from './curriculum-read.service.js';
import { CurriculumRequisitesService } from './curriculum-requisites.service.js';
import { type CurriculumItemDto } from './curriculum.dto.js';
import {
  CURRICULUM_CONSTRAINT,
  CURRICULUM_ERRORS,
} from './curriculum.errors.js';
import {
  CreateCurriculumItemDto,
  UpdateCurriculumItemDto,
} from './create-curriculum-item.dto.js';
import { ReorderCurriculumDto } from './reorder-curriculum.dto.js';

// Rows of a curriculum: add, edit, remove, reorder. Requisites and elective groups have their own services (D1).
@Injectable()
export class CurriculumService {
  private readonly logger = new Logger(CurriculumService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reader: CurriculumReadService,
    private readonly requisites: CurriculumRequisitesService,
  ) {}

  async createItem(
    versionId: string,
    dto: CreateCurriculumItemDto,
    access: AccessContext,
  ): Promise<CurriculumItemDto> {
    const version = await this.reader.findVersion(versionId);
    assertDraft(version);
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      select: { id: true, courseCode: true, status: true, ownerGroupId: true },
    });
    if (!course) {
      throw new AppException(CURRICULUM_ERRORS.COURSE_NOT_FOUND, [
        { field: 'courseId', constraints: [] },
      ]);
    }
    await assertCurriculumWrite(
      this.prisma,
      access,
      version,
      itemTarget(version, course),
    );
    if (!isCourseAddable(course.status)) {
      throw new AppException(CURRICULUM_ERRORS.COURSE_NOT_ACTIVE);
    }
    assertSemesterInRange(version, dto.plannedSemester);
    await this.assertCourseNotListed(versionId, course);
    const item = await this.prisma
      .$transaction(async (tx) => {
        const created = await tx.curriculumItem.create({
          data: {
            versionId,
            courseId: course.id,
            plannedSemester: dto.plannedSemester,
            sortOrder: await nextSortOrder(tx, versionId, dto.plannedSemester),
            blockSymbol: dto.blockSymbol ?? null,
            isElective: dto.isElective,
            htDa: dto.htDa ?? false,
            tqDa: dto.tqDa ?? false,
            minStudiedScore: dto.minStudiedScore ?? null,
            minTransferScore: dto.minTransferScore ?? null,
            note: dto.note ?? null,
          },
          select: { id: true },
        });
        await this.requisites.seedFromCatalog(tx, created.id, course.id);
        return created;
      })
      .catch((error: unknown) => {
        throw mapUniqueViolation(
          error,
          CURRICULUM_ERRORS.COURSE_ALREADY_IN_CURRICULUM,
          'courseId',
        );
      });
    this.logger.log(
      `Curriculum item ${course.courseCode} added to version ${versionId} by ${access.userId}`,
    );
    return this.reader.itemDto(item.id, access);
  }

  async updateItem(
    itemId: string,
    dto: UpdateCurriculumItemDto,
    access: AccessContext,
  ): Promise<CurriculumItemDto> {
    const item = await this.reader.findItem(itemId);
    await assertCurriculumWrite(
      this.prisma,
      access,
      item.version,
      itemTarget(item.version, item.course),
    );
    if (dto.isElective === false && item.electiveGroupId) {
      throw new AppException(CURRICULUM_ERRORS.ITEM_IN_ELECTIVE_GROUP);
    }
    const moveTo =
      dto.plannedSemester !== undefined &&
      dto.plannedSemester !== item.plannedSemester
        ? dto.plannedSemester
        : undefined;
    if (moveTo !== undefined) {
      assertSemesterInRange(item.version, moveTo);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.curriculumItem.update({
        where: { id: itemId },
        data: {
          plannedSemester: dto.plannedSemester,
          blockSymbol: dto.blockSymbol,
          isElective: dto.isElective,
          htDa: dto.htDa,
          tqDa: dto.tqDa,
          minStudiedScore: dto.minStudiedScore,
          minTransferScore: dto.minTransferScore,
          note: dto.note,
          // A row moved to another semester lands last there (one rule, no position argument).
          sortOrder:
            moveTo === undefined
              ? undefined
              : await nextSortOrder(tx, item.versionId, moveTo),
        },
      });
    });
    this.logger.log(`Curriculum item ${itemId} updated by ${access.userId}`);
    return this.reader.itemDto(itemId, access);
  }

  async removeItem(itemId: string, access: AccessContext): Promise<void> {
    const item = await this.reader.findItem(itemId);
    await assertCurriculumWrite(
      this.prisma,
      access,
      item.version,
      itemTarget(item.version, item.course),
    );
    await this.prisma.curriculumItem.delete({ where: { id: itemId } });
    this.logger.log(
      `Curriculum item ${itemId} (${item.course.courseCode}) removed by ${access.userId}`,
    );
  }

  // Ordering is program-level (structure target), unlike row edits.
  async reorder(
    versionId: string,
    dto: ReorderCurriculumDto,
    access: AccessContext,
  ): Promise<void> {
    const version = await this.reader.findVersion(versionId);
    await assertCurriculumWrite(
      this.prisma,
      access,
      version,
      programTarget(version.program),
    );
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.curriculumItem.findMany({
        where: { versionId, plannedSemester: dto.plannedSemester },
        select: { id: true },
      });
      const sameSet =
        current.length === dto.itemIds.length &&
        current.every((row) => dto.itemIds.includes(row.id));
      if (!sameSet) {
        throw new AppException(CURRICULUM_ERRORS.ORDER_MISMATCH);
      }
      for (const [index, id] of dto.itemIds.entries()) {
        await tx.curriculumItem.update({
          where: { id },
          data: { sortOrder: index + 1 },
        });
      }
    });
    this.logger.log(
      `Semester ${dto.plannedSemester} of version ${versionId} reordered by ${access.userId}`,
    );
  }

  // Before the insert so the message can name the semester; the unique index still catches a race.
  private async assertCourseNotListed(
    versionId: string,
    course: { id: string },
  ): Promise<void> {
    const existing = await this.prisma.curriculumItem.findUnique({
      where: { versionId_courseId: { versionId, courseId: course.id } },
      select: { plannedSemester: true },
    });
    if (!existing) {
      return;
    }
    const base = CURRICULUM_ERRORS.COURSE_ALREADY_IN_CURRICULUM;
    throw new AppException(
      {
        ...base,
        message: `${base.message} ở học kỳ ${existing.plannedSemester}.`,
      },
      [
        {
          field: 'courseId',
          constraints: [CURRICULUM_CONSTRAINT.UNIQUE_COURSE],
        },
      ],
    );
  }
}

async function nextSortOrder(
  tx: Prisma.TransactionClient,
  versionId: string,
  plannedSemester: number,
): Promise<number> {
  const result = await tx.curriculumItem.aggregate({
    where: { versionId, plannedSemester },
    _max: { sortOrder: true },
  });
  return (result._max.sortOrder ?? 0) + 1;
}
