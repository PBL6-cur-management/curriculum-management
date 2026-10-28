import {
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import {
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import {
  ImportBatchStatus,
  ImportType,
  PermissionMode,
  PermissionScope,
  ProgramVersionStatus,
  ScopeType,
  UserStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { CourseUsageReader } from '../../shared/courses/course-usage.reader.js';
import { lockRequisiteGraph } from '../../shared/courses/requisite-graph.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { programEditState } from '../../shared/programs/program-target.js';
import { AppliedProgramVersionReader } from '../../shared/releases/applied-program-version.reader.js';
import {
  StudentAccountProvisioner,
  type PreparedStudentAccount,
} from '../../shared/students/student-account.provisioner.js';
import { STUDENT_ROLES } from '../../shared/students/student.constants.js';
import { todayDate } from '../../shared/time/today.js';
import { IMPORT_VERSION_SELECT, isStudentImportType } from './import-access.js';
import {
  IMPORT_CATALOG_LOCK_KEY,
  IMPORT_JOB,
  IMPORT_LIMITS,
  IMPORT_QUEUE,
  IMPORT_SWEEP,
  type ImportJobData,
} from './import.constants.js';
import { IMPORT_ABORT_MESSAGE } from './import-errors.js';
import { toReportJson } from './import-mapping.js';
import { readImportSheet, validateImport } from './import-validation.js';
import { StudentCredentialsService } from './student-credentials.service.js';
import type { ImportReport } from './validation/import-report.js';
import { writeAcademicResults } from './writers/academic-result-writer.js';
import { writeCatalog } from './writers/catalog-writer.js';
import { writeCurriculum } from './writers/curriculum-writer.js';
import { writeStudents } from './writers/student-writer.js';

const WORKING_STATES: ImportBatchStatus[] = [
  ImportBatchStatus.VALIDATING,
  ImportBatchStatus.COMMITTING,
];
export function abortReport(
  code: keyof typeof IMPORT_ABORT_MESSAGE,
  report: ImportReport = { formatErrors: [], issues: [] },
): ImportReport {
  return {
    ...report,
    issues: [
      {
        rowNumber: null,
        column: null,
        severity: 'ERROR',
        code,
        message: IMPORT_ABORT_MESSAGE[code],
      },
      ...report.issues,
    ],
  };
}

@Processor(IMPORT_QUEUE)
export class ImportsProcessor
  extends WorkerHost
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ImportsProcessor.name);
  private inFlight: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: CourseUsageReader,
    @InjectQueue(IMPORT_QUEUE)
    private readonly queue: Queue<ImportJobData, void>,
    private readonly appliedVersions: AppliedProgramVersionReader,
    private readonly credentials: StudentCredentialsService,
    private readonly provisioner: StudentAccountProvisioner,
  ) {
    super();
  }

  onApplicationBootstrap(): void {
    void this.schedule().catch((error: unknown) =>
      this.logger.error(`Could not schedule import cleanup: ${String(error)}`),
    );
  }
  async schedule(): Promise<void> {
    await this.queue.upsertJobScheduler(
      IMPORT_SWEEP.SCHEDULER_ID,
      { pattern: IMPORT_SWEEP.CRON, tz: IMPORT_SWEEP.TIME_ZONE },
      {
        name: IMPORT_JOB.SWEEP,
        data: { batchId: '' },
        opts: {
          attempts: IMPORT_LIMITS.JOB_ATTEMPTS,
          backoff: { type: 'exponential', delay: IMPORT_LIMITS.JOB_BACKOFF_MS },
          removeOnComplete: true,
        },
      },
    );
  }
  async process(
    job: Pick<Job<ImportJobData, void>, 'name' | 'data'>,
  ): Promise<void> {
    const run =
      job.name === IMPORT_JOB.VALIDATE
        ? this.validate(job.data.batchId)
        : job.name === IMPORT_JOB.COMMIT
          ? this.commit(job.data.batchId)
          : job.name === IMPORT_JOB.SWEEP
            ? this.sweep()
            : Promise.resolve();
    this.inFlight = run.catch(() => undefined);
    await run;
  }

  private async validate(batchId: string): Promise<void> {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id: batchId },
      include: { file: true },
    });
    if (!batch || batch.status !== ImportBatchStatus.VALIDATING) return;
    if (!batch.file || batch.file.expiresAt <= new Date()) {
      await this.abort(
        this.prisma,
        batchId,
        batch.status,
        batch.totalRows,
        abortReport('JOB_FAILED'),
      );
      return;
    }
    const parsed = await readImportSheet(batch.importType, batch.file.content);
    if (parsed.sheet.formatErrors.length) {
      await this.abort(
        this.prisma,
        batchId,
        batch.status,
        parsed.sheet.rows.length,
        { formatErrors: parsed.sheet.formatErrors, issues: [] },
      );
      return;
    }
    if (
      batch.importType === ImportType.CURRICULUM &&
      !(await this.versionWritable(this.prisma, batch.versionId))
    ) {
      await this.abort(
        this.prisma,
        batchId,
        batch.status,
        parsed.sheet.rows.length,
        abortReport('VERSION_GONE'),
      );
      return;
    }
    const result = await validateImport(
      this.prisma,
      this.usage,
      parsed,
      batch.versionId,
      this.appliedVersions,
    );
    await this.prisma.importBatch.updateMany({
      where: { id: batchId, status: batch.status },
      data: {
        status: result.errorRows
          ? ImportBatchStatus.ABORTED
          : ImportBatchStatus.DRY_RUN,
        totalRows: result.totalRows,
        errorRows: result.errorRows,
        successRows: result.totalRows - result.errorRows,
        errorReport: toReportJson(result.report),
        finishedAt: new Date(),
      },
    });
  }

  private async commit(batchId: string): Promise<void> {
    const initial = await this.prisma.importBatch.findUnique({
      where: { id: batchId },
    });
    if (!initial || initial.status !== ImportBatchStatus.COMMITTING) return;
    if (isStudentImportType(initial.importType)) {
      await this.commitStudentImport(initial);
      return;
    }
    await this.prisma.$transaction(
      async (tx) => {
        await lockRequisiteGraph(tx);
        await tx.$queryRaw`SELECT "id" FROM "ImportBatch" WHERE "id" = ${batchId} FOR UPDATE`;
        const batch = await tx.importBatch.findUnique({
          where: { id: batchId },
          include: { file: true },
        });
        if (!batch || batch.status !== ImportBatchStatus.COMMITTING) return;
        if (batch.importType === ImportType.CURRICULUM) {
          if (batch.versionId)
            await tx.$queryRaw`SELECT "id" FROM "ProgramVersion" WHERE "id" = ${batch.versionId} FOR UPDATE`;
          if (!(await this.versionWritable(tx, batch.versionId))) {
            await this.abort(
              tx,
              batchId,
              batch.status,
              batch.totalRows,
              abortReport('VERSION_GONE'),
            );
            return;
          }
        } else
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${IMPORT_CATALOG_LOCK_KEY})`;
        if (!batch.file || batch.file.expiresAt <= new Date()) {
          await this.abort(
            tx,
            batchId,
            batch.status,
            batch.totalRows,
            abortReport('JOB_FAILED'),
          );
          return;
        }
        const parsed = await readImportSheet(
          batch.importType,
          batch.file.content,
        );
        if (parsed.sheet.formatErrors.length) {
          await this.abort(
            tx,
            batchId,
            batch.status,
            parsed.sheet.rows.length,
            { formatErrors: parsed.sheet.formatErrors, issues: [] },
          );
          return;
        }
        const result = await validateImport(
          tx,
          this.usage,
          parsed,
          batch.versionId,
        );
        if (
          result.importType === ImportType.STUDENT_LIST ||
          result.importType === ImportType.ACADEMIC_RESULT
        )
          throw new Error('Student imports are committed by their own path');
        if (result.errorRows) {
          await this.abort(
            tx,
            batchId,
            batch.status,
            result.totalRows,
            abortReport('CHANGED_SINCE_DRY_RUN', result.report),
          );
          return;
        }
        if (result.importType === ImportType.COURSE_CATALOG)
          await writeCatalog(tx, result.plan);
        else await writeCurriculum(tx, batch.versionId!, result.plan);
        await tx.importBatch.update({
          where: { id: batchId },
          data: {
            status: ImportBatchStatus.COMMITTED,
            totalRows: result.totalRows,
            successRows: result.totalRows,
            errorRows: 0,
            errorReport: toReportJson(result.report),
            finishedAt: new Date(),
          },
        });
      },
      { timeout: IMPORT_LIMITS.TX_TIMEOUT_MS },
    );
  }

  // Hashing is slow, so accounts are prepared before the write transaction takes its locks; the plan is rebuilt under the locks and uses only the accounts it still needs.
  private async prepareAccounts(batch: {
    id: string;
    importType: ImportType;
  }): Promise<PreparedStudentAccount[]> {
    if (batch.importType !== ImportType.STUDENT_LIST) return [];
    const stored = await this.prisma.importBatch.findUnique({
      where: { id: batch.id },
      include: { file: true },
    });
    if (!stored?.file || stored.file.expiresAt <= new Date()) return [];
    const parsed = await readImportSheet(stored.importType, stored.file.content);
    if (parsed.sheet.formatErrors.length) return [];
    const result = await validateImport(
      this.prisma,
      this.usage,
      parsed,
      null,
      this.appliedVersions,
    );
    if (result.importType !== ImportType.STUDENT_LIST || result.errorRows) {
      return [];
    }
    return this.provisioner.prepare(
      result.plan.rows
        .filter((row) => row.existingId === null)
        .map((row) => row.profile.studentCode),
    );
  }

  private async commitStudentImport(initial: {
    id: string;
    importType: ImportType;
  }): Promise<void> {
    const batchId = initial.id;
    const prepared = await this.prepareAccounts(initial);
    await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "ImportBatch" WHERE "id" = ${batchId} FOR UPDATE`;
        const batch = await tx.importBatch.findUnique({
          where: { id: batchId },
          include: { file: true },
        });
        if (!batch || batch.status !== ImportBatchStatus.COMMITTING) return;
        const stop = (
          code: keyof typeof IMPORT_ABORT_MESSAGE,
          totalRows = batch.totalRows,
          report?: ImportReport,
        ) =>
          this.abort(
            tx,
            batchId,
            batch.status,
            totalRows,
            abortReport(code, report),
          );
        if (!(await this.holdsImportGrant(tx, batch.performedById))) {
          await stop('ACCESS_REVOKED');
          return;
        }
        if (!batch.file || batch.file.expiresAt <= new Date()) {
          await stop('JOB_FAILED');
          return;
        }
        const parsed = await readImportSheet(
          batch.importType,
          batch.file.content,
        );
        if (parsed.sheet.formatErrors.length) {
          await this.abort(
            tx,
            batchId,
            batch.status,
            parsed.sheet.rows.length,
            { formatErrors: parsed.sheet.formatErrors, issues: [] },
          );
          return;
        }
        const result = await validateImport(
          tx,
          this.usage,
          parsed,
          null,
          this.appliedVersions,
        );
        if (result.errorRows) {
          await stop('CHANGED_SINCE_DRY_RUN', result.totalRows, result.report);
          return;
        }
        if (result.importType === ImportType.STUDENT_LIST) {
          const written = await writeStudents(
            tx,
            result.plan,
            batch.performedById,
            prepared,
          );
          const created = new Set(written.createdAccountCodes);
          await this.credentials.store(
            tx,
            batchId,
            batch.performedById,
            prepared.filter((account) => created.has(account.studentCode)),
          );
        } else if (result.importType === ImportType.ACADEMIC_RESULT) {
          await writeAcademicResults(tx, result.plan, batch.performedById);
        } else {
          throw new Error('Not a student import');
        }
        await tx.importBatch.update({
          where: { id: batchId },
          data: {
            status: ImportBatchStatus.COMMITTED,
            totalRows: result.totalRows,
            successRows: result.totalRows,
            errorRows: 0,
            errorReport: toReportJson(result.report),
            finishedAt: new Date(),
          },
        });
      },
      { timeout: IMPORT_LIMITS.TX_TIMEOUT_MS },
    );
  }

  // Read from transaction facts, not the request-time AccessContext: a grant revoked between upload and commit must stop the write.
  private async holdsImportGrant(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<boolean> {
    const today = todayDate();
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (user?.status !== UserStatus.ACTIVE) return false;
    const assignment = await tx.roleAssignment.findFirst({
      where: {
        userId,
        scopeType: ScopeType.SYSTEM,
        revokedAt: null,
        validFrom: { lte: today },
        OR: [{ validTo: null }, { validTo: { gte: today } }],
        role: {
          roleCode: STUDENT_ROLES.OFFICE,
          rolePermissions: {
            some: {
              mode: PermissionMode.DIRECT,
              scope: PermissionScope.ALL,
              permission: { permissionCode: PERMISSIONS.DATA_IMPORT_EXCEL },
            },
          },
        },
      },
      select: { id: true },
    });
    return assignment !== null;
  }

  private async versionWritable(
    tx: Prisma.TransactionClient,
    versionId: string | null,
  ): Promise<boolean> {
    if (!versionId) return false;
    const version = await tx.programVersion.findUnique({
      where: { id: versionId },
      select: IMPORT_VERSION_SELECT,
    });
    return (
      !!version &&
      version.status === ProgramVersionStatus.DRAFT &&
      version.sourceRequestId === null &&
      version.correctionOfId === null &&
      !(await programEditState(tx, version.programId)).released
    );
  }

  private async abort(
    tx: Prisma.TransactionClient,
    batchId: string,
    status: ImportBatchStatus,
    totalRows: number,
    report: ImportReport,
  ): Promise<void> {
    await tx.importBatch.updateMany({
      where: { id: batchId, status },
      data: {
        status: ImportBatchStatus.ABORTED,
        totalRows,
        errorRows: totalRows,
        successRows: 0,
        errorReport: toReportJson(report),
        finishedAt: new Date(),
      },
    });
  }

  private async sweep(): Promise<void> {
    const now = new Date();
    const stale: Prisma.ImportBatchWhereInput = {
      status: { in: WORKING_STATES },
      OR: [
        {
          finishedAt: {
            lt: new Date(now.getTime() - IMPORT_LIMITS.STALE_AFTER_MS),
          },
        },
        {
          finishedAt: null,
          recordedAt: {
            lt: new Date(now.getTime() - IMPORT_LIMITS.STALE_AFTER_MS),
          },
        },
      ],
    };
    const batches = await this.prisma.importBatch.findMany({
      where: stale,
      select: { id: true, totalRows: true },
    });
    for (const batch of batches)
      await this.prisma.importBatch.updateMany({
        where: { AND: [{ id: batch.id }, stale] },
        data: {
          status: ImportBatchStatus.ABORTED,
          successRows: 0,
          errorRows: batch.totalRows,
          errorReport: toReportJson(abortReport('STALE')),
          finishedAt: now,
        },
      });
    await this.prisma.importBatchFile.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    await this.credentials.purgeExpired(now);
  }

  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<ImportJobData, void> | undefined,
    error: Error,
  ): Promise<void> {
    const failedBatch = job?.data.batchId
      ? await this.prisma.importBatch.findUnique({
          where: { id: job.data.batchId },
        })
      : null;
    // A student import's error can quote row values (Prisma echoes query parameters), so only the error class and batch id are logged.
    if (failedBatch && isStudentImportType(failedBatch.importType))
      this.logger.error(
        `Import job ${job?.id ?? 'unknown'} failed for batch ${failedBatch.id}: ${error.name}`,
      );
    else
      this.logger.error(
        `Import job ${job?.id ?? 'unknown'} failed: ${error.message}`,
        error.stack,
      );
    if (
      !job ||
      job.name === IMPORT_JOB.SWEEP ||
      job.attemptsMade < (job.opts.attempts ?? 1)
    )
      return;
    const batch = failedBatch;
    if (batch && WORKING_STATES.includes(batch.status))
      await this.abort(
        this.prisma,
        batch.id,
        batch.status,
        batch.totalRows,
        abortReport('JOB_FAILED'),
      );
  }

  async onModuleDestroy(): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.inFlight,
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, IMPORT_LIMITS.SHUTDOWN_GRACE_MS);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    await this.worker.close(true);
    // Nest closes this queue again on application shutdown; force its backend first to avoid waiting for Redis QUIT.
    await this.queue.getBackend().close(true);
  }
}
