import type {
  EligibilityItem,
  EligibilityReason,
  RegistrationEligibility,
} from './api/registrationEligibility';
import { curriculum } from './testFixtures';

const ref = (id: string) => ({
  id: `c-${id}`,
  courseCode: id,
  courseName: `Học phần giả lập ${id}`,
  nameSource: 'SNAPSHOT' as const,
});
export function reasonFixture(
  patch: Partial<EligibilityReason> = {},
): EligibilityReason {
  return {
    code: 'PRIOR_RESULT_MISSING',
    causeCode: null,
    message: 'Chưa có kết quả học phần học trước SYN-B.',
    relationType: 'PRIOR',
    requiredCourse: ref('SYN-B'),
    viaCourse: null,
    evidenceCourse: null,
    evidenceResultId: null,
    requiredScore4: null,
    actualScore4: null,
    actualStatus: null,
    path: [ref('SYN-A'), ref('SYN-B')],
    ...patch,
  } satisfies EligibilityReason;
}
export function eligibleItemFixture(itemId: string): EligibilityItem {
  return {
    itemId,
    course: ref(itemId.replace('i-', '')),
    credits: '0',
    catalogStatus: 'ACTIVE',
    plannedSemester: 1,
    completed: false,
    eligibility: 'ELIGIBLE',
    statusText: 'Được',
    reasons: [],
    requiredConcurrentCourses: [],
  } satisfies EligibilityItem;
}
export function conditionalItemFixture(itemId: string): EligibilityItem {
  const required = [ref('SYN-B'), ref('SYN-C')];
  return {
    ...eligibleItemFixture(itemId),
    eligibility: 'CONDITIONAL',
    statusText: 'Được có điều kiện',
    requiredConcurrentCourses: required,
    reasons: required.map((course) =>
      reasonFixture({
        code: 'COREQUISITE_REQUIRED',
        message: `Được, nếu đăng ký cùng học phần song hành ${course.courseCode}.`,
        relationType: 'COREQUISITE',
        requiredCourse: course,
      }),
    ),
  };
}
export function ineligibleItemFixture(itemId: string): EligibilityItem {
  return {
    ...eligibleItemFixture(itemId),
    eligibility: 'INELIGIBLE',
    statusText: 'Không được',
    reasons: [
      reasonFixture({
        code: 'COREQUISITE_INELIGIBLE',
        causeCode: 'PREREQUISITE_SCORE_TOO_LOW',
        message: 'Học phần song hành SYN-B chưa đạt tiên quyết SYN-C.',
        relationType: 'COREQUISITE',
        viaCourse: ref('SYN-B'),
        requiredCourse: ref('SYN-C'),
        evidenceCourse: { ...ref('SYN-EQUIVALENT'), nameSource: 'CATALOG' },
        evidenceResultId: 'synthetic-result',
        requiredScore4: '2.5',
        actualScore4: '0',
        actualStatus: 'PASSED',
        path: [ref('SYN-A'), ref('SYN-B'), ref('SYN-C')],
      }),
    ],
  };
}
export function completedItemFixture(itemId: string): EligibilityItem {
  return {
    ...eligibleItemFixture(itemId),
    completed: true,
    eligibility: null,
    statusText: 'Đã hoàn thành',
    reasons: [
      reasonFixture({
        code: 'EQUIVALENT_COMPLETED',
        message: 'Đã hoàn thành nhờ học phần tương đương SYN-EQUIVALENT.',
        relationType: null,
        requiredCourse: null,
        evidenceCourse: { ...ref('SYN-EQUIVALENT'), nameSource: 'CATALOG' },
        evidenceResultId: 'exemption',
        actualStatus: 'EXEMPT',
        path: [],
      }),
    ],
  };
}
export function eligibilityAnswerFixture(
  patch: Partial<RegistrationEligibility> = {},
): RegistrationEligibility {
  return {
    contractVersion: 1,
    context: {
      studentId: 's1',
      programId: 'p1',
      semesterId: 'sem1',
      programVersionId: 'v1',
      enrollmentId: 'enrollment',
      source: 'COHORT',
      cohortAssignmentId: 'assignment',
    },
    evaluatedAt: '2026-10-29T00:00:00.000Z',
    items: curriculum().items.map((item) => eligibleItemFixture(item.id)),
    warnings: [],
    ...patch,
  } satisfies RegistrationEligibility;
}
