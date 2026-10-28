import type {
  AcademicResultStatus,
  StudentDataSource,
  StudentStatus,
} from '../../generated/prisma/client.js';
import type { CohortAssignmentFact } from '../releases/applied-version.types.js';

export interface SourceWriteContext {
  source: StudentDataSource;
  actorId: string | null;
}

export type ImportRowAction =
  'CREATE' | 'UPDATE' | 'UNCHANGED' | 'PRESERVE_SOURCE';

export interface StudentProfileValue {
  studentCode: string;
  fullName: string;
  cohortId: string;
  major: string;
  admissionSemesterId: string;
  statusSemesterId: string;
  status: StudentStatus;
}
export interface StudentImportPlanRow {
  rowNumber: number;
  action: ImportRowAction;
  existingId: string | null;
  expectedUpdatedAt: string | null;
  profile: StudentProfileValue;
  programId: string;
  admissionAssignment: CohortAssignmentFact | null;
}
export interface StudentImportPlan {
  rows: StudentImportPlanRow[];
}

export interface AcademicResultValue {
  studentId: string;
  courseId: string;
  semesterId: string;
  score10: string | null;
  score4: string | null;
  letterGrade: string | null;
  status: AcademicResultStatus;
}
export interface AcademicResultPlanRow {
  rowNumber: number;
  action: ImportRowAction;
  existingId: string | null;
  expectedRevision: number | null;
  value: AcademicResultValue;
}
export interface AcademicResultImportPlan {
  rows: AcademicResultPlanRow[];
}
export interface AcademicResultWriteOutcome {
  created: number;
  updated: number;
  unchanged: number;
  sourcePreserved: number;
}
