import { describe, expect, expectTypeOf, it } from 'vitest';
import { RELEASE_ERRORS } from '../releases/release.errors.js';
import { STUDENT_ERRORS } from '../students/student.errors.js';
import {
  GRADUATION_LIMITS,
  GRADUATION_QUEUE,
  GRADUATION_RULE_VERSION,
  GRADUATION_SCHEMA_VERSION,
  GRADUATION_SHORTFALL_CATEGORIES,
  GRADUATION_WARNING_CODES,
} from './graduation.constants.js';
import { GRADUATION_ERRORS } from './graduation.errors.js';
import type {
  CourseShortfall,
  GraduationOutcome,
  GraduationResult,
  GraduationShortfall,
} from './graduation.types.js';

const course = {
  id: 'course-a',
  courseCode: 'SYN101',
  courseName: 'Học phần tổng hợp',
};
const courseDetail = {
  curriculumItemId: 'item-a',
  course,
  blockSymbol: null,
  reason: 'NOT_TAKEN' as const,
  message: 'Chưa hoàn thành học phần bắt buộc SYN101.',
};
const shortfalls: GraduationShortfall[] = [
  {
    ...courseDetail,
    code: 'MANDATORY_COURSE_MISSING',
    category: 'MANDATORY_COURSE',
  },
  {
    code: 'ELECTIVE_CREDITS_MISSING',
    category: 'ELECTIVE_GROUP',
    groupId: 'group-a',
    groupCode: 'SYN-E',
    groupName: 'Nhóm tổng hợp',
    requiredCredits: '6',
    earnedCredits: '3',
    missingCredits: '3',
    message: 'Nhóm SYN-E đã có 3 tín chỉ, còn thiếu 3 tín chỉ.',
  },
  {
    code: 'ELECTIVE_COURSES_MISSING',
    category: 'ELECTIVE_GROUP',
    groupId: 'group-a',
    groupCode: 'SYN-E',
    groupName: 'Nhóm tổng hợp',
    requiredCourses: 2,
    earnedCourses: 1,
    missingCourses: 1,
    message: 'Còn thiếu 1 học phần trong nhóm SYN-E.',
  },
  {
    code: 'TOTAL_CREDITS_MISSING',
    category: 'TOTAL_CREDITS',
    requiredCredits: '120.25',
    earnedCredits: '117.125',
    missingCredits: '3.125',
    message: 'Còn thiếu 3.125 tín chỉ tích lũy.',
  },
  {
    ...courseDetail,
    code: 'CONDITIONAL_COURSE_MISSING',
    category: 'CONDITIONAL_COURSE',
    reason: 'IN_PROGRESS',
    message: 'Chưa hoàn thành học phần điều kiện SYN101.',
  },
];

function resultFor(entries: GraduationShortfall[]): GraduationResult {
  return {
    schemaVersion: GRADUATION_SCHEMA_VERSION,
    ruleVersion: GRADUATION_RULE_VERSION,
    evaluatedAt: '2026-10-30T00:00:00.000Z',
    context: {
      studentId: 'student-a',
      programId: 'program-a',
      semesterId: 'semester-a',
      enrollmentId: 'enrollment-a',
      studentCode: 'SYN0001',
      fullName: 'Sinh viên tổng hợp',
      programCode: 'SYN-P',
      programName: 'Chương trình tổng hợp',
      cohortId: 'cohort-a',
      cohortCode: 'SYN-C',
      programVersionId: 'version-a',
      versionNumber: '1.0',
      semesterCode: 'SYN-2026',
      semesterStartDate: '2026-09-01',
      versionSource: 'EXCEPTION',
      cohortAssignmentId: null,
    },
    conclusion: entries.length ? 'NOT_ELIGIBLE' : 'ELIGIBLE',
    shortfalls: entries,
    warnings: GRADUATION_WARNING_CODES.map((code) => ({
      code,
      curriculumItemId: null,
      courseId: null,
      creditGap: null,
      message: 'Cần kiểm tra căn cứ dữ liệu tổng hợp.',
    })),
    credits: {
      requiredTotal: '120.25',
      recognizedTotal: '120.25',
      missingTotal: '0',
      compulsory: '90.125',
      elective: '27.125',
      free: '3',
    },
    electiveGroups: [
      {
        groupId: 'group-a',
        groupCode: 'SYN-E',
        groupName: 'Nhóm tổng hợp',
        requiredCredits: null,
        earnedCredits: '3',
        missingCredits: null,
        requiredCourses: null,
        earnedCourses: 1,
        missingCourses: null,
      },
    ],
    knowledgeBlocks: [
      {
        blockSymbol: null,
        blockName: null,
        earnedCredits: '3',
        compulsoryCredits: '0',
        electiveCredits: '3',
        catalogRequiredCredits: null,
        advisoryGap: null,
      },
    ],
    recognitions: [
      {
        curriculumItemId: 'item-a',
        requiredCourse: course,
        studiedCourse: course,
        attemptId: 'attempt-a',
        attemptRevision: 1,
        completionStatus: 'PASSED',
        viaEquivalence: false,
        equivalenceGroupId: null,
        requiredCredits: '3',
        recognizedCredits: '3',
        creditBasis: 'APPLIED_VERSION_SNAPSHOT',
        category: 'MANDATORY_COURSE',
        electiveGroupId: null,
        blockSymbol: null,
      },
    ],
    freeCredits: [
      {
        course,
        attemptId: 'attempt-b',
        credits: '3',
        creditBasis: 'CURRENT_CATALOG',
        reason: 'OUTSIDE_FRAME',
      },
    ],
  };
}

