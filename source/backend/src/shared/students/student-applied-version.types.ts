import type { Prisma } from '../../generated/prisma/client.js';

export interface StudentAppliedVersionLookup {
  studentId: string;
  programId: string;
  semesterId: string;
}
export interface StudentAppliedVersionResult {
  studentId: string;
  enrollmentId: string;
  programId: string;
  semesterId: string;
  programVersionId: string;
  source: 'COHORT' | 'EXCEPTION';
  cohortAssignmentId: string | null;
}
export interface StudentAppliedVersionResolver {
  resolveForStudent(
    input: StudentAppliedVersionLookup,
    tx?: Prisma.TransactionClient,
  ): Promise<StudentAppliedVersionResult>;
}
