import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { mapUniqueViolation } from '../../shared/prisma/unique-violation.js';
import { lockSyllabusAssessment } from '../../shared/syllabi/syllabus-assessment-lock.js';
import {
  assertDraftWrite,
  SYLLABUS_ACCESS_SELECT,
  touchSyllabus,
  type SyllabusAccessRow,
} from './syllabus-access.js';
import {
  CLO_INCLUDE,
  toCloDto,
  type CloDto,
  type CreateCloDto,
  type ReorderClosDto,
  type UpdateCloDto,
} from './clo.dto.js';
import {
  SYLLABUS_ERRORS,
  SYLLABUS_FIELD,
  SYLLABUS_LIMITS,
} from './syllabus.errors.js';

const BY_ORDER = [{ sortOrder: 'asc' }, { id: 'asc' }] as const;

// The CLOs of a Draft. They are written with clo.edit, not syllabus.edit; the guard order is the syllabus one.
@Injectable()
export class ClosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    syllabusId: string,
    dto: CreateCloDto,
    access: AccessContext,
  ): Promise<CloDto> {
    await assertDraftWrite(
      this.prisma,
      access,
      await this.findRevision(syllabusId),
      PERMISSIONS.CLO_EDIT,
    );
    return this.prisma.$transaction(async (tx) => {
      await this.lockAndRecheck(tx, syllabusId, access);
      const count = await tx.cLO.count({ where: { syllabusId } });
      if (count >= SYLLABUS_LIMITS.CLOS_MAX) {
        throw new AppException(SYLLABUS_ERRORS.CLOS_LIMIT);
      }
      try {
        const created = await tx.cLO.create({
          data: {
            syllabusId,
            cloCode: dto.cloCode,
            description: dto.description,
            sortOrder: count + 1,
            englishDescription: dto.englishDescription ?? null,
            cognitiveLevel: dto.cognitiveLevel ?? null,
          },
          include: CLO_INCLUDE,
        });
        await touchSyllabus(tx, syllabusId);
        return toCloDto(created);
      } catch (error) {
        throw mapUniqueViolation(
          error,
          SYLLABUS_ERRORS.CLO_CODE_TAKEN,
          SYLLABUS_FIELD.CLO_CODE,
        );
      }
    });
  }

  async update(
    cloId: string,
    dto: UpdateCloDto,
    access: AccessContext,
  ): Promise<CloDto> {
    const row = await this.findClo(cloId);
    await assertDraftWrite(
      this.prisma,
      access,
      row.syllabus,
      PERMISSIONS.CLO_EDIT,
    );
    return this.prisma.$transaction(async (tx) => {
      await this.lockAndRecheck(tx, row.syllabusId, access);
      try {
        const updated = await tx.cLO.update({
          where: { id: cloId },
          data: {
            ...(dto.cloCode !== undefined && { cloCode: dto.cloCode }),
            ...(dto.description !== undefined && {
              description: dto.description,
            }),
            ...(dto.englishDescription !== undefined && {
              englishDescription: dto.englishDescription,
            }),
            ...(dto.cognitiveLevel !== undefined && {
              cognitiveLevel: dto.cognitiveLevel,
            }),
          },
          include: CLO_INCLUDE,
        });
        await touchSyllabus(tx, row.syllabusId);
        return toCloDto(updated);
      } catch (error) {
        throw mapUniqueViolation(
          error,
          SYLLABUS_ERRORS.CLO_CODE_TAKEN,
          SYLLABUS_FIELD.CLO_CODE,
        );
      }
    });
  }

  // Deleting cascades the CLO's PLO links in every program and its week links; the rest are renumbered 1..n.
  async remove(cloId: string, access: AccessContext): Promise<void> {
    const row = await this.findClo(cloId);
    await assertDraftWrite(
      this.prisma,
      access,
      row.syllabus,
      PERMISSIONS.CLO_EDIT,
    );
    await this.prisma.$transaction(async (tx) => {
      await this.lockAndRecheck(tx, row.syllabusId, access);
      await tx.cLO.delete({ where: { id: cloId } });
      const rest = await tx.cLO.findMany({
        where: { syllabusId: row.syllabusId },
        orderBy: [...BY_ORDER],
        select: { id: true },
      });
      for (const [index, { id }] of rest.entries()) {
        await tx.cLO.update({ where: { id }, data: { sortOrder: index + 1 } });
      }
      await touchSyllabus(tx, row.syllabusId);
    });
  }

  async reorder(
    syllabusId: string,
    dto: ReorderClosDto,
    access: AccessContext,
  ): Promise<CloDto[]> {
    await assertDraftWrite(
      this.prisma,
      access,
      await this.findRevision(syllabusId),
      PERMISSIONS.CLO_EDIT,
    );
    return this.prisma.$transaction(async (tx) => {
      await this.lockAndRecheck(tx, syllabusId, access);
      const rows = await tx.cLO.findMany({
        where: { syllabusId },
        select: { id: true },
      });
      const current = new Set(rows.map((row) => row.id));
      if (
        rows.length !== dto.ids.length ||
        dto.ids.some((id) => !current.has(id))
      ) {
        throw new AppException(SYLLABUS_ERRORS.ORDER_MISMATCH);
      }
      for (const [index, id] of dto.ids.entries()) {
        await tx.cLO.update({
          where: { id },
          data: { sortOrder: index + 1 },
        });
      }
      await touchSyllabus(tx, syllabusId);
      const ordered = await tx.cLO.findMany({
        where: { syllabusId },
        orderBy: [...BY_ORDER],
        include: CLO_INCLUDE,
      });
      return ordered.map(toCloDto);
    });
  }

  // A CLO change can reopen coverage warnings, so it queues behind submission and release on the same locks and
  // judges access again once it holds them.
  private async lockAndRecheck(
    tx: Prisma.TransactionClient,
    syllabusId: string,
    access: AccessContext,
  ): Promise<void> {
    await lockSyllabusAssessment(tx, syllabusId);
    await assertDraftWrite(
      tx,
      access,
      await tx.syllabus.findUnique({
        where: { id: syllabusId },
        select: SYLLABUS_ACCESS_SELECT,
      }),
      PERMISSIONS.CLO_EDIT,
    );
  }

  private findRevision(syllabusId: string): Promise<SyllabusAccessRow | null> {
    return this.prisma.syllabus.findUnique({
      where: { id: syllabusId },
      select: SYLLABUS_ACCESS_SELECT,
    });
  }

  private async findClo(cloId: string) {
    const row = await this.prisma.cLO.findUnique({
      where: { id: cloId },
      select: {
        syllabusId: true,
        syllabus: { select: SYLLABUS_ACCESS_SELECT },
      },
    });
    if (!row) {
      throw new AppException(SYLLABUS_ERRORS.CLO_NOT_FOUND);
    }
    return row;
  }
}
