import type { Prisma } from '../../../generated/prisma/client.js';
import type { PreparedStudentAccount } from '../../../shared/students/student-account.provisioner.js';
import type { StudentImportPlan } from '../../../shared/students/student-import.types.js';
import {
  writeStudentSource,
  type StudentSourceWriteOutcome,
} from '../../../shared/students/student-source.writer.js';

// An Excel file can only claim EXCEL provenance; the official source is reserved for the school-database synchronisation.
export function writeStudents(
  tx: Prisma.TransactionClient,
  plan: StudentImportPlan,
  actorId: string,
  accounts: readonly PreparedStudentAccount[],
): Promise<StudentSourceWriteOutcome> {
  return writeStudentSource(tx, plan, { source: 'EXCEL', actorId }, accounts);
}
