export type GraduationConclusion = 'ELIGIBLE' | 'NOT_ELIGIBLE';
export interface GraduationAuditValue {
  id: string;
  contextId: string;
  enrollmentId: string;
  programVersionId: string;
  auditedAt: string;
  auditedBy: { id: string; fullName: string } | null;
  trigger: 'STAFF' | 'BATCH' | 'RESULT_CHANGE';
  supersedesId: string | null;
  inputDigest: string;
  result: GraduationResult;
  freshness: 'CURRENT' | 'RECHECK_PENDING' | 'RECHECK_FAILED';
}
export type ShortfallCategory =
  | 'MANDATORY_COURSE'
  | 'ELECTIVE_GROUP'
  | 'TOTAL_CREDITS'
  | 'CONDITIONAL_COURSE';
export type CreditBasis = 'APPLIED_VERSION_SNAPSHOT' | 'CURRENT_CATALOG';
export type CompletionReason = 'NOT_TAKEN' | 'FAILED' | 'IN_PROGRESS';
export interface GraduationLookup {
  studentId: string;
  programId: string;
  semesterId: string;
}
export interface GraduationCourseRef {
  id: string;
  courseCode: string;
  courseName: string;
}
export interface GraduationContextValue extends GraduationLookup {
  enrollmentId: string;
  studentCode: string;
  fullName: string;
  programCode: string;
  programName: string;
  cohortId: string;
  cohortCode: string;
  programVersionId: string;
  versionNumber: string;
  semesterCode: string;
  semesterStartDate: string;
  versionSource: 'COHORT' | 'EXCEPTION';
  cohortAssignmentId: string | null;
}
export type CourseShortfall = (
  | { code: 'MANDATORY_COURSE_MISSING'; category: 'MANDATORY_COURSE' }
  | { code: 'CONDITIONAL_COURSE_MISSING'; category: 'CONDITIONAL_COURSE' }
) & {
  curriculumItemId: string;
  course: GraduationCourseRef;
  blockSymbol: string | null;
  reason: CompletionReason;
  message: string;
};
export interface ElectiveCreditShortfall {
  code: 'ELECTIVE_CREDITS_MISSING';
  category: 'ELECTIVE_GROUP';
  groupId: string;
  groupCode: string;
  groupName: string;
  requiredCredits: string;
  earnedCredits: string;
  missingCredits: string;
  message: string;
}
export interface ElectiveCourseShortfall {
  code: 'ELECTIVE_COURSES_MISSING';
  category: 'ELECTIVE_GROUP';
  groupId: string;
  groupCode: string;
  groupName: string;
  requiredCourses: number;
  earnedCourses: number;
  missingCourses: number;
  message: string;
}
export interface TotalCreditShortfall {
  code: 'TOTAL_CREDITS_MISSING';
  category: 'TOTAL_CREDITS';
  requiredCredits: string;
  earnedCredits: string;
  missingCredits: string;
  message: string;
}
export type GraduationShortfall =
  | CourseShortfall
  | ElectiveCreditShortfall
  | ElectiveCourseShortfall
  | TotalCreditShortfall;
export interface GraduationRecognition {
  curriculumItemId: string;
  requiredCourse: GraduationCourseRef;
  studiedCourse: GraduationCourseRef;
  attemptId: string;
  attemptRevision: number;
  completionStatus: 'PASSED' | 'EXEMPT';
  viaEquivalence: boolean;
  equivalenceGroupId: string | null;
  requiredCredits: string;
  recognizedCredits: string;
  creditBasis: CreditBasis;
  category: 'MANDATORY_COURSE' | 'ELECTIVE_GROUP' | 'CONDITIONAL_COURSE';
  electiveGroupId: string | null;
  blockSymbol: string | null;
}
export interface GraduationFreeCredit {
  course: GraduationCourseRef;
  attemptId: string;
  credits: string;
  creditBasis: CreditBasis;
  reason: 'SURPLUS_EQUIVALENT' | 'OUTSIDE_FRAME';
}
export interface GraduationGroupProgress {
  groupId: string;
  groupCode: string;
  groupName: string;
  requiredCredits: string | null;
  earnedCredits: string;
  missingCredits: string | null;
  requiredCourses: number | null;
  earnedCourses: number;
  missingCourses: number | null;
}
export interface GraduationBlockProgress {
  blockSymbol: string | null;
  blockName: string | null;
  earnedCredits: string;
  compulsoryCredits: string;
  electiveCredits: string;
  catalogRequiredCredits: string | null;
  advisoryGap: string | null;
}
export interface GraduationWarning {
  code:
    | 'EQUIVALENT_CREDIT_GAP'
    | 'CURRENT_CATALOG_CREDIT_BASIS'
    | 'UNKNOWN_KNOWLEDGE_BLOCK';
  curriculumItemId: string | null;
  courseId: string | null;
  creditGap: string | null;
  message: string;
}
export interface GraduationResult {
  schemaVersion: 1;
  ruleVersion: 'graduation-v1';
  evaluatedAt: string;
  context: GraduationContextValue;
  conclusion: GraduationConclusion;
  shortfalls: GraduationShortfall[];
  warnings: GraduationWarning[];
  credits: {
    requiredTotal: string;
    recognizedTotal: string;
    missingTotal: string;
    compulsory: string;
    elective: string;
    free: string;
  };
  electiveGroups: GraduationGroupProgress[];
  knowledgeBlocks: GraduationBlockProgress[];
  recognitions: GraduationRecognition[];
  freeCredits: GraduationFreeCredit[];
}
export interface GraduationDiagnostic {
  code: string;
  message: string;
  enrollmentId: string | null;
}
export type GraduationOutcome =
  | { status: 'REVIEWED'; result: GraduationResult; error: null }
  | { status: 'CANNOT_AUDIT'; result: null; error: GraduationDiagnostic };
