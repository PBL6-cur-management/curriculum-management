import { randomUUID } from 'node:crypto';
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../shared/exception/app.exception.js';
import { GraduationAuditWriter } from '../../shared/graduation/graduation-audit.writer.js';
import type { GraduationReaderCapability } from '../../shared/graduation/graduation-capability.js';
import { decodeGraduationInput } from '../../shared/graduation/graduation-input.codec.js';
import { GraduationNotificationsWriter } from '../../shared/graduation/graduation-notifications.writer.js';
import { GRADUATION_LIMITS } from '../../shared/graduation/graduation.constants.js';
import { GRADUATION_ERRORS } from '../../shared/graduation/graduation.errors.js';
import {
  graduationExecutionError,
  isGraduationTransactionConflict,
  retryGraduationConflicts,
} from '../../shared/graduation/graduation-execution-error.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { lockPrograms } from '../../shared/releases/release-locks.js';
import { AcademicResultsReader } from '../../shared/students/academic-results.reader.js';
import { StudentAppliedVersionReader } from '../../shared/students/student-applied-version.reader.js';
import { lockStudents } from '../../shared/students/student-locks.js';
import {
  graduationOperationKey,
  graduationTransaction,
  GraduationLeaseLostError,
  lockGraduationContext,
} from './graduation-jobs.constants.js';
import { GraduationScheduler } from './graduation.scheduler.js';

export function graduationAttemptsCoverChange(
  stored: ReadonlyArray<{ id: string; revision: number }>,
  current: ReadonlyArray<{ id: string; revision: number }>,
  changedResultId: string,
  revision: number,
): boolean {
  const represented = new Map(
    stored.map((attempt) => [attempt.id, attempt.revision]),
  );
  return (
    represented.size === stored.length &&
    represented.size === current.length &&
    (represented.get(changedResultId) ?? 0) >= revision &&
    current.every((attempt) => represented.get(attempt.id) === attempt.revision)
  );
}

@Injectable()
export class GraduationReauditRunner {
  private readonly logger = new Logger(GraduationReauditRunner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly versions: StudentAppliedVersionReader,
    private readonly results: AcademicResultsReader,
    private readonly writer: GraduationAuditWriter,
    private readonly notifications: GraduationNotificationsWriter,
    private readonly scheduler: GraduationScheduler,
  ) {}

  async run(taskId: string): Promise<void> {
    try {
      await this.runTask(taskId);
    } catch (error) {
      if (isGraduationTransactionConflict(error)) {
        this.logger.warn(
          `GRADUATION_JOB_DEFERRED task=${taskId} phase=FAILURE_STATE ${graduationExecutionError(error)}`,
        );
        return;
      }
      throw error;
    }
  }

  private async runTask(taskId: string): Promise<void> {
    const token = randomUUID();
    let claimed = false;
    try {
      const changed = await retryGraduationConflicts(
        () =>
          this.prisma
            .$executeRaw`UPDATE "GraduationReauditTask" SET "status" = 'RUNNING', "leaseToken" = ${token}, "leaseUntil" = clock_timestamp() + ${GRADUATION_LIMITS.LEASE_MS} * interval '1 millisecond' WHERE "id" = ${taskId} AND ("status" = 'PENDING' OR ("status" = 'RUNNING' AND "leaseUntil" <= clock_timestamp()))`,
      );
      if (changed !== 1) return;
      claimed = true;
      await graduationTransaction(this.prisma, (tx) =>
        this.review(tx, taskId, token),
      );
    } catch (error) {
      if (error instanceof GraduationLeaseLostError) throw error;
      if (isGraduationTransactionConflict(error)) {
        if (claimed) await this.deferConflict(taskId, token);
        this.logger.warn(
          `GRADUATION_JOB_DEFERRED task=${taskId} ${graduationExecutionError(error)}`,
        );
        return;
      }
      if (!claimed) {
        this.logger.error(
          `GRADUATION_JOB_FAILED task=${taskId} phase=CLAIM ${graduationExecutionError(error)}`,
        );
        throw error;
      }
      const business =
        error instanceof HttpException && error.getStatus() < 500;
      this.logger.error(
        `GRADUATION_JOB_FAILED task=${taskId} ${graduationExecutionError(error)}`,
      );
      const task = await retryGraduationConflicts(() =>
        this.prisma.graduationReauditTask.findUnique({
          where: { id: taskId },
          select: {
            attempts: true,
            status: true,
            leaseToken: true,
            leaseUntil: true,
          },
        }),
      );
      if (
        !task ||
        task.status !== 'RUNNING' ||
        task.leaseToken !== token ||
        !task.leaseUntil ||
        task.leaseUntil.getTime() <= Date.now()
      ) {
        throw new GraduationLeaseLostError();
      }
      const failed =
        business || task.attempts + 1 >= GRADUATION_LIMITS.JOB_ATTEMPTS;
      await retryGraduationConflicts(() =>
        this.prisma.graduationReauditTask.updateMany({
          where: { id: taskId, status: 'RUNNING', leaseToken: token },
          data: {
            attempts: { increment: 1 },
            status: failed ? 'FAILED' : 'PENDING',
            leaseToken: null,
            leaseUntil: null,
            errorCode: failed
              ? error instanceof AppException
                ? error.code
                : GRADUATION_ERRORS.JOB_FAILED.code
              : null,
            finishedAt: failed ? new Date() : null,
          },
        }),
      );
      if (!business) throw error;
    }
  }

