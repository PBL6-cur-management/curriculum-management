import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Prisma, type GraduationBatch } from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import type { PageQueryDto } from '../../shared/pagination/page-query.dto.js';
import {
  assertGraduationWrite,
  graduationStaffScope,
} from '../../shared/graduation/graduation-access.js';
import { graduationTransaction } from '../../shared/graduation/graduation-audit.writer.js';
import { GRADUATION_ERRORS } from '../../shared/graduation/graduation.errors.js';
import { decodeGraduationResult } from '../../shared/graduation/graduation-result.codec.js';
import { GRADUATION_LIMITS } from '../../shared/graduation/graduation.constants.js';
import { GraduationRosterReader } from './graduation-roster.reader.js';
import { GraduationScheduler } from './graduation.scheduler.js';
import type {
  GraduationBatchCreateDto,
  GraduationBatchFilterDto,
  GraduationBatchItemQueryDto,
  GraduationBatchValue,
} from './graduation-batch.dto.js';

function object(value: Prisma.JsonValue): Prisma.JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AppException(GRADUATION_ERRORS.INPUT_INVALID);
  return value;
}
function label(value: Prisma.JsonObject, key: string): string {
  if (typeof value[key] !== 'string')
    throw new AppException(GRADUATION_ERRORS.INPUT_INVALID);
  return value[key];
}

@Injectable()
export class GraduationBatchesService {
  private readonly logger = new Logger(GraduationBatchesService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly roster: GraduationRosterReader,
    private readonly scheduler: GraduationScheduler,
  ) {}

