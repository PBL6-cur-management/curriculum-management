import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { AppException } from '../exception/app.exception.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { lockPrograms } from '../releases/release-locks.js';
import { lockStudents } from '../students/student-locks.js';
import type { GraduationReaderCapability } from './graduation-capability.js';
import { GRADUATION_LIMITS } from './graduation.constants.js';
import { GRADUATION_ERRORS } from './graduation.errors.js';
import { retryGraduationConflicts } from './graduation-execution-error.js';
import { GraduationEvaluator } from './graduation-evaluator.js';
import {
  decodeGraduationInput,
  encodeGraduationInput,
} from './graduation-input.codec.js';
import {
  decodeGraduationResult,
  encodeGraduationResult,
} from './graduation-result.codec.js';
import type {
  GraduationAuditValue,
  GraduationLookup,
} from './graduation.types.js';

export const GRADUATION_AUDIT_INCLUDE = {
  context: { include: { semester: true } },
  auditedBy: { select: { id: true, fullName: true } },
} as const satisfies Prisma.GraduationAuditInclude;
type AuditRow = Prisma.GraduationAuditGetPayload<{
  include: typeof GRADUATION_AUDIT_INCLUDE;
}>;

export async function graduationTransaction<T>(
  prisma: PrismaService,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return retryGraduationConflicts(() =>
    prisma.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: GRADUATION_LIMITS.TRANSACTION_TIMEOUT_MS,
      maxWait: GRADUATION_LIMITS.TRANSACTION_MAX_WAIT_MS,
    }),
  );
}

export async function graduationAuditValue(
  tx: Prisma.TransactionClient,
  row: AuditRow,
): Promise<GraduationAuditValue> {
  const result = decodeGraduationResult(row.result);
  const input = decodeGraduationInput(row.inputs);
  const current = await tx.academicResult.findMany({
    where: {
      studentId: row.context.studentId,
      OR: [
        {
          semester: {
            startDate: { lte: row.context.semester.startDate ?? new Date(0) },
          },
        },
        { semester: { startDate: null } },
      ],
    },
    select: {
      id: true,
      revision: true,
      semester: { select: { startDate: true } },
    },
  });
  const revisions = new Map(
    input.attempts.map((attempt) => [attempt.id, attempt.revision]),
  );
  const stale =
    !row.context.semester.startDate ||
    current.length !== revisions.size ||
    current.some(
      (attempt) =>
        !attempt.semester.startDate ||
        revisions.get(attempt.id) !== attempt.revision,
    );
  const tasks = await tx.graduationReauditTask.findMany({
    where: {
      contextId: row.contextId,
      baselineAuditId: row.id,
      status: { in: ['PENDING', 'RUNNING', 'FAILED'] },
    },
    select: { status: true },
  });
  return {
    id: row.id,
    contextId: row.contextId,
    enrollmentId: row.enrollmentId,
    programVersionId: row.programVersionId,
    auditedAt: row.auditedAt.toISOString(),
    auditedBy: row.auditedBy,
    trigger: row.trigger,
    supersedesId: row.supersedesId,
    inputDigest: row.inputDigest,
    result,
    freshness: tasks.some((task) => task.status === 'FAILED')
      ? 'RECHECK_FAILED'
      : stale || tasks.length
        ? 'RECHECK_PENDING'
        : 'CURRENT',
  };
}

@Injectable()
export class GraduationAuditWriter {
  constructor(private readonly evaluator: GraduationEvaluator) {}

  async append(
    tx: Prisma.TransactionClient,
    input: {
      lookup: GraduationLookup;
      capability: GraduationReaderCapability;
      trigger: 'STAFF' | 'BATCH' | 'RESULT_CHANGE';
      actorId: string | null;
      operationKey: string;
    },
  ): Promise<GraduationAuditValue> {
    const previous = await tx.graduationAudit.findUnique({
      where: { operationKey: input.operationKey },
      include: GRADUATION_AUDIT_INCLUDE,
    });
    if (previous) {
      if (
        previous.trigger !== input.trigger ||
        previous.auditedById !== input.actorId ||
        previous.context.studentId !== input.lookup.studentId ||
        previous.context.programId !== input.lookup.programId ||
        previous.context.semesterId !== input.lookup.semesterId
      )
        throw new AppException(GRADUATION_ERRORS.STATE_CHANGED);
      return graduationAuditValue(tx, previous);
    }
    await lockPrograms(tx, [input.lookup.programId]);
    await lockStudents(tx, [input.lookup.studentId]);
    const evaluated = await this.evaluator.evaluate(input.capability, tx);
    const identity = evaluated.result.context;
    if (
      identity.studentId !== input.lookup.studentId ||
      identity.programId !== input.lookup.programId ||
      identity.semesterId !== input.lookup.semesterId
    )
      throw new AppException(GRADUATION_ERRORS.INPUT_INVALID);
    const context = await tx.graduationAuditContext.upsert({
      where: { studentId_programId_semesterId: input.lookup },
      create: input.lookup,
      update: {},
    });
    await tx.$queryRaw`SELECT "id" FROM "GraduationAuditContext" WHERE "id" = ${context.id} FOR UPDATE`;
    const head = await tx.graduationAuditContext.findUniqueOrThrow({
      where: { id: context.id },
    });
    const row = await tx.graduationAudit.create({
      data: {
        contextId: context.id,
        enrollmentId: identity.enrollmentId,
        programVersionId: identity.programVersionId,
        auditedById: input.actorId,
        trigger: input.trigger,
        operationKey: input.operationKey,
        conclusion: evaluated.result.conclusion,
        schemaVersion: evaluated.result.schemaVersion,
        ruleVersion: evaluated.result.ruleVersion,
        shortfalls: JSON.parse(JSON.stringify(evaluated.result.shortfalls)),
        result: encodeGraduationResult(evaluated.result),
        inputs: encodeGraduationInput(evaluated.input),
        inputDigest: evaluated.digest,
        supersedesId: head.lastAuditId,
      },
      include: GRADUATION_AUDIT_INCLUDE,
    });
    await tx.graduationAuditContext.update({
      where: { id: context.id },
      data: { lastAuditId: row.id },
    });
    return graduationAuditValue(tx, row);
  }
}