describe('graduation contract', () => {
  it('pins the version, queue and operational bounds without Prisma model types', () => {
    expect(GRADUATION_SCHEMA_VERSION).toBe(1);
    expect(GRADUATION_RULE_VERSION).toBe('graduation-v1');
    expect(GRADUATION_QUEUE).toBe('graduation-review');
    expect(GRADUATION_LIMITS).toEqual({
      REVISION_LENGTH: 64,
      REQUEST_KEY_MAX: 64,
      SEARCH_MAX: 200,
      BATCH_CHUNK_SIZE: 50,
      TRANSACTION_TIMEOUT_MS: 30_000,
      TRANSACTION_MAX_WAIT_MS: 10_000,
      JOB_ATTEMPTS: 3,
      JOB_BACKOFF_MS: 5_000,
      SCAN_INTERVAL_MS: 5_000,
      LEASE_MS: 60_000,
      WORKER_CONCURRENCY: 2,
      SHUTDOWN_GRACE_MS: 10_000,
      PERFORMANCE_STUDENTS: 500,
      PERFORMANCE_BUDGET_MS: 300_000,
      TRANSACTION_RETRIES: 3,
    });
  });

  it.each(shortfalls)(
    'round trips $code with its fixed category and explicit fields',
    (shortfall) => {
      expect(GRADUATION_SHORTFALL_CATEGORIES[shortfall.code]).toBe(
        shortfall.category,
      );
      expect(JSON.parse(JSON.stringify(shortfall))).toEqual(shortfall);
      expect(shortfall.message.length).toBeGreaterThan(0);
    },
  );

  it('has five public codes, four categories and type-safe course pairings', () => {
    expect(Object.keys(GRADUATION_SHORTFALL_CATEGORIES)).toEqual(
      shortfalls.map((entry) => entry.code),
    );
    expect(new Set(Object.values(GRADUATION_SHORTFALL_CATEGORIES)).size).toBe(
      4,
    );
    expectTypeOf<
      Extract<CourseShortfall, { code: 'MANDATORY_COURSE_MISSING' }>['category']
    >().toEqualTypeOf<'MANDATORY_COURSE'>();
    expectTypeOf<
      Extract<
        CourseShortfall,
        { code: 'CONDITIONAL_COURSE_MISSING' }
      >['category']
    >().toEqualTypeOf<'CONDITIONAL_COURSE'>();
    expectTypeOf<
      GraduationResult['credits']['recognizedTotal']
    >().toEqualTypeOf<string>();
  });

  it.each([{ entries: [] }, { entries: shortfalls }])(
    'retains the conclusion/shortfalls invariant in reviewed JSON',
    ({ entries }) => {
      const result = resultFor(entries);
      const outcome: GraduationOutcome = {
        status: 'REVIEWED',
        result,
        error: null,
      };
      const decoded = JSON.parse(JSON.stringify(outcome));
      expect(decoded).toEqual(outcome);
      expect(decoded.result.conclusion === 'ELIGIBLE').toBe(
        decoded.result.shortfalls.length === 0,
      );
      expect(decoded.result.warnings).toHaveLength(3);
      expect(decoded.result.context.cohortAssignmentId).toBeNull();
      expect(decoded.result.credits.compulsory).toBe('90.125');
      expect(decoded.result.electiveGroups[0].requiredCredits).toBeNull();
      expect(
        decoded.result.knowledgeBlocks[0].catalogRequiredCredits,
      ).toBeNull();
      expect(decoded.result.recognitions[0].equivalenceGroupId).toBeNull();
    },
  );

  it('round trips non-null provenance/minima without losing decimal digits', () => {
    const result = resultFor(shortfalls);
    result.context.versionSource = 'COHORT';
    result.context.cohortAssignmentId = 'mapping-a';
    result.electiveGroups[0] = {
      ...result.electiveGroups[0]!,
      requiredCredits: '6',
      missingCredits: '3',
      requiredCourses: 2,
      missingCourses: 1,
    };
    result.knowledgeBlocks[0] = {
      ...result.knowledgeBlocks[0]!,
      blockSymbol: 'SYN-B',
      blockName: 'Khối tổng hợp',
      catalogRequiredCredits: '6',
      advisoryGap: '3',
    };
    result.recognitions[0] = {
      ...result.recognitions[0]!,
      viaEquivalence: true,
      equivalenceGroupId: 'equivalence-a',
      electiveGroupId: 'group-a',
      blockSymbol: 'SYN-B',
      recognizedCredits: '2',
      creditBasis: 'CURRENT_CATALOG',
      category: 'ELECTIVE_GROUP',
    };
    result.freeCredits[0] = {
      ...result.freeCredits[0]!,
      reason: 'SURPLUS_EQUIVALENT',
    };
    result.warnings[0] = {
      ...result.warnings[0]!,
      curriculumItemId: 'item-a',
      courseId: course.id,
      creditGap: '1',
    };
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it.each([null, 'enrollment-a'])(
    'keeps diagnostic outcome separate from an academic conclusion (%s)',
    (enrollmentId) => {
      const outcome: GraduationOutcome = {
        status: 'CANNOT_AUDIT',
        result: null,
        error: {
          code: GRADUATION_ERRORS.INPUT_INVALID.code,
          message: GRADUATION_ERRORS.INPUT_INVALID.message,
          enrollmentId,
        },
      };
      expect(JSON.parse(JSON.stringify(outcome))).toEqual(outcome);
      expectTypeOf<
        Extract<GraduationOutcome, { status: 'CANNOT_AUDIT' }>['result']
      >().toEqualTypeOf<null>();
      expectTypeOf<
        Extract<GraduationOutcome, { status: 'REVIEWED' }>['error']
      >().toEqualTypeOf<null>();
    },
  );

  it('reuses dependency diagnostics by identity and keeps new errors actionable', () => {
    expect(GRADUATION_ERRORS.APPLIED_VERSION_UNRESOLVED).toBe(
      STUDENT_ERRORS.APPLIED_VERSION_UNRESOLVED,
    );
    expect(GRADUATION_ERRORS.ENROLLMENT_AMBIGUOUS).toBe(
      STUDENT_ERRORS.ENROLLMENT_AMBIGUOUS,
    );
    expect(GRADUATION_ERRORS.SEMESTER_START_UNKNOWN).toBe(
      RELEASE_ERRORS.SEMESTER_START_UNKNOWN,
    );
    const errors = Object.values(GRADUATION_ERRORS);
    expect(new Set(errors.map((error) => error.code)).size).toBe(errors.length);
    for (const error of errors) {
      expect(error.message.length).toBeGreaterThan(0);
      expect([404, 409, 503]).toContain(error.status);
      expect(Object.keys(GRADUATION_SHORTFALL_CATEGORIES)).not.toContain(
        error.code,
      );
    }
    expect(GRADUATION_ERRORS.ACCESS_REVOKED.status).toBe(404);
    expect(GRADUATION_ERRORS.JOB_FAILED.status).toBe(503);
    expect(GRADUATION_ERRORS.UNSUPPORTED_SCHEMA_VERSION.status).toBe(409);
  });
});
