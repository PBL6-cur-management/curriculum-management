import { randomUUID } from 'node:crypto';
import { HttpException, Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  type GraduationBatchItem,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { ScopeService } from '../../shared/authz/scope.service.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { assertGraduationWrite } from '../../shared/graduation/graduation-access.js';
import { GraduationAuditWriter } from '../../shared/graduation/graduation-audit.writer.js';
import { staffGraduationCapability } from '../../shared/graduation/graduation-capability.js';
import { GRADUATION_LIMITS } from '../../shared/graduation/graduation.constants.js';
import { GRADUATION_ERRORS } from '../../shared/graduation/graduation.errors.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { lockPrograms } from '../../shared/releases/release-locks.js';
import { AcademicResultsReader } from '../../shared/students/academic-results.reader.js';
import { StudentAppliedVersionReader } from '../../shared/students/student-applied-version.reader.js';
import { lockStudents } from '../../shared/students/student-locks.js';
import {
  fenceGraduationLease,
  graduationOperationKey,
  graduationTransaction,
  GraduationLeaseLostError,
  lockGraduationContext,
} from './graduation-jobs.constants.js';
import { GraduationScheduler } from './graduation.scheduler.js';

function rosterDiagnostic(
  identity: Prisma.JsonValue,
): { code: string; message: string } | null {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity))
    return null;
  const diagnostic = identity.rosterDiagnostic;
  if (
    !diagnostic ||
    typeof diagnostic !== 'object' ||
    Array.isArray(diagnostic)
  )
    return null;
  return typeof diagnostic.code === 'string' &&
    typeof diagnostic.message === 'string'
    ? { code: diagnostic.code, message: diagnostic.message }
    : null;
}

@Injectable()
export class GraduationBatchRunner {
  private readonly logger = new Logger(GraduationBatchRunner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: ScopeService,
    private readonly versions: StudentAppliedVersionReader,
    private readonly results: AcademicResultsReader,
    private readonly writer: GraduationAuditWriter,
    private readonly scheduler: GraduationScheduler,
  ) {}

  async run(batchId: string): Promise<void> {
    const token = randomUUID();
    const claimed = await this.prisma
      .$executeRaw`UPDATE "GraduationBatch" SET "status" = 'RUNNING', "leaseToken" = ${token}, "leaseUntil" = clock_timestamp() + ${GRADUATION_LIMITS.LEASE_MS} * interval '1 millisecond', "startedAt" = COALESCE("startedAt", clock_timestamp()) WHERE "id" = ${batchId} AND ("status" = 'QUEUED' OR ("status" = 'RUNNING' AND "leaseUntil" <= clock_timestamp()))`;
    if (claimed !== 1) return;
    try {
      const batch = await this.prisma.graduationBatch.findUniqueOrThrow({
        where: { id: batchId },
      });
      while (true) {
        const items = await this.prisma.graduationBatchItem.findMany({
          where: { batchId, status: 'PENDING' },
          orderBy: [
            { student: { studentCode: 'asc' } },
            { program: { programCode: 'asc' } },
            { id: 'asc' },
          ],
          take: GRADUATION_LIMITS.BATCH_CHUNK_SIZE,
        });
        if (!items.length) break;
        const user = await this.prisma.user.findUnique({
          where: { id: batch.requestedById },
          select: { status: true },
        });
        const access =
          user?.status === 'ACTIVE'
            ? await this.scopes.loadAccess(batch.requestedById)
            : null;
        for (const item of items) await this.reviewItem(item, token, access);
      }
      await graduationTransaction(this.prisma, async (tx) => {
        await fenceGraduationLease(tx, 'BATCH', batchId, token);
        const pending = await tx.graduationBatchItem.count({
          where: { batchId, status: 'PENDING' },
        });
        if (pending) throw new GraduationLeaseLostError();
        const errors = await tx.graduationBatchItem.count({
          where: { batchId, status: 'ERROR' },
        });
        const processed = await tx.graduationBatchItem.count({
          where: { batchId, status: { in: ['REVIEWED', 'ERROR'] } },
        });
        if (processed !== batch.enrollmentCount)
          throw new AppException(GRADUATION_ERRORS.INPUT_INVALID);
        const changed =
          await tx.$executeRaw`UPDATE "GraduationBatch" SET "status" = ${errors ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED'}::"GraduationBatchStatus", "leaseToken" = NULL, "leaseUntil" = NULL, "finishedAt" = clock_timestamp() WHERE "id" = ${batchId} AND "status" = 'RUNNING' AND "leaseToken" = ${token} AND "leaseUntil" > clock_timestamp()`;
        if (changed !== 1) throw new GraduationLeaseLostError();
      });
    } catch (error) {
      if (!(error instanceof GraduationLeaseLostError)) {
        await this.prisma.graduationBatch.updateMany({
          where: { id: batchId, status: 'RUNNING', leaseToken: token },
          data: { status: 'QUEUED', leaseToken: null, leaseUntil: null },
        });
      }
      throw error;
    }
  }

