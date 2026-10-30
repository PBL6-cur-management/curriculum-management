import { createHash } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client.js';
import { GRADUATION_LIMITS } from '../../shared/graduation/graduation.constants.js';
export { graduationTransaction } from '../../shared/graduation/graduation-audit.writer.js';

export { GRADUATION_QUEUE } from '../../shared/graduation/graduation.constants.js';
export const GRADUATION_JOB = {
  RUN_BATCH: 'run-batch',
  SCAN_CHANGES: 'scan-result-changes',
  RUN_REAUDIT: 'run-reaudit',
  RECOVER: 'recover-graduation',
} as const;
export type GraduationJobData =
  { batchId: string } | { taskId: string } | Record<string, never>;
export const GRADUATION_JOB_HANDLERS = Symbol('GRADUATION_JOB_HANDLERS');
export interface GraduationJobHandlers {
  scanChanges(): Promise<void>;
  runReaudit(taskId: string): Promise<void>;
  recoverReaudits(): Promise<void>;
}
export const GRADUATION_JOB_OPTIONS = {
  attempts: GRADUATION_LIMITS.JOB_ATTEMPTS,
  backoff: { type: 'exponential', delay: GRADUATION_LIMITS.JOB_BACKOFF_MS },
  removeOnComplete: true,
  removeOnFail: true,
} as const;

export class GraduationLeaseLostError extends Error {
  constructor() {
    super('Tác vụ đã hết quyền xử lý; bộ phục hồi sẽ tiếp tục.');
  }
}

export function graduationOperationKey(...parts: string[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

export async function lockGraduationContext(
  tx: Prisma.TransactionClient,
  contextId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "GraduationAuditContext" WHERE "id" = ${contextId} FOR UPDATE`;
}

// The database clock is essential here: a transaction may wait on locks beyond its original lease.
export async function fenceGraduationLease(
  tx: Prisma.TransactionClient,
  kind: 'BATCH' | 'REAUDIT',
  id: string,
  leaseToken: string,
): Promise<void> {
  const changed =
    kind === 'BATCH'
      ? await tx.$executeRaw`UPDATE "GraduationBatch" SET "leaseUntil" = clock_timestamp() + ${GRADUATION_LIMITS.LEASE_MS} * interval '1 millisecond' WHERE "id" = ${id} AND "status" = 'RUNNING' AND "leaseToken" = ${leaseToken} AND "leaseUntil" > clock_timestamp()`
      : await tx.$executeRaw`UPDATE "GraduationReauditTask" SET "leaseUntil" = clock_timestamp() + ${GRADUATION_LIMITS.LEASE_MS} * interval '1 millisecond' WHERE "id" = ${id} AND "status" = 'RUNNING' AND "leaseToken" = ${leaseToken} AND "leaseUntil" > clock_timestamp()`;
  if (changed !== 1) throw new GraduationLeaseLostError();
}