  async preview(access: AccessContext, filters: GraduationBatchFilterDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const { items: _items, ...preview } = await this.roster.read(
          access,
          filters,
          tx,
        );
        return preview;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async create(access: AccessContext, command: GraduationBatchCreateDto) {
    graduationStaffScope(access, true);
    const filters = {
      semesterId: command.semesterId,
      programId: command.programId ?? null,
      cohortId: command.cohortId ?? null,
    };
    const id = await graduationTransaction(this.prisma, async (tx) => {
      const old = await tx.graduationBatch.findUnique({
        where: {
          requestedById_requestKey: {
            requestedById: access.userId,
            requestKey: command.requestKey,
          },
        },
      });
      if (old) {
        const previous = object(old.filters);
        if (
          previous.semesterId !== filters.semesterId ||
          previous.programId !== filters.programId ||
          previous.cohortId !== filters.cohortId ||
          old.previewRevision !== command.previewRevision
        )
          throw new AppException(GRADUATION_ERRORS.STATE_CHANGED);
        await this.owned(tx, access, old.id);
        return old.id;
      }
      const roster = await this.roster.read(access, command, tx);
      if (roster.previewRevision !== command.previewRevision)
        throw new AppException(GRADUATION_ERRORS.STATE_CHANGED);
      if (!roster.enrollmentCount)
        throw new BadRequestException('Danh sách xét rỗng; chọn lại bộ lọc.');
      const batch = await tx.graduationBatch.create({
        data: {
          requestedById: access.userId,
          requestKey: command.requestKey,
          filters,
          previewRevision: roster.previewRevision,
          rosterDigest: roster.previewRevision,
          studentCount: roster.studentCount,
          enrollmentCount: roster.enrollmentCount,
          items: { create: roster.items },
        },
      });
      return batch.id;
    });
    try {
      await this.scheduler.enqueueBatch(id);
    } catch {
      this.logger.warn(`Graduation batch queued for recovery: ${id}`);
    }
    return this.detail(access, id);
  }

  private async owned(
    tx: Prisma.TransactionClient,
    access: AccessContext,
    id: string,
  ) {
    graduationStaffScope(access, true);
    const batch = await tx.graduationBatch.findFirst({
      where: { id, requestedById: access.userId },
    });
    if (!batch) throw new AppException(GRADUATION_ERRORS.ACCESS_REVOKED);
    const targets = await tx.graduationBatchItem.findMany({
      where: { batchId: id },
      select: { studentId: true, programId: true },
      distinct: ['programId'],
    });
    for (const target of targets)
      assertGraduationWrite(access, {
        programIds: [target.programId],
        studentIds: [target.studentId],
      });
    return batch;
  }

  private async value(
    tx: Prisma.TransactionClient,
    batch: GraduationBatch,
  ): Promise<GraduationBatchValue> {
    const [eligibleCount, notEligibleCount, errorCount] = await Promise.all([
      tx.graduationBatchItem.count({
        where: {
          batchId: batch.id,
          status: 'REVIEWED',
          audit: { conclusion: 'ELIGIBLE' },
        },
      }),
      tx.graduationBatchItem.count({
        where: {
          batchId: batch.id,
          status: 'REVIEWED',
          audit: { conclusion: 'NOT_ELIGIBLE' },
        },
      }),
      tx.graduationBatchItem.count({
        where: { batchId: batch.id, status: 'ERROR' },
      }),
    ]);
    const filters = object(batch.filters);
    if (
      typeof filters.semesterId !== 'string' ||
      !(filters.programId === null || typeof filters.programId === 'string') ||
      !(filters.cohortId === null || typeof filters.cohortId === 'string')
    )
      throw new AppException(GRADUATION_ERRORS.INPUT_INVALID);
    return {
      id: batch.id,
      requestedById: batch.requestedById,
      filters: {
        semesterId: filters.semesterId,
        programId: filters.programId,
        cohortId: filters.cohortId,
      },
      studentCount: batch.studentCount,
      enrollmentCount: batch.enrollmentCount,
      previewRevision: batch.previewRevision,
      status: batch.status,
      processedCount: eligibleCount + notEligibleCount + errorCount,
      eligibleCount,
      notEligibleCount,
      errorCount,
      createdAt: batch.createdAt.toISOString(),
      startedAt: batch.startedAt?.toISOString() ?? null,
      finishedAt: batch.finishedAt?.toISOString() ?? null,
      failure: batch.failureCode
        ? {
            code: batch.failureCode,
            message: GRADUATION_ERRORS.JOB_FAILED.message,
          }
        : null,
    };
  }

  async detail(access: AccessContext, id: string) {
    return this.prisma.$transaction(
      async (tx) => this.value(tx, await this.owned(tx, access, id)),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async list(access: AccessContext, query: PageQueryDto) {
    const scope = graduationStaffScope(access, true);
    return this.prisma.$transaction(
      async (tx) => {
        const where: Prisma.GraduationBatchWhereInput = {
          requestedById: access.userId,
          ...(scope.all
            ? {}
            : { items: { every: { programId: { in: scope.programIds } } } }),
        };
        const [rows, total] = await Promise.all([
          tx.graduationBatch.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          }),
          tx.graduationBatch.count({ where }),
        ]);
        return {
          items: await Promise.all(rows.map((row) => this.value(tx, row))),
          total,
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private itemWhere(
    id: string,
    query: Partial<GraduationBatchItemQueryDto>,
  ): Prisma.GraduationBatchItemWhereInput {
    if (query.conclusion && query.outcome && query.outcome !== 'REVIEWED')
      throw new BadRequestException(
        'Bộ lọc kết luận chỉ dùng cho các mục đã xét.',
      );
    const search = query.q?.trim();
    return {
      batchId: id,
      ...(query.outcome ? { status: query.outcome } : {}),
      ...(query.conclusion ? { audit: { conclusion: query.conclusion } } : {}),
      ...(search
        ? {
            OR: [
              {
                rosterIdentity: {
                  path: ['studentCode'],
                  string_contains: search,
                  mode: 'insensitive',
                },
              },
              {
                rosterIdentity: {
                  path: ['fullName'],
                  string_contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
  }

  async items(
    access: AccessContext,
    id: string,
    query: GraduationBatchItemQueryDto,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.owned(tx, access, id);
        const where = this.itemWhere(id, query);
        const [rows, total] = await Promise.all([
          tx.graduationBatchItem.findMany({
            where,
            include: { audit: true },
            orderBy: [
              { student: { studentCode: 'asc' } },
              { program: { programCode: 'asc' } },
              { id: 'asc' },
            ],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          }),
          tx.graduationBatchItem.count({ where }),
        ]);
        return {
          items: rows.map((row) => {
            const identity = object(row.rosterIdentity);
            const result = row.audit
              ? decodeGraduationResult(row.audit.result)
              : null;
            return {
              id: row.id,
              studentId: row.studentId,
              studentCode: label(identity, 'studentCode'),
              fullName: label(identity, 'fullName'),
              programId: row.programId,
              programCode: label(identity, 'programCode'),
              programName: label(identity, 'programName'),
              semesterId: row.semesterId,
              enrollmentId: row.rosterEnrollmentId,
              status: row.status,
              auditId: row.auditId,
              conclusion: result?.conclusion ?? null,
              shortfallCount: result?.shortfalls.length ?? null,
              error: row.errorCode
                ? {
                    code: row.errorCode,
                    message:
                      row.errorMessage ??
                      GRADUATION_ERRORS.INPUT_INVALID.message,
                  }
                : null,
              finishedAt: row.finishedAt?.toISOString() ?? null,
            };
          }),
          total,
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async exportRows(
    access: AccessContext,
    id: string,
    filters: Partial<GraduationBatchItemQueryDto>,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const stored = await this.owned(tx, access, id);
        if (
          stored.status !== 'COMPLETED' &&
          stored.status !== 'COMPLETED_WITH_ERRORS'
        )
          throw new AppException(GRADUATION_ERRORS.STATE_CHANGED);
        const batch = await this.value(tx, stored);
        const items: Array<{
          rosterIdentity: {
            studentCode: string;
            fullName: string;
            programCode: string;
            semesterCode: string;
          };
          errorCode: string | null;
          errorMessage: string | null;
          audit: {
            id: string;
            auditedAt: Date;
            result: ReturnType<typeof decodeGraduationResult>;
          } | null;
        }> = [];
        for (let skip = 0; ; skip += GRADUATION_LIMITS.BATCH_CHUNK_SIZE) {
          const rows = await tx.graduationBatchItem.findMany({
            where: this.itemWhere(id, filters),
            include: { audit: true },
            orderBy: [
              { student: { studentCode: 'asc' } },
              { program: { programCode: 'asc' } },
              { id: 'asc' },
            ],
            skip,
            take: GRADUATION_LIMITS.BATCH_CHUNK_SIZE,
          });
          for (const row of rows) {
            const identity = object(row.rosterIdentity);
            items.push({
              rosterIdentity: {
                studentCode: label(identity, 'studentCode'),
                fullName: label(identity, 'fullName'),
                programCode: label(identity, 'programCode'),
                semesterCode: label(identity, 'semesterCode'),
              },
              errorCode: row.errorCode,
              errorMessage: row.errorMessage,
              audit: row.audit
                ? {
                    id: row.audit.id,
                    auditedAt: row.audit.auditedAt,
                    result: decodeGraduationResult(row.audit.result),
                  }
                : null,
            });
          }
          if (rows.length < GRADUATION_LIMITS.BATCH_CHUNK_SIZE) break;
        }
        return { batch, items };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: GRADUATION_LIMITS.TRANSACTION_TIMEOUT_MS,
      },
    );
  }
}
