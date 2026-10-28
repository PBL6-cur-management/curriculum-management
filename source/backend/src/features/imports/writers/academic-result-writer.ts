import type { Prisma } from '../../../generated/prisma/client.js';
import { writeAcademicResultSource } from '../../../shared/students/academic-result.writer.js';
import type {
  AcademicResultImportPlan,
  AcademicResultWriteOutcome,
} from '../../../shared/students/student-import.types.js';

export function writeAcademicResults(
  tx: Prisma.TransactionClient,
  plan: AcademicResultImportPlan,
  actorId: string,
): Promise<AcademicResultWriteOutcome> {
  return writeAcademicResultSource(tx, plan, { source: 'EXCEL', actorId });
}
