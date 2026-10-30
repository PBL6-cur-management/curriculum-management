import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import {
  NotificationType,
  Prisma,
  SchoolSyncStatus,
  UserStatus,
  type SchoolSyncConfiguration,
  type SchoolSyncTrigger,
  type SyncLog,
} from '../../generated/prisma/client.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { todayDate } from '../../shared/time/today.js';
import { coversDay } from '../../shared/time/validity.js';
import { SchoolSyncCipher } from './school-sync.cipher.js';
import {
  ACADEMIC_OFFICE_ROLE,
  SCHOOL_SYNC_JOBS,
  SCHOOL_SYNC_LIMITS,
  SCHOOL_SYNC_QUEUE,
} from './school-sync.constants.js';
import {
  SCHOOL_SYNC_ERRORS,
  SYNC_FAILURE,
  SyncFailure,
} from './school-sync.errors.js';
import { nextRunAfter } from './school-sync.schedule.js';
import { SchoolSnapshotApplier } from './school-snapshot.applier.js';
import {
  SchoolSourceReader,
  type SchoolConnection,
} from './school-source.reader.js';

export const SINGLETON_KEY = 'SCHOOL_DB';

export interface RunJobPayload {
  runId: string;
}

interface ReserveInput {
  trigger: SchoolSyncTrigger;
  requestKey: string;
  requestedById: string | null;
  retryOfId: string | null;
}

export function isRunnable(config: SchoolSyncConfiguration): boolean {
  return (
    config.mode === 'SCHOOL_DB' &&
    config.verifiedConnectionRevision === config.connectionRevision
  );
}

export function connectionOf(
  config: SchoolSyncConfiguration,
  cipher: SchoolSyncCipher,
): SchoolConnection | null {
  if (
    !config.host || !config.port || !config.database || !config.username ||
    !config.passwordCiphertext || !config.passwordIv || !config.passwordTag ||
    !config.passwordKeyId
  ) {
    return null;
  }
  const password = cipher.open({
    passwordCiphertext: config.passwordCiphertext,
    passwordIv: config.passwordIv,
    passwordTag: config.passwordTag,
    passwordKeyId: config.passwordKeyId,
  });
  if (password === null) return null;
  return {
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password,
  };
}

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

// PostgreSQL owns run state (D5): Redis only carries the run id, so a lost or repeated job changes nothing.
@Injectable()
export class SchoolSyncRunner {
  private readonly logger = new Logger(SchoolSyncRunner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly applier: SchoolSnapshotApplier,
    private readonly source: SchoolSourceReader,
    private readonly cipher: SchoolSyncCipher,
    @InjectQueue(SCHOOL_SYNC_QUEUE) private readonly queue: Queue,
  ) {}

