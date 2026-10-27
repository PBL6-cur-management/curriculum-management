import type {
  Cohort,
  ProgramVersionStatus,
} from '../../generated/prisma/client.js';
import type { StartedSemester } from './semester-start.js';

export type IssuedStatus = Exclude<ProgramVersionStatus, 'DRAFT'>;
export interface IssuedVersionFact {
  id: string;
  programId: string;
  versionNumber: string;
  status: IssuedStatus;
  decisionNumber: string;
  effectiveSemester: StartedSemester;
  publishedAt: Date;
}
export interface CohortAssignmentFact {
  id: string;
  cohort: Pick<Cohort, 'id' | 'cohortCode' | 'intakeYear'>;
  version: IssuedVersionFact;
  fromSemester: StartedSemester;
  createdAt: Date;
}
export interface CohortVersionResolution {
  programId: string;
  cohort: Pick<Cohort, 'id' | 'cohortCode' | 'intakeYear'>;
  semester: StartedSemester;
  assignment: CohortAssignmentFact | null;
}
export interface CohortVersionLookup {
  programId: string;
  cohortId: string;
  semesterId: string;
}
export interface CohortVersionsLookup {
  programId: string;
  cohortIds: readonly string[];
  semesterId: string;
}
