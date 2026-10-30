import type {
  CreditBasis,
  GraduationContextValue,
  GraduationCourseRef,
} from './graduation.types.js';

export interface GraduationFrameFact {
  id: string;
  course: GraduationCourseRef;
  credits: string;
  courseType:
    | 'THEORY'
    | 'PRACTICE'
    | 'LAB'
    | 'PROJECT'
    | 'CAPSTONE'
    | 'INTERNSHIP'
    | 'CONDITIONAL';
  isElective: boolean;
  electiveGroupId: string | null;
  blockSymbol: string | null;
  plannedSemester: number;
  sortOrder: number;
}

export interface GraduationInputSnapshot {
  schemaVersion: 1;
  ruleVersion: 'graduation-v1';
  context: GraduationContextValue;
  version: {
    totalCredits: string;
    compulsoryCredits: string;
    electiveCredits: string;
  };
  frame: GraduationFrameFact[];
  groups: Array<{
    id: string;
    groupCode: string;
    groupName: string;
    minCredits: string | null;
    minCourses: number | null;
  }>;
  blocks: Array<{
    blockCode: string;
    blockName: string;
    requiredCredits: string | null;
  }>;
  courses: Array<{
    course: GraduationCourseRef;
    courseType: GraduationFrameFact['courseType'];
    credits: string;
    creditBasis: CreditBasis;
    equivalenceGroupId: string | null;
  }>;
  attempts: Array<{
    id: string;
    revision: number;
    courseId: string;
    semesterId: string;
    dataSource: 'EXCEL' | 'SCHOOL_DB';
    semesterStartDate: string;
    score10: string | null;
    score4: string | null;
    letterGrade: string | null;
    status: 'PASSED' | 'FAILED' | 'EXEMPT' | 'IN_PROGRESS';
  }>;
}
