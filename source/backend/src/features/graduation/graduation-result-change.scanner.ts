import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { GRADUATION_LIMITS } from '../../shared/graduation/graduation.constants.js';
import { GRADUATION_ERRORS } from '../../shared/graduation/graduation.errors.js';
import {
  graduationExecutionError,
  isGraduationTransactionConflict,
  retryGraduationConflicts,
} from '../../shared/graduation/graduation-execution-error.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { lockPrograms } from '../../shared/releases/release-locks.js';
import { lockStudents } from '../../shared/students/student-locks.js';
import { graduationTransaction } from './graduation-jobs.constants.js';
import { GraduationScheduler } from './graduation.scheduler.js';

export function validateAcademicResultChangeSnapshot(
  value: Prisma.JsonValue,
): void {
  const invalid = () => {
    throw new AppException(GRADUATION_ERRORS.INPUT_INVALID);
  };
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid();
  const keys = ['score10', 'score4', 'letterGrade', 'status', 'dataSource'];
  if (
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    invalid();
  for (const [field, maximum] of [
    ['score10', 10],
    ['score4', 4],
  ] as const) {
    const score = value[field];
    if (score === null) continue;
    if (typeof score !== 'string' || !/^\d+(?:\.\d+)?$/.test(score))
      return invalid();
    const decimal = new Prisma.Decimal(score);
    if (!decimal.isFinite() || decimal.lt(0) || decimal.gt(maximum)) invalid();
  }
  if (value.letterGrade !== null && typeof value.letterGrade !== 'string')
    invalid();
  if (
    typeof value.status !== 'string' ||
    !['PASSED', 'FAILED', 'IN_PROGRESS', 'EXEMPT'].includes(value.status)
  )
    invalid();
  if (value.dataSource !== 'EXCEL' && value.dataSource !== 'SCHOOL_DB')
    invalid();
}

@Injectable()
export class GraduationResultChangeScanner {
  private readonly logger = new Logger(GraduationResultChangeScanner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: GraduationScheduler,
  ) {}

  async scan(): Promise<{ receipts: number; targets: number }> {
    const changes = await retryGraduationConflicts(() =>
      this.prisma.academicResultChange.findMany({
        where: { graduationReceipt: null },
        orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
        take: GRADUATION_LIMITS.BATCH_CHUNK_SIZE,
        select: { id: true },
      }),
    ).catch((error: unknown) => {
      const diagnostic = `phase=SELECT ${graduationExecutionError(error)}`;
      if (isGraduationTransactionConflict(error)) {
        this.logger.warn(`GRADUATION_JOB_DEFERRED ${diagnostic}`);
        return [];
      }
      this.logger.error(`GRADUATION_JOB_FAILED ${diagnostic}`);
      throw error;
    });
    let receipts = 0;
    let targets = 0;
    let failed = false;
    for (const change of changes) {
      let phase = 'CONSUME';
      try {
        const tasks = await graduationTransaction(this.prisma, (tx) =>
          this.consume(tx, change.id),
        );
        if (tasks === null) continue;
        receipts += 1;
        targets += tasks.length;
        phase = 'ENQUEUE';
        for (const taskId of tasks) await this.scheduler.enqueueReaudit(taskId);
      } catch (error) {
        const diagnostic = `change=${change.id} phase=${phase} ${graduationExecutionError(error)}`;
        if (phase === 'CONSUME' && isGraduationTransactionConflict(error)) {
          this.logger.warn(`GRADUATION_JOB_DEFERRED ${diagnostic}`);
          continue;
        }
        failed = true;
        this.logger.error(`GRADUATION_JOB_FAILED ${diagnostic}`);
      }
    }
    if (failed) throw new AppException(GRADUATION_ERRORS.JOB_FAILED);
    return { receipts, targets };
  }

  private async consume(
    tx: Prisma.TransactionClient,
    changeId: string,
  ): Promise<string[] | null> {
    const locked = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT "id" FROM "AcademicResultChange" WHERE "id" = ${changeId} FOR UPDATE SKIP LOCKED`;
    if (
      !locked.length ||
      (await tx.graduationResultChangeReceipt.findUnique({
        where: { changeId },
      }))
    )
      return null;
    const change = await tx.academicResultChange.findUniqueOrThrow({
      where: { id: changeId },
      include: {
        academicResult: {
          select: {
            studentId: true,
            courseId: true,
            semesterId: true,
            semester: { select: { startDate: true } },
          },
        },
      },
    });
    validateAcademicResultChangeSnapshot(change.after);
    if (change.before !== null)
      validateAcademicResultChangeSnapshot(change.before);
    if ((change.revision === 1) !== (change.before === null))
      throw new AppException(GRADUATION_ERRORS.INPUT_INVALID);
    const source = change.academicResult;
    if (!source.semester.startDate)
      throw new AppException(GRADUATION_ERRORS.SEMESTER_START_UNKNOWN);
    const where: Prisma.GraduationAuditContextWhereInput = {
      studentId: source.studentId,
      lastAuditId: { not: null },
      OR: [
        { semester: { startDate: { gte: source.semester.startDate } } },
        { semester: { startDate: null } },
      ],
    };
    const candidates = await tx.graduationAuditContext.findMany({
      where,
      orderBy: { id: 'asc' },
      select: { id: true, programId: true },
    });
    await lockPrograms(
      tx,
      candidates.map((context) => context.programId),
    );
    await lockStudents(tx, [source.studentId]);
    if (candidates.length) {
      await tx.$queryRaw`SELECT "id" FROM "GraduationAuditContext" WHERE "id" IN (${Prisma.join(candidates.map((context) => context.id))}) ORDER BY "id" FOR UPDATE`;
    }
    const contexts = await tx.graduationAuditContext.findMany({
      where,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        lastAuditId: true,
        semester: { select: { startDate: true } },
      },
    });
    if (contexts.some((context) => !context.semester.startDate))
      throw new AppException(GRADUATION_ERRORS.SEMESTER_START_UNKNOWN);
    await tx.graduationResultChangeReceipt.create({
      data: {
        changeId,
        targetCount: contexts.length,
        reason: contexts.length ? null : 'NO_PREVIOUS_AUDIT',
      },
    });
    const tasks: string[] = [];
    for (const context of contexts) {
      if (!context.lastAuditId)
        throw new AppException(GRADUATION_ERRORS.INPUT_INVALID);
      const task = await tx.graduationReauditTask.create({
        data: {
          changeId,
          contextId: context.id,
          baselineAuditId: context.lastAuditId,
        },
        select: { id: true },
      });
      tasks.push(task.id);
    }
    return tasks;
  }
}
