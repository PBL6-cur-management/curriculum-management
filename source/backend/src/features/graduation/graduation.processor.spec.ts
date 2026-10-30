import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScopeSource, ScopeType } from '../../generated/prisma/client.js';
import { AccessContext } from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import type { ScopeService } from '../../shared/authz/scope.service.js';
import { AppException } from '../../shared/exception/app.exception.js';
import type { GraduationAuditWriter } from '../../shared/graduation/graduation-audit.writer.js';
import { GRADUATION_LIMITS } from '../../shared/graduation/graduation.constants.js';
import { GRADUATION_ERRORS } from '../../shared/graduation/graduation.errors.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import type { AcademicResultsReader } from '../../shared/students/academic-results.reader.js';
import type { StudentAppliedVersionReader } from '../../shared/students/student-applied-version.reader.js';
import { GraduationBatchRunner } from './graduation-batch.runner.js';
import {
  GRADUATION_JOB,
  GRADUATION_JOB_OPTIONS,
  GraduationLeaseLostError,
  type GraduationJobData,
  type GraduationJobHandlers,
} from './graduation-jobs.constants.js';
import { GraduationProcessor } from './graduation.processor.js';
import { GraduationScheduler } from './graduation.scheduler.js';

function job(
  name: string,
  data: GraduationJobData = {},
  attemptsMade = 0,
): Job<GraduationJobData> {
  return {
    name,
    data,
    attemptsMade,
    opts: { attempts: GRADUATION_LIMITS.JOB_ATTEMPTS },
    id: 'synthetic-job',
  } as Job<GraduationJobData>;
}

