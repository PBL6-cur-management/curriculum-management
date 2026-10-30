import type { components } from '../api/schema';

export type EligibilityItemView = components['schemas']['EligibilityItemDto'];
export type EligibilityByItemId = ReadonlyMap<string, EligibilityItemView>;
export const ELIGIBILITY_COLORS = {
  COMPLETED: 'default',
  ELIGIBLE: 'success',
  CONDITIONAL: 'warning',
  INELIGIBLE: 'error',
} as const;
export const ELIGIBILITY_HELP =
  'Kết quả chỉ xét điều kiện học tập, không xác nhận việc mở lớp hoặc đăng ký học phần.';

export function hasConsistentEligibilityState(
  item: EligibilityItemView,
): boolean {
  if (
    !Array.isArray(item.reasons) ||
    !Array.isArray(item.requiredConcurrentCourses)
  )
    return false;
  if (item.completed)
    return (
      item.eligibility === null &&
      item.reasons.length === 1 &&
      ['COURSE_COMPLETED', 'EQUIVALENT_COMPLETED'].includes(
        item.reasons[0].code,
      ) &&
      item.requiredConcurrentCourses.length === 0
    );
  switch (item.eligibility) {
    case 'ELIGIBLE':
      return (
        item.reasons.length === 0 && item.requiredConcurrentCourses.length === 0
      );
    case 'CONDITIONAL': {
      const required = new Set(
        item.requiredConcurrentCourses.map((course) => course.id),
      );
      return (
        required.size > 0 &&
        !required.has(item.course.id) &&
        required.size === item.requiredConcurrentCourses.length &&
        item.reasons.length === required.size &&
        item.reasons.every(
          (reason) =>
            reason.code === 'COREQUISITE_REQUIRED' &&
            reason.requiredCourse !== null &&
            required.delete(reason.requiredCourse.id),
        )
      );
    }
    case 'INELIGIBLE':
      return (
        item.reasons.length > 0 && item.requiredConcurrentCourses.length === 0
      );
    default:
      return false;
  }
}
