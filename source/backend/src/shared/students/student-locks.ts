import { Prisma } from '../../generated/prisma/client.js';

// Taken after the program locks and before enrollment locks, always in id order, so two writers queue instead of deadlocking.
export async function lockStudents(
  tx: Prisma.TransactionClient,
  studentIds: readonly string[],
): Promise<void> {
  const ids = [...new Set(studentIds)].sort();
  if (ids.length === 0) return;
  await tx.$queryRaw`SELECT "id" FROM "Student" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`;
}

export async function lockEnrollments(
  tx: Prisma.TransactionClient,
  enrollmentIds: readonly string[],
): Promise<void> {
  const ids = [...new Set(enrollmentIds)].sort();
  if (ids.length === 0) return;
  await tx.$queryRaw`SELECT "id" FROM "ProgramEnrollment" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`;
}