  private async deferConflict(taskId: string, token: string): Promise<void> {
    try {
      await retryGraduationConflicts(() =>
        this.prisma.graduationReauditTask.updateMany({
          where: { id: taskId, status: 'RUNNING', leaseToken: token },
          data: { status: 'PENDING', leaseToken: null, leaseUntil: null },
        }),
      );
    } catch (error) {
      const diagnostic = `task=${taskId} phase=RELEASE ${graduationExecutionError(error)}`;
      if (isGraduationTransactionConflict(error)) {
        this.logger.warn(`GRADUATION_JOB_DEFERRED ${diagnostic}`);
        return;
      }
      this.logger.error(`GRADUATION_JOB_FAILED ${diagnostic}`);
      throw error;
    }
  }

  private async review(
    tx: Prisma.TransactionClient,
    taskId: string,
    token: string,
  ): Promise<void> {
    const initial = await tx.graduationReauditTask.findUniqueOrThrow({
      where: { id: taskId },
      include: { context: true },
    });
    await lockPrograms(tx, [initial.context.programId]);
    await lockStudents(tx, [initial.context.studentId]);
    await lockGraduationContext(tx, initial.contextId);
    const owned = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT "id" FROM "GraduationReauditTask" WHERE "id" = ${taskId} AND "status" = 'RUNNING' AND "leaseToken" = ${token} AND "leaseUntil" > clock_timestamp() FOR UPDATE`;
    if (!owned.length) throw new GraduationLeaseLostError();
    const versionReader = await this.versions.forReauditTask(taskId, token, tx);
    const resultReader = await this.results.forReauditTask(taskId, token, tx);
    const capability: GraduationReaderCapability = {
      resolve: () => versionReader.resolveForStudent(),
      attempts: () => resultReader.forStudent(),
    };
    const task = await tx.graduationReauditTask.findUniqueOrThrow({
      where: { id: taskId },
      include: {
        receipt: { include: { change: true } },
        context: { include: { lastAudit: true } },
      },
    });
    const head = task.context.lastAudit;
    if (!head || task.status !== 'RUNNING' || task.leaseToken !== token)
      throw new GraduationLeaseLostError();
    const stored = decodeGraduationInput(head.inputs);
    const current = await capability.attempts(tx);
    const change = task.receipt.change;
    if (
      graduationAttemptsCoverChange(
        stored.attempts,
        current,
        change.academicResultId,
        change.revision,
      )
    ) {
      await this.finish(tx, taskId, token, 'COVERED', head.id);
      return;
    }
    const audit = await this.writer.append(tx, {
      lookup: versionReader.lookup,
      capability,
      trigger: 'RESULT_CHANGE',
      actorId: null,
      operationKey: graduationOperationKey('RESULT_CHANGE', taskId),
    });
    if (head.conclusion !== audit.result.conclusion) {
      const count = await this.notifications.conclusionChanged(tx, {
        auditId: audit.id,
        context: audit.result.context,
        previous: head.conclusion,
        next: audit.result.conclusion,
      });
      if (!count)
        this.logger.warn(`task=${taskId} audit=${audit.id} recipients=0`);
    }
    await this.finish(tx, taskId, token, 'COMPLETED', audit.id);
  }

  private async finish(
    tx: Prisma.TransactionClient,
    taskId: string,
    token: string,
    status: 'COVERED' | 'COMPLETED',
    auditId: string,
  ): Promise<void> {
    const changed =
      await tx.$executeRaw`UPDATE "GraduationReauditTask" SET "status" = ${status}::"GraduationReauditStatus", "attempts" = "attempts" + 1, "completedAuditId" = ${auditId}, "errorCode" = NULL, "leaseToken" = NULL, "leaseUntil" = NULL, "finishedAt" = clock_timestamp() WHERE "id" = ${taskId} AND "status" = 'RUNNING' AND "leaseToken" = ${token} AND "leaseUntil" > clock_timestamp()`;
    if (changed !== 1) throw new GraduationLeaseLostError();
  }

  async recover(): Promise<number> {
    try {
      return await retryGraduationConflicts(() => this.recoverTasks());
    } catch (error) {
      const diagnostic = `phase=RECOVER ${graduationExecutionError(error)}`;
      if (isGraduationTransactionConflict(error)) {
        this.logger.warn(`GRADUATION_JOB_DEFERRED ${diagnostic}`);
        return 0;
      }
      this.logger.error(`GRADUATION_JOB_FAILED ${diagnostic}`);
      throw error;
    }
  }

  private async recoverTasks(): Promise<number> {
    const tasks = await this.prisma.graduationReauditTask.findMany({
      where: {
        OR: [
          { status: 'PENDING' },
          { status: 'RUNNING', leaseUntil: { lte: new Date() } },
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: GRADUATION_LIMITS.BATCH_CHUNK_SIZE,
      select: { id: true, attempts: true },
    });
    for (const task of tasks) {
      if (task.attempts >= GRADUATION_LIMITS.JOB_ATTEMPTS) {
        await this.prisma.graduationReauditTask.updateMany({
          where: {
            id: task.id,
            OR: [
              { status: 'PENDING' },
              { status: 'RUNNING', leaseUntil: { lte: new Date() } },
            ],
          },
          data: {
            status: 'FAILED',
            errorCode: GRADUATION_ERRORS.JOB_FAILED.code,
            leaseToken: null,
            leaseUntil: null,
            finishedAt: new Date(),
          },
        });
      } else await this.scheduler.enqueueReaudit(task.id);
    }
    return tasks.length;
  }
}