beforeEach(() => {
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('GraduationProcessor', () => {
  function fixture() {
    const batches = {
      run: vi.fn().mockResolvedValue(undefined),
      recover: vi.fn().mockResolvedValue(0),
      fail: vi.fn().mockResolvedValue(undefined),
    };
    const handlers = {
      scanChanges: vi.fn().mockResolvedValue(undefined),
      runReaudit: vi.fn().mockResolvedValue(undefined),
      recoverReaudits: vi.fn().mockResolvedValue(undefined),
    } satisfies GraduationJobHandlers;
    const processor = new GraduationProcessor(
      batches as unknown as GraduationBatchRunner,
      handlers,
    );
    return { processor, batches, handlers };
  }

  it('dispatches every named handler with ID-only payloads', async () => {
    const { processor, batches, handlers } = fixture();
    await processor.process(
      job(GRADUATION_JOB.RUN_BATCH, { batchId: 'batch' }),
    );
    await processor.process(
      job(GRADUATION_JOB.RUN_REAUDIT, { taskId: 'task' }),
    );
    await processor.process(job(GRADUATION_JOB.SCAN_CHANGES));
    await processor.process(job(GRADUATION_JOB.RECOVER));
    expect(batches.run).toHaveBeenCalledExactlyOnceWith('batch');
    expect(handlers.runReaudit).toHaveBeenCalledExactlyOnceWith('task');
    expect(batches.recover).toHaveBeenCalledOnce();
    expect(handlers.recoverReaudits).toHaveBeenCalledOnce();
    expect(handlers.scanChanges).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['unknown', {}],
    [GRADUATION_JOB.RUN_BATCH, {}],
    [GRADUATION_JOB.RUN_REAUDIT, {}],
  ])('rejects malformed dispatch %s', async (name, data) => {
    await expect(
      fixture().processor.process(job(name, data)),
    ).rejects.toThrow();
  });

  it('rethrows infrastructure errors and persists final batch exhaustion only', async () => {
    const { processor, batches } = fixture();
    batches.run.mockRejectedValue(new Error('synthetic database unavailable'));
    await expect(
      processor.process(job(GRADUATION_JOB.RUN_BATCH, { batchId: 'batch' })),
    ).rejects.toThrow('synthetic database');
    expect(batches.fail).not.toHaveBeenCalled();
    await expect(
      processor.process(job(GRADUATION_JOB.RUN_BATCH, { batchId: 'batch' }, 2)),
    ).rejects.toThrow();
    expect(batches.fail).toHaveBeenCalledExactlyOnceWith('batch');
  });

  it('does not mark a batch failed when a stale lease loses to recovery', async () => {
    const { processor, batches } = fixture();
    batches.run.mockRejectedValue(new GraduationLeaseLostError());
    await processor.process(
      job(GRADUATION_JOB.RUN_BATCH, { batchId: 'batch' }, 2),
    );
    expect(batches.fail).not.toHaveBeenCalled();
  });

  it('bounds shutdown of stalled work and stops accepting new jobs', async () => {
    vi.useFakeTimers();
    const { processor, batches } = fixture();
    let release!: () => void;
    batches.run.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const worker = {
      pause: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    Object.defineProperty(processor, 'worker', { value: worker });
    const processing = processor.process(
      job(GRADUATION_JOB.RUN_BATCH, { batchId: 'batch' }),
    );
    const stopping = processor.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(GRADUATION_LIMITS.SHUTDOWN_GRACE_MS);
    await stopping;
    expect(worker.pause).toHaveBeenCalledExactlyOnceWith(true);
    expect(worker.close).toHaveBeenCalledExactlyOnceWith(true);
    await expect(
      processor.process(job(GRADUATION_JOB.SCAN_CHANGES)),
    ).rejects.toThrow();
    release();
    await processing;
  });
});

describe('GraduationScheduler', () => {
  function fixture() {
    const queue = {
      add: vi.fn().mockResolvedValue({}),
      upsertJobScheduler: vi.fn().mockResolvedValue({}),
    };
    return {
      queue,
      scheduler: new GraduationScheduler(queue as unknown as Queue),
    };
  }
  it('registers durable cadences and immediate recovery without blocking bootstrap', async () => {
    const { queue, scheduler } = fixture();
    expect(scheduler.onApplicationBootstrap()).toBeUndefined();
    await vi.waitFor(() => expect(queue.add).toHaveBeenCalledOnce());
    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(2);
    expect(queue.upsertJobScheduler.mock.calls[0]).toEqual([
      GRADUATION_JOB.SCAN_CHANGES,
      { every: GRADUATION_LIMITS.SCAN_INTERVAL_MS },
      {
        name: GRADUATION_JOB.SCAN_CHANGES,
        data: {},
        opts: GRADUATION_JOB_OPTIONS,
      },
    ]);
    scheduler.onModuleDestroy();
  });
  it('retries registration after Redis failure and clears its timer on shutdown', async () => {
    vi.useFakeTimers();
    const { queue, scheduler } = fixture();
    queue.upsertJobScheduler.mockRejectedValueOnce(
      new Error('synthetic redis'),
    );
    await scheduler.schedule();
    await vi.advanceTimersByTimeAsync(GRADUATION_LIMITS.SCAN_INTERVAL_MS);
    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(3);
    scheduler.onModuleDestroy();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('uses ID-only payloads and colon-free job IDs', async () => {
    const { queue, scheduler } = fixture();
    await scheduler.enqueueBatch('batch');
    await scheduler.enqueueReaudit('task');
    expect(queue.add.mock.calls).toEqual([
      [
        GRADUATION_JOB.RUN_BATCH,
        { batchId: 'batch' },
        { ...GRADUATION_JOB_OPTIONS, jobId: 'graduation-batch-batch' },
      ],
      [
        GRADUATION_JOB.RUN_REAUDIT,
        { taskId: 'task' },
        { ...GRADUATION_JOB_OPTIONS, jobId: 'graduation-reaudit-task' },
      ],
    ]);
  });
});

describe('GraduationBatchRunner', () => {
  function fixture() {
    const access = new AccessContext('reviewer', [
      {
        assignmentId: 'assignment',
        roleId: 'office',
        roleCode: 'R1',
        roleName: 'Office',
        scopeSource: ScopeSource.NONE,
        scopeType: ScopeType.SYSTEM,
        scopeUnit: null,
        scope: { all: true },
        permissions: new Map([
          [PERMISSIONS.GRADUATION_AUDIT, { mode: 'DIRECT', scope: 'ALL' }],
        ]),
      },
    ]);
    const item = {
      id: 'item',
      batchId: 'batch',
      studentId: 'student',
      programId: 'program',
      semesterId: 'semester',
      rosterEnrollmentId: 'enrollment',
      rosterIdentity: {},
      status: 'PENDING',
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      $executeRaw: vi.fn().mockResolvedValue(1),
      graduationAuditContext: {
        findUnique: vi.fn().mockResolvedValue({ id: 'context' }),
      },
      graduationBatch: {
        findFirst: vi.fn().mockResolvedValue({ id: 'batch' }),
      },
      graduationBatchItem: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(item),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        count: vi
          .fn()
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(1),
      },
    };
    const prisma = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      $transaction: vi.fn(
        async (work: (value: typeof tx) => Promise<unknown>) => work(tx),
      ),
      graduationBatch: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ requestedById: 'reviewer', enrollmentCount: 1 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([{ id: 'batch' }]),
      },
      graduationBatchItem: {
        findMany: vi.fn().mockResolvedValueOnce([item]).mockResolvedValue([]),
      },
      user: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE' }) },
    };
    const resolve = vi.fn().mockResolvedValue({ enrollmentId: 'enrollment' });
    const versions = {
      forAccess: vi.fn().mockReturnValue({ resolveForStudent: resolve }),
    };
    const results = {
      forAccess: vi.fn().mockReturnValue({ forStudent: vi.fn() }),
    };
    const writer = { append: vi.fn().mockResolvedValue({ id: 'audit' }) };
    const scheduler = { enqueueBatch: vi.fn().mockResolvedValue(undefined) };
    const runner = new GraduationBatchRunner(
      prisma as unknown as PrismaService,
      {
        loadAccess: vi.fn().mockResolvedValue(access),
      } as unknown as ScopeService,
      versions as unknown as StudentAppliedVersionReader,
      results as unknown as AcademicResultsReader,
      writer as unknown as GraduationAuditWriter,
      scheduler as unknown as GraduationScheduler,
    );
    return { runner, prisma, tx, writer, resolve, item, scheduler };
  }

  it('writes each item/audit and the final database-clock lease fence in one transaction', async () => {
    const { runner, writer, tx } = fixture();
    await runner.run('batch');
    expect(writer.append).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        trigger: 'BATCH',
        actorId: 'reviewer',
        operationKey: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(tx.graduationBatchItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'REVIEWED', auditId: 'audit' }),
      }),
    );
    const fence = tx.$executeRaw.mock.calls[0][0] as TemplateStringsArray;
    expect(fence.join('')).toContain('clock_timestamp()');
    expect(writer.append.mock.invocationCallOrder[0]).toBeLessThan(
      tx.$executeRaw.mock.invocationCallOrder[0],
    );
  });
  it('does nothing after terminal/already-owned claims', async () => {
    const { runner, prisma, writer } = fixture();
    prisma.$executeRaw.mockResolvedValue(0);
    await runner.run('batch');
    expect(writer.append).not.toHaveBeenCalled();
  });
  it('records business inability separately without creating an audit', async () => {
    const { runner, resolve, tx, writer } = fixture();
    resolve.mockRejectedValue(
      new AppException(GRADUATION_ERRORS.APPLIED_VERSION_UNRESOLVED),
    );
    tx.graduationBatchItem.count
      .mockReset()
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    await runner.run('batch');
    expect(writer.append).not.toHaveBeenCalled();
    expect(tx.graduationBatchItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'ERROR',
          errorCode: GRADUATION_ERRORS.APPLIED_VERSION_UNRESOLVED.code,
        }),
      }),
    );
  });
  it('rejects enrollment identity drift instead of reviewing a different enrollment', async () => {
    const { runner, resolve, tx, writer } = fixture();
    resolve.mockResolvedValue({ enrollmentId: 'other' });
    await runner.run('batch');
    expect(writer.append).not.toHaveBeenCalled();
    expect(tx.graduationBatchItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          errorCode: 'GRADUATION_STATE_CHANGED',
        }),
      }),
    );
  });
  it('honors frozen roster diagnostics before resolution', async () => {
    const { runner, item, resolve, tx } = fixture();
    Object.assign(item, {
      rosterEnrollmentId: null,
      rosterIdentity: {
        rosterDiagnostic: {
          code: 'ENROLLMENT_AMBIGUOUS',
          message: 'Cần sửa các khoảng theo học bị trùng.',
        },
      },
    });
    await runner.run('batch');
    expect(resolve).not.toHaveBeenCalled();
    expect(tx.graduationBatchItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ errorCode: 'ENROLLMENT_AMBIGUOUS' }),
      }),
    );
  });
  it('handles a revoked requester as an item error, never an academic conclusion', async () => {
    const { runner, prisma, writer, tx } = fixture();
    prisma.user.findUnique.mockResolvedValue({ status: 'INACTIVE' });
    await runner.run('batch');
    expect(writer.append).not.toHaveBeenCalled();
    expect(tx.graduationBatchItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          errorCode: 'GRADUATION_ACCESS_REVOKED',
        }),
      }),
    );
  });
  it('loses a lease after append without committing an item error or releasing another owner', async () => {
    const { runner, tx, prisma } = fixture();
    tx.$executeRaw.mockResolvedValue(0);
    await expect(runner.run('batch')).rejects.toBeInstanceOf(
      GraduationLeaseLostError,
    );
    expect(tx.graduationBatchItem.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.graduationBatch.updateMany).not.toHaveBeenCalled();
  });
  it('rethrows infrastructure errors and leaves the batch recoverable', async () => {
    const { runner, writer, prisma } = fixture();
    writer.append.mockRejectedValue(new Error('synthetic database'));
    await expect(runner.run('batch')).rejects.toThrow('synthetic database');
    expect(prisma.graduationBatch.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'QUEUED' }),
      }),
    );
  });
  it('recovers queued and expired work only, preserving completed items', async () => {
    const { runner, scheduler, prisma } = fixture();
    await expect(runner.recover()).resolves.toBe(1);
    expect(prisma.graduationBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { status: 'QUEUED' },
            { status: 'RUNNING', leaseUntil: { lte: expect.any(Date) } },
          ],
        },
      }),
    );
    expect(scheduler.enqueueBatch).toHaveBeenCalledExactlyOnceWith('batch');
    await runner.fail('batch');
    expect(prisma.graduationBatch.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'batch', status: 'QUEUED' },
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });
});
