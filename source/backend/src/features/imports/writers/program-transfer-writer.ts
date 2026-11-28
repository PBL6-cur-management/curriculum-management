import type { Prisma } from '../../../generated/prisma/client.js';
import { applyEnrollmentCommand } from '../../../shared/students/enrollment.writer.js';
import type { ProgramTransferImportPlan } from '../../../shared/students/student-import.types.js';

// All rows share the caller's transaction, so one failing row rolls the whole file back.
export async function writeProgramTransfers(
  tx: Prisma.TransactionClient,
  plan: ProgramTransferImportPlan,
  actorId: string,
): Promise<void> {
  for (const row of plan.rows)
    await applyEnrollmentCommand(
      tx,
      row.studentId,
      {
        operation: 'TRANSFER',
        targetVersionId: row.targetVersionId,
        trackId: row.trackId ?? undefined,
        fromSemesterId: row.fromSemesterId,
        basisDecision: row.basisDecision,
        sourceEnrollmentId: row.sourceEnrollmentId,
        expectedStudentUpdatedAt: row.studentUpdatedAt,
        expectedEnrollmentUpdatedAt: row.sourceUpdatedAt,
      },
      actorId,
    );
}
