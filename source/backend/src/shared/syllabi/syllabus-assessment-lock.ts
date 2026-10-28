import type { Prisma } from '../../generated/prisma/client.js';

// A revision that is a request's working copy takes the request row first: submission and approval claim the request
// before touching the copy, so every path locks in the same order. An ordinary Draft has only its own row.
// $queryRaw: SELECT ... FOR UPDATE returns rows, which the driver adapter can read.
export async function lockSyllabusAssessment(
  tx: Prisma.TransactionClient,
  syllabusId: string,
): Promise<void> {
  const revision = await tx.syllabus.findUnique({
    where: { id: syllabusId },
    select: { sourceRequestId: true },
  });
  if (revision?.sourceRequestId) {
    await tx.$queryRaw`SELECT "id" FROM "ChangeRequest" WHERE "id" = ${revision.sourceRequestId} FOR UPDATE`;
  }
  await tx.$queryRaw`SELECT "id" FROM "Syllabus" WHERE "id" = ${syllabusId} FOR UPDATE`;
}
