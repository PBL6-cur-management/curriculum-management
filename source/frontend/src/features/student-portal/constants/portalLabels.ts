import type { PortalCourseState } from '../api/portal';

export const COURSE_STATE_LABELS: Record<PortalCourseState, string> = {
  PASSED: 'Đã đạt',
  PASSED_EQUIVALENT: 'Đạt bằng HP tương đương',
  IN_PROGRESS: 'Đang học',
  FAILED: 'Chưa đạt',
  NOT_TAKEN: 'Chưa học',
};
export const COURSE_STATE_COLORS: Record<PortalCourseState, string> = {
  PASSED: 'success',
  PASSED_EQUIVALENT: 'success',
  IN_PROGRESS: 'processing',
  FAILED: 'error',
  NOT_TAKEN: 'default',
};
export const ENROLLMENT_TYPE_LABELS = {
  PRIMARY: 'Ngành chính',
  SECOND_MAJOR: 'Ngành thứ hai',
} as const;
export const STUDENT_STATUS_LABELS = {
  STUDYING: 'Đang học',
  ON_LEAVE: 'Bảo lưu',
  WITHDRAWN: 'Thôi học',
  GRADUATED: 'Đã tốt nghiệp',
} as const;
export const ELIGIBILITY_LABELS = {
  ELIGIBLE: 'Đăng ký được',
  CONDITIONAL: 'Phải học cùng',
  INELIGIBLE: 'Chưa đăng ký được',
} as const;
export const ELIGIBILITY_COLORS = {
  ELIGIBLE: 'success',
  CONDITIONAL: 'warning',
  INELIGIBLE: 'error',
} as const;
export const MATERIAL_LABELS = {
  SIGNED_SYLLABUS: 'Đề cương có chữ ký',
  TEXTBOOK: 'Giáo trình',
  LECTURE_SLIDES: 'Bài giảng',
  OTHER: 'Tài liệu khác',
} as const;
export const NO_PROGRAM_MESSAGE =
  'Chưa xác định được chương trình, liên hệ Phòng Đào tạo.';
