import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job, Queue } from 'bullmq';
import {
  ImportBatchStatus,
  ImportType,
  type Prisma,
} from '../../generated/prisma/client.js';
import type { CourseUsageReader } from '../../shared/courses/course-usage.reader.js';
import type { AppliedProgramVersionReader } from '../../shared/releases/applied-program-version.reader.js';
import type { StudentAccountProvisioner } from '../../shared/students/student-account.provisioner.js';
import type { StudentCredentialsService } from './student-credentials.service.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import {
  IMPORT_JOB,
  IMPORT_LIMITS,
  type ImportJobData,
} from './import.constants.js';
import { ImportsProcessor } from './imports.processor.js';
import { readImportSheet, validateImport } from './import-validation.js';
import { writeCatalog } from './writers/catalog-writer.js';
import { writeCurriculum } from './writers/curriculum-writer.js';

vi.mock('./import-validation.js', () => ({
  readImportSheet: vi.fn(),
  validateImport: vi.fn(),
}));
vi.mock('./writers/catalog-writer.js', () => ({ writeCatalog: vi.fn() }));
vi.mock('./writers/curriculum-writer.js', () => ({ writeCurriculum: vi.fn() }));

describe('ImportsProcessor', () => {
  let processor: ImportsProcessor;
  let prisma: PrismaService;
  let findUnique: ReturnType<typeof vi.fn>;
  let updateMany: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let findMany: ReturnType<typeof vi.fn>;
  let deleteMany: ReturnType<typeof vi.fn>;
  let transaction: ReturnType<typeof vi.fn>;
  let version: ReturnType<typeof vi.fn>;
  let released: ReturnType<typeof vi.fn>;
  let raw: ReturnType<typeof vi.fn>;
  let queryRaw: ReturnType<typeof vi.fn>;
  let scheduler: ReturnType<typeof vi.fn>;
  let purgeExpired: ReturnType<typeof vi.fn>;
  let closeQueue: ReturnType<typeof vi.fn>;
  let closeBackend: ReturnType<typeof vi.fn>;
  const batch = (status: ImportBatchStatus = ImportBatchStatus.VALIDATING) => ({
    id: 'batch',
    status,
    importType: ImportType.COURSE_CATALOG,
    versionId: null,
    totalRows: 1,
    file: {
      content: new Uint8Array([1]),
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique = vi.fn().mockResolvedValue(batch());
    updateMany = vi.fn().mockResolvedValue({ count: 1 });
    update = vi.fn().mockResolvedValue({});
    findMany = vi.fn().mockResolvedValue([]);
    deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    raw = vi.fn().mockResolvedValue(1);
    queryRaw = vi.fn().mockResolvedValue([]);
    version = vi.fn().mockResolvedValue({
      id: 'version',
      status: 'DRAFT',
      programId: 'program',
      sourceRequestId: null,
      correctionOfId: null,
    });
    released = vi.fn().mockResolvedValue(null);
    transaction = vi.fn(
      (run: (tx: Prisma.TransactionClient) => Promise<void>) => run(prisma),
    );
    scheduler = vi.fn().mockResolvedValue({});
    purgeExpired = vi.fn().mockResolvedValue(0);
    closeQueue = vi.fn().mockResolvedValue(undefined);
    closeBackend = vi.fn().mockResolvedValue(undefined);
    prisma = {
      importBatch: { findUnique, updateMany, update, findMany },
      importBatchFile: { deleteMany },
      programVersion: { findUnique: version, findFirst: released },
      $executeRaw: raw,
      $queryRaw: queryRaw,
      $transaction: transaction,
    } as unknown as PrismaService;
    processor = new ImportsProcessor(
      prisma,
      {} as CourseUsageReader,
      {
        upsertJobScheduler: scheduler,
        close: closeQueue,
        getBackend: () => ({ close: closeBackend }),
      } as unknown as Queue<ImportJobData, void>,
      {} as AppliedProgramVersionReader,
      { purgeExpired } as unknown as StudentCredentialsService,
      {} as StudentAccountProvisioner,
    );
    vi.mocked(readImportSheet).mockResolvedValue({
      importType: ImportType.COURSE_CATALOG,
      sheet: { header: {}, rows: [], formatErrors: [], unknownColumns: [] },
    });
    vi.mocked(validateImport).mockResolvedValue({
      importType: ImportType.COURSE_CATALOG,
      totalRows: 1,
      errorRows: 0,
      report: { formatErrors: [], issues: [] },
      plan: { creates: [], updates: [] },
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  const job = (name: string) => ({ name, data: { batchId: 'batch' } });

  it('does not validate or write a terminal batch, nor an unknown job', async () => {
    findUnique.mockResolvedValue(batch(ImportBatchStatus.COMMITTED));
    await processor.process(job(IMPORT_JOB.VALIDATE));
    await processor.process(job('unknown'));
    expect(readImportSheet).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });
  it('stores format errors without loading context or writing domain data', async () => {
    vi.mocked(readImportSheet).mockResolvedValue({
      importType: ImportType.COURSE_CATALOG,
      sheet: {
        header: {},
        rows: [],
        unknownColumns: [],
        formatErrors: [{ column: 'Mã HP', message: 'Thiếu cột' }],
      },
    });
    await processor.process(job(IMPORT_JOB.VALIDATE));
    expect(updateMany.mock.calls[0][0].data).toMatchObject({
      status: ImportBatchStatus.ABORTED,
      totalRows: 0,
      successRows: 0,
      errorRows: 0,
      errorReport: {
        formatErrors: [{ column: 'Mã HP', message: 'Thiếu cột' }],
      },
    });
    expect(validateImport).not.toHaveBeenCalled();
    expect(writeCatalog).not.toHaveBeenCalled();
  });
  it('writes dry-run totals under a state compare-and-set', async () => {
    await processor.process(job(IMPORT_JOB.VALIDATE));
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'batch', status: ImportBatchStatus.VALIDATING },
        data: expect.objectContaining({
          status: ImportBatchStatus.DRY_RUN,
          totalRows: 1,
          successRows: 1,
          errorRows: 0,
          finishedAt: expect.any(Date),
        }),
      }),
    );
  });
  it('locks before commit, rechecks state inside the transaction, and commits data and status together', async () => {
    findUnique.mockResolvedValue(batch(ImportBatchStatus.COMMITTING));
    await processor.process(job(IMPORT_JOB.COMMIT));
    expect(raw).toHaveBeenCalledTimes(2);
    expect(queryRaw).toHaveBeenCalledOnce();
    expect(raw.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(validateImport).mock.invocationCallOrder[0],
    );
    expect(writeCatalog).toHaveBeenCalledWith(prisma, {
      creates: [],
      updates: [],
    });
    expect(update.mock.calls[0][0].data).toMatchObject({
      status: ImportBatchStatus.COMMITTED,
      successRows: 1,
    });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: IMPORT_LIMITS.TX_TIMEOUT_MS,
    });
  });
  it('does not repeat a commit whose locked batch is already committed', async () => {
    findUnique
      .mockResolvedValueOnce(batch(ImportBatchStatus.COMMITTING))
      .mockResolvedValueOnce(batch(ImportBatchStatus.COMMITTED));
    await processor.process(job(IMPORT_JOB.COMMIT));
    expect(writeCatalog).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
  it('aborts a changed file with a new report and no domain writes', async () => {
    findUnique.mockResolvedValue(batch(ImportBatchStatus.COMMITTING));
    vi.mocked(validateImport).mockResolvedValue({
      importType: ImportType.COURSE_CATALOG,
      totalRows: 2,
      errorRows: 1,
      plan: { creates: [], updates: [] },
      report: {
        formatErrors: [],
        issues: [
          {
            rowNumber: 4,
            severity: 'ERROR',
            column: 'Mã HP',
            code: 'COURSE_CANCELLED',
            message: 'Đã hủy',
          },
        ],
      },
    });
    await processor.process(job(IMPORT_JOB.COMMIT));
    expect(writeCatalog).not.toHaveBeenCalled();
    expect(writeCurriculum).not.toHaveBeenCalled();
    expect(updateMany.mock.calls[0][0].data).toMatchObject({
      status: ImportBatchStatus.ABORTED,
      successRows: 0,
      errorRows: 2,
      totalRows: 2,
      errorReport: {
        issues: [
          expect.objectContaining({ code: 'CHANGED_SINCE_DRY_RUN' }),
          expect.objectContaining({ code: 'COURSE_CANCELLED' }),
        ],
      },
    });
  });
  it('refuses a program released after dry-run and a missing target version', async () => {
    findUnique.mockResolvedValue({
      ...batch(ImportBatchStatus.COMMITTING),
      importType: ImportType.CURRICULUM,
      versionId: 'version',
    });
    released.mockResolvedValue({ id: 'published' });
    await processor.process(job(IMPORT_JOB.COMMIT));
    expect(updateMany.mock.calls[0][0].data.errorReport.issues[0].code).toBe(
      'VERSION_GONE',
    );
    expect(validateImport).not.toHaveBeenCalled();
    released.mockResolvedValue(null);
    version.mockResolvedValue(null);
    await processor.process(job(IMPORT_JOB.COMMIT));
    expect(writeCurriculum).not.toHaveBeenCalled();
  });
  it('propagates a writer failure to roll back and let BullMQ retry', async () => {
    findUnique.mockResolvedValue(batch(ImportBatchStatus.COMMITTING));
    vi.mocked(writeCatalog).mockRejectedValueOnce(new Error('write failed'));
    await expect(processor.process(job(IMPORT_JOB.COMMIT))).rejects.toThrow(
      'write failed',
    );
    expect(update).not.toHaveBeenCalled();
  });
  it('only aborts on the final failed attempt and never changes a terminal batch', async () => {
    const failed = {
      name: IMPORT_JOB.VALIDATE,
      id: 'job',
      data: { batchId: 'batch' },
      attemptsMade: 1,
      opts: { attempts: 3 },
    } as Job<ImportJobData, void>;
    await processor.onFailed(failed, new Error('retry'));
    expect(updateMany).not.toHaveBeenCalled();
    failed.attemptsMade = 3;
    await processor.onFailed(failed, new Error('final'));
    expect(updateMany.mock.calls[0][0].data).toMatchObject({
      status: ImportBatchStatus.ABORTED,
      errorRows: 1,
      successRows: 0,
    });
    updateMany.mockClear();
    findUnique.mockResolvedValue(batch(ImportBatchStatus.COMMITTED));
    await processor.onFailed(failed, new Error('late'));
    expect(updateMany).not.toHaveBeenCalled();
  });
  it('sweeps interrupted batches, rechecks their stale predicate, and only deletes expired files', async () => {
    findMany.mockResolvedValue([{ id: 'batch', totalRows: 2 }]);
    await processor.process(job(IMPORT_JOB.SWEEP));
    expect(updateMany.mock.calls[0][0]).toMatchObject({
      where: {
        AND: [
          { id: 'batch' },
          expect.objectContaining({
            status: { in: ['VALIDATING', 'COMMITTING'] },
            OR: expect.any(Array),
          }),
        ],
      },
      data: {
        errorRows: 2,
        successRows: 0,
        errorReport: { issues: [expect.objectContaining({ code: 'STALE' })] },
      },
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lte: expect.any(Date) } },
    });
  });
  it('registers an idempotent cleanup scheduler without blocking bootstrap', async () => {
    await processor.schedule();
    expect(scheduler).toHaveBeenCalledWith(
      'imports-sweep',
      expect.objectContaining({ pattern: '0 2 * * *' }),
      expect.objectContaining({ name: 'sweep' }),
    );
    scheduler.mockRejectedValueOnce(new Error('Redis offline'));
    expect(processor.onApplicationBootstrap()).toBeUndefined();
    await Promise.resolve();
    await Promise.resolve();
  });
  it('bounds in-flight grace before force-closing the worker and queue backend', async () => {
    vi.useFakeTimers();
    const close = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(processor, 'worker', { value: { close } });
    closeQueue.mockImplementation(() => new Promise(() => undefined));
    findUnique.mockImplementation(() => new Promise(() => undefined));
    void processor.process(job(IMPORT_JOB.VALIDATE));
    const stopping = processor.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(IMPORT_LIMITS.SHUTDOWN_GRACE_MS - 1);
    expect(close).not.toHaveBeenCalled();
    expect(closeBackend).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await stopping;
    expect(close).toHaveBeenCalledWith(true);
    expect(closeBackend).toHaveBeenCalledExactlyOnceWith(true);
    expect(closeQueue).not.toHaveBeenCalled();
    expect(close.mock.invocationCallOrder[0]).toBeLessThan(
      closeBackend.mock.invocationCallOrder[0],
    );
    expect(vi.getTimerCount()).toBe(0);
  });
  it('lets an in-flight job finish before the grace deadline and clears the timer', async () => {
    vi.useFakeTimers();
    const close = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(processor, 'worker', { value: { close } });
    let finish!: (value: null) => void;
    findUnique.mockReturnValue(
      new Promise<null>((resolve) => {
        finish = resolve;
      }),
    );
    const running = processor.process(job(IMPORT_JOB.VALIDATE));
    const stopping = processor.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(close).not.toHaveBeenCalled();
    expect(closeBackend).not.toHaveBeenCalled();
    finish(null);
    await running;
    await stopping;
    expect(close).toHaveBeenCalledWith(true);
    expect(closeBackend).toHaveBeenCalledWith(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not await a pending cleanup scheduler or grace when idle', async () => {
    vi.useFakeTimers();
    const close = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(processor, 'worker', { value: { close } });
    scheduler.mockImplementation(() => new Promise(() => undefined));
    expect(processor.onApplicationBootstrap()).toBeUndefined();
    await processor.onModuleDestroy();
    expect(scheduler).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledWith(true);
    expect(closeBackend).toHaveBeenCalledWith(true);
    expect(closeQueue).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
