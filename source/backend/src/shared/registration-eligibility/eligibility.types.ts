import type {
  AcademicResultStatus,
  CourseStatus,
  Prisma,
} from '../../generated/prisma/client.js';
import type { AcademicAttemptFact } from '../students/best-academic-results.js';
import type { StudentAppliedVersionResult } from '../students/student-applied-version.types.js';
import type {
  ELIGIBILITY_REASON_CODES,
  ELIGIBILITY_VALUES,
  ELIGIBILITY_WARNING_CODES,
} from './eligibility.constants.js';

export type EligibilityValue = (typeof ELIGIBILITY_VALUES)[number];
export type EligibilityReasonCode = (typeof ELIGIBILITY_REASON_CODES)[number];
export type EligibilityWarningCode = (typeof ELIGIBILITY_WARNING_CODES)[number];
export type EligibilityRelation = 'PRIOR' | 'PREREQUISITE' | 'COREQUISITE';
export interface EligibilityCourseRef {
  id: string;
  courseCode: string;
  courseName: string;
  nameSource: 'SNAPSHOT' | 'CATALOG';
}
export interface EligibilityReason {
  code: EligibilityReasonCode;
  causeCode: EligibilityReasonCode | null;
  message: string;
  relationType: EligibilityRelation | null;
  requiredCourse: EligibilityCourseRef | null;
  viaCourse: EligibilityCourseRef | null;
  evidenceCourse: EligibilityCourseRef | null;
  evidenceResultId: string | null;
  requiredScore4: string | null;
  actualScore4: string | null;
  actualStatus: AcademicResultStatus | null;
  path: EligibilityCourseRef[];
}
export interface EligibilityWarning {
  code: EligibilityWarningCode;
  message: string;
  course: EligibilityCourseRef;
}
export interface EligibilityItemAnswer {
  itemId: string;
  course: EligibilityCourseRef;
  credits: string;
  catalogStatus: CourseStatus;
  plannedSemester: number;
  completed: boolean;
  eligibility: EligibilityValue | null;
  statusText: string;
  reasons: EligibilityReason[];
  requiredConcurrentCourses: EligibilityCourseRef[];
}
export interface RegistrationEligibilityAnswer {
  contractVersion: 1;
  context: StudentAppliedVersionResult;
  evaluatedAt: string;
  items: EligibilityItemAnswer[];
  warnings: EligibilityWarning[];
}
export interface EligibilityEvaluationOptions {
  maxDepth: number;
}
export interface EligibilityRequisiteFact {
  id: string;
  targetCourseId: string;
  sourceCourseId: string;
  relationType: EligibilityRelation;
  minScore: Prisma.Decimal | null;
}
export interface EligibilityRowFact {
  itemId: string;
  course: EligibilityCourseRef;
  credits: Prisma.Decimal;
  catalogStatus: CourseStatus;
  plannedSemester: number;
  sortOrder: number;
  minStudiedScore: Prisma.Decimal | null;
  requisites: readonly EligibilityRequisiteFact[];
}
export interface EligibilityCatalogFact {
  course: EligibilityCourseRef;
  status: CourseStatus;
  equivalenceGroupId: string | null;
  activeReplacementIds: readonly string[];
}
export interface EligibilityEvaluationContext {
  resolution: StudentAppliedVersionResult;
  rows: readonly EligibilityRowFact[];
  courses: ReadonlyMap<string, EligibilityCatalogFact>;
  equivalents: ReadonlyMap<string, ReadonlySet<string>>;
  attempts: ReadonlyMap<string, readonly AcademicAttemptFact[]>;
  warnings: readonly EligibilityWarning[];
}
export interface AcademicEvidence {
  attempt: AcademicAttemptFact;
  course: EligibilityCourseRef;
}