  // 202 semantics: the returned log is RUNNING, not a promise that ingestion will succeed.
  async reserve(input: ReserveInput, now: Date = new Date()): Promise<SyncLog> {
    const repeated = await this.prisma.syncLog.findUnique({
      where: { requestKey: input.requestKey },
    });
    if (repeated) return repeated;
    const config = await this.prisma.schoolSyncConfiguration.findUnique({
      where: { singletonKey: SINGLETON_KEY },
    });
    if (!config || !isRunnable(config)) {
      throw new AppException(SCHOOL_SYNC_ERRORS.NOT_READY);
    }
    let run: SyncLog;
    try {
      run = await this.prisma.syncLog.create({
        data: {
          configurationId: config.id,
          requestKey: input.requestKey,
          profile: config.profile,
          trigger: input.trigger,
          requestedById: input.requestedById,
          retryOfId: input.retryOfId,
          configurationRevision: config.revision,
          startedAt: now,
          expiresAt: new Date(now.getTime() + SCHOOL_SYNC_LIMITS.RUN_DEADLINE_MS),
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Either the same request raced itself, or another run holds the single RUNNING slot.
      const raced = await this.prisma.syncLog.findUnique({
        where: { requestKey: input.requestKey },
      });
      if (raced) return raced;
      throw new AppException(SCHOOL_SYNC_ERRORS.RUN_IN_PROGRESS);
    }
    try {
      await this.queue.add(
        SCHOOL_SYNC_JOBS.RUN,
        { runId: run.id } satisfies RunJobPayload,
        { jobId: `run-${run.id}`, attempts: 1, removeOnComplete: true, removeOnFail: 50 },
      );
    } catch {
      await this.fail(run.id, null, new SyncFailure('DISPATCH_FAILED'));
      return this.prisma.syncLog.findUniqueOrThrow({ where: { id: run.id } });
    }
    return run;
  }

  // Claim -> read the whole source -> one local transaction, fenced by the token and the deadline (D7, D13).
  async execute(runId: string): Promise<void> {
    const token = randomUUID();
    const claimed = await this.prisma.syncLog.updateMany({
      where: {
        id: runId,
        status: SchoolSyncStatus.RUNNING,
        workerToken: null,
        expiresAt: { gt: new Date() },
      },
      data: { workerToken: token },
    });
    // A duplicate job, or one that arrived after the deadline: the owner or the reconciler handles it.
    if (claimed.count === 0) return;
    const run = await this.prisma.syncLog.findUniqueOrThrow({
      where: { id: runId },
      include: { configuration: { include: { mappings: true } } },
    });
    try {
      const connection = connectionOf(run.configuration, this.cipher);
      if (!connection) throw new SyncFailure('CONNECTOR_UNAVAILABLE');
      const snapshot = await this.source.read(connection);
      await this.prisma.$transaction(
        async (tx) => {
          const outcome = await this.applier.apply(
            tx,
            run.configurationId,
            snapshot,
            run.configuration.mappings,
          );
          if (outcome.conflicts.length > 0) {
            await tx.syncConflict.createMany({
              data: outcome.conflicts.map((conflict) => ({
                syncLogId: runId,
                entityType: conflict.entityType,
                recordKey: conflict.recordKey,
                previousSource: 'EXCEL' as const,
                selectedSource: 'SCHOOL_DB' as const,
                fields: conflict.fields,
                before: conflict.before,
                after: conflict.after,
              })),
            });
          }
          const finished = await tx.syncLog.updateMany({
            where: {
              id: runId,
              status: SchoolSyncStatus.RUNNING,
              workerToken: token,
              expiresAt: { gt: new Date() },
            },
            data: {
              status: SchoolSyncStatus.SUCCEEDED,
              finishedAt: new Date(),
              snapshotVersion: snapshot.version,
              studentCount: outcome.studentCount,
              resultCount: outcome.resultCount,
              classCount: outcome.classCount,
              recordCount: outcome.studentCount + outcome.resultCount + outcome.classCount,
              changedCount: outcome.changedCount,
              conflictCount: outcome.conflicts.length,
            },
          });
          // Past the deadline the reconciler may already have failed this run: nothing may commit.
          if (finished.count !== 1) throw new SyncFailure('TIMED_OUT');
          await tx.schoolSyncConfiguration.update({
            where: { id: run.configurationId },
            data: {
              lastSuccessfulRunId: runId,
              lastSnapshotVersion: snapshot.version,
            },
          });
        },
        { timeout: SCHOOL_SYNC_LIMITS.APPLY_TIMEOUT_MS, maxWait: 30_000 },
      );
      this.logger.log(`School sync ${runId} succeeded`);
    } catch (error) {
      await this.fail(runId, token, this.toFailure(error));
    }
  }

  private toFailure(error: unknown): SyncFailure {
    if (error instanceof SyncFailure) return error;
    if (error instanceof AppException) return new SyncFailure('LOCAL_STATE_CHANGED');
    this.logger.error(`School sync failed unexpectedly: ${String(error)}`);
    return new SyncFailure('UNEXPECTED');
  }

  // Terminal once: the status change and the R1 notices commit together, so a replay never notifies twice (D11).
  async fail(runId: string, token: string | null, failure: SyncFailure): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const failed = await tx.syncLog.updateMany({
        where: {
          id: runId,
          status: SchoolSyncStatus.RUNNING,
          ...(token !== null && { workerToken: token }),
        },
        data: {
          status: SchoolSyncStatus.FAILED,
          finishedAt: new Date(),
          errorCode: failure.failure,
          errorMessage: failure.summary,
        },
      });
      if (failed.count !== 1) return false;
      const recipients = await tx.user.findMany({
        where: {
          status: UserStatus.ACTIVE,
          roleAssignments: {
            some: {
              revokedAt: null,
              role: { roleCode: ACADEMIC_OFFICE_ROLE },
              ...coversDay(todayDate()),
            },
          },
        },
        select: { id: true },
      });
      if (recipients.length > 0) {
        await tx.notification.createMany({
          data: recipients.map((recipient) => ({
            recipientId: recipient.id,
            notificationType: NotificationType.SCHOOL_SYNC_FAILED,
            content: `Đồng bộ CSDL Trường thất bại: ${SYNC_FAILURE[failure.failure]} Xem Lịch sử đồng bộ.`,
            changeRequestId: null,
          })),
        });
      }
      this.logger.warn(`School sync ${runId} failed: ${failure.failure}`);
      return true;
    });
  }

  // Every minute: fail runs past their deadline, then start the due scheduled slot (missed slots coalesce, D6).
  async reconcile(now: Date = new Date()): Promise<void> {
    const expired = await this.prisma.syncLog.findMany({
      where: { status: SchoolSyncStatus.RUNNING, expiresAt: { lte: now } },
      select: { id: true },
    });
    for (const run of expired) {
      await this.fail(run.id, null, new SyncFailure('TIMED_OUT'));
    }

    const config = await this.prisma.schoolSyncConfiguration.findUnique({
      where: { singletonKey: SINGLETON_KEY },
    });
    if (!config?.enabled || config.mode !== 'SCHOOL_DB' || !config.nextDueAt) return;
    if (config.nextDueAt.getTime() > now.getTime()) return;
    const slot = config.nextDueAt;
    // Compare-and-set on the slot: with several replicas only one advances it and starts the run.
    const advanced = await this.prisma.schoolSyncConfiguration.updateMany({
      where: { id: config.id, nextDueAt: slot },
      data: { nextDueAt: nextRunAfter(config, now) },
    });
    if (advanced.count !== 1 || !isRunnable(config)) return;
    try {
      await this.reserve(
        {
          trigger: 'SCHEDULED',
          requestKey: `scheduled:${slot.toISOString()}`,
          requestedById: null,
          retryOfId: null,
        },
        now,
      );
    } catch (error) {
      // A run still in progress takes this slot's place; the next slot runs as usual.
      if (!(error instanceof AppException)) throw error;
    }
  }
}
