import type { Prisma } from '../../generated/prisma/client.js';
import type { AccessContext } from '../authz/access-context.js';
import type { AcademicResultsReader } from '../students/academic-results.reader.js';
import type { AcademicAttemptFact } from '../students/best-academic-results.js';
import type { StudentAppliedVersionReader } from '../students/student-applied-version.reader.js';
import type { StudentAppliedVersionResult } from '../students/student-applied-version.types.js';
import type { GraduationLookup } from './graduation.types.js';

export interface GraduationReaderCapability {
  resolve(tx: Prisma.TransactionClient): Promise<StudentAppliedVersionResult>;
  attempts(tx: Prisma.TransactionClient): Promise<AcademicAttemptFact[]>;
}

export function staffGraduationCapability(
  access: AccessContext,
  lookup: GraduationLookup,
  versions: StudentAppliedVersionReader,
  results: AcademicResultsReader,
): GraduationReaderCapability {
  return {
    resolve: (tx) =>
      versions.forAccess(access, 'GRADUATION').resolveForStudent(lookup, tx),
    attempts: (tx) =>
      results.forAccess(access, 'GRADUATION').forStudent(lookup, tx),
  };
}
