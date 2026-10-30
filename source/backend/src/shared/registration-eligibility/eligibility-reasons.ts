import type {
  EligibilityCourseRef,
  EligibilityEvaluationOptions,
  EligibilityReason,
  EligibilityReasonCode,
  EligibilityValue,
  EligibilityWarning,
  EligibilityWarningCode,
} from './eligibility.types.js';

const label = (course: EligibilityCourseRef | null) =>
  course ? `${course.courseCode} — ${course.courseName}` : '';
export function eligibilityStatusText(
  completed: boolean,
  eligibility: EligibilityValue | null,
): string {
  if (completed) return 'Đã hoàn thành';
  switch (eligibility) {
    case 'ELIGIBLE':
      return 'Được';
    case 'CONDITIONAL':
      return 'Được có điều kiện';
    case 'INELIGIBLE':
      return 'Không được';
    default:
      throw new Error('Incomplete eligibility verdict');
  }
}
export function renderEligibilityReason(
  reason: Omit<EligibilityReason, 'message'>,
  options: EligibilityEvaluationOptions,
): string {
  const required = label(reason.requiredCourse);
  switch (reason.code) {
    case 'COURSE_COMPLETED':
      return reason.actualStatus === 'EXEMPT'
        ? `Đã được miễn học phần ${label(reason.evidenceCourse)}.`
        : `Đã hoàn thành học phần ${label(reason.evidenceCourse)}.`;
    case 'EQUIVALENT_COMPLETED':
      return `Đã hoàn thành nhờ kết quả được công nhận của học phần tương đương ${label(reason.evidenceCourse)}.`;
    case 'PREREQUISITE_NOT_PASSED':
      return `Chưa đạt học phần tiên quyết ${required}.`;
    case 'PREREQUISITE_SCORE_MISSING':
      return `Chưa có điểm thang 4 để kiểm tra ngưỡng ${reason.requiredScore4} của học phần tiên quyết ${required}.`;
    case 'PREREQUISITE_SCORE_TOO_LOW':
      return `Điểm cao nhất được công nhận của học phần tiên quyết ${required} là ${reason.actualScore4}/4, thấp hơn ngưỡng ${reason.requiredScore4}/4.`;
    case 'PRIOR_RESULT_MISSING':
      return `Chưa có kết quả học phần học trước ${required}.`;
    case 'COREQUISITE_REQUIRED':
      return `Được, nếu đăng ký cùng học phần song hành ${required}.`;
    case 'COREQUISITE_RULES_UNAVAILABLE':
      return `Chưa thể xác định điều kiện của học phần song hành ${required} vì học phần không có trong khung áp dụng.`;
    case 'COREQUISITE_DEPTH_LIMIT':
      return `Không thể xác định an toàn điều kiện song hành vì chuỗi phụ thuộc vượt quá giới hạn ${options.maxDepth} cấp.`;
    case 'COREQUISITE_INELIGIBLE': {
      const leaf = reason.causeCode;
      if (!leaf || leaf === 'COREQUISITE_INELIGIBLE')
        throw new Error('Missing leaf cause');
      return `Không được — học phần song hành ${label(reason.viaCourse)} chưa đủ điều kiện. ${renderEligibilityReason({ ...reason, code: leaf, causeCode: null }, options)}`;
    }
  }
}
export function eligibilityReason(
  code: EligibilityReasonCode,
  facts: Partial<Omit<EligibilityReason, 'code' | 'message'>>,
  options: EligibilityEvaluationOptions,
): EligibilityReason {
  const reason = {
    code,
    causeCode: null,
    relationType: null,
    requiredCourse: null,
    viaCourse: null,
    evidenceCourse: null,
    evidenceResultId: null,
    requiredScore4: null,
    actualScore4: null,
    actualStatus: null,
    path: [],
    ...facts,
  } satisfies Omit<EligibilityReason, 'message'>;
  return { ...reason, message: renderEligibilityReason(reason, options) };
}
export function eligibilityWarning(
  code: EligibilityWarningCode,
  course: EligibilityCourseRef,
): EligibilityWarning {
  const name = label(course);
  const messages: Record<EligibilityWarningCode, string> = {
    REPLACEMENT_UNAVAILABLE: `Học phần tiên quyết ${name} đã ngừng mở lớp nhưng chưa có học phần thay thế đang sử dụng; cần quản trị kiểm tra.`,
    EXTERNAL_REQUISITE: `Học phần điều kiện ${name} nằm ngoài khung áp dụng; kết quả đã có vẫn được kiểm tra.`,
    EXTERNAL_COREQUISITE_RULES_UNAVAILABLE: `Chưa có quy tắc theo phiên bản cho học phần song hành ${name}; cần quản trị kiểm tra.`,
    COURSE_NOT_ACTIVE: `Học phần ${name} hiện không ở trạng thái Đang sử dụng; kết quả này không xác nhận việc mở lớp.`,
  };
  return { code, course, message: messages[code] };
}