  private async reviewItem(
    item: GraduationBatchItem,
    token: string,
    access: AccessContext | null,
  ): Promise<void> {
    try {
      await graduationTransaction(this.prisma, async (tx) => {
        await lockPrograms(tx, [item.programId]);
        await lockStudents(tx, [item.studentId]);
        const context = await tx.graduationAuditContext.findUnique({
          where: {
            studentId_programId_semesterId: {
              studentId: item.studentId,
              programId: item.programId,
              semesterId: item.semesterId,
            },
          },
        });
        if (context) await lockGraduationContext(tx, context.id);
        const owned = await tx.graduationBatch.findFirst({
          where: {
            id: item.batchId,
            status: 'RUNNING',
            leaseToken: token,
            leaseUntil: { gt: new Date() },
          },
        });
        if (!owned) throw new GraduationLeaseLostError();
        const current = await tx.graduationBatchItem.findUniqueOrThrow({
          where: { id: item.id },
        });
        if (current.status !== 'PENDING') return;
        if (!access) throw new AppException(GRADUATION_ERRORS.ACCESS_REVOKED);
        assertGraduationWrite(access, { programIds: [item.programId] });
        const diagnostic = rosterDiagnostic(item.rosterIdentity);
        if (diagnostic)
          throw new AppException({
            ...GRADUATION_ERRORS.INPUT_INVALID,
            ...diagnostic,
          });
        if (!item.rosterEnrollmentId)
          throw new AppException(GRADUATION_ERRORS.INPUT_INVALID);
        const lookup = {
          studentId: item.studentId,
          programId: item.programId,
          semesterId: item.semesterId,
        };
        const capability = staffGraduationCapability(
          access,
          lookup,
          this.versions,
          this.results,
        );
        const resolved = await capability.resolve(tx);
        if (resolved.enrollmentId !== item.rosterEnrollmentId)
          throw new AppException(GRADUATION_ERRORS.STATE_CHANGED);
        const audit = await this.writer.append(tx, {
          lookup,
          capability,
          trigger: 'BATCH',
          actorId: access.userId,
          operationKey: graduationOperationKey('BATCH', item.batchId, item.id),
        });
        const updated = await tx.graduationBatchItem.updateMany({
          where: { id: item.id, status: 'PENDING' },
          data: {
            status: 'REVIEWED',
            auditId: audit.id,
            finishedAt: new Date(),
          },
        });
        if (updated.count !== 1) throw new GraduationLeaseLostError();
        await fenceGraduationLease(tx, 'BATCH', item.batchId, token);
      });
    } catch (error) {
      if (!(error instanceof HttpException) || error.getStatus() >= 500)
        throw error;
      const definition =
        error instanceof AppException
          ? { code: error.code, message: error.message }
          : {
              code: GRADUATION_ERRORS.ACCESS_REVOKED.code,
              message: GRADUATION_ERRORS.ACCESS_REVOKED.message,
            };
      await graduationTransaction(this.prisma, async (tx) => {
        await tx.graduationBatchItem.updateMany({
          where: { id: item.id, status: 'PENDING' },
          data: {
            status: 'ERROR',
            errorCode: definition.code,
            errorMessage: definition.message,
            finishedAt: new Date(),
          },
        });
        await fenceGraduationLease(tx, 'BATCH', item.batchId, token);
      });
      this.logger.warn(
        `batch=${item.batchId} item=${item.id} code=${definition.code}`,
      );
    }
  }

  async fail(batchId: string): Promise<void> {
    await this.prisma.graduationBatch.updateMany({
      where: { id: batchId, status: 'QUEUED' },
      data: {
        status: 'FAILED',
        failureCode: GRADUATION_ERRORS.JOB_FAILED.code,
        leaseToken: null,
        leaseUntil: null,
        finishedAt: new Date(),
      },
    });
  }

  async recover(): Promise<number> {
    const batches = await this.prisma.graduationBatch.findMany({
      where: {
        OR: [
          { status: 'QUEUED' },
          { status: 'RUNNING', leaseUntil: { lte: new Date() } },
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: GRADUATION_LIMITS.BATCH_CHUNK_SIZE,
      select: { id: true },
    });
    for (const batch of batches) await this.scheduler.enqueueBatch(batch.id);
    return batches.length;
  }
}
