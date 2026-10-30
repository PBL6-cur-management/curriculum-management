import type { CurriculumRequisiteType } from '../api/curriculum';

export const REQUISITE_TYPE_LABELS: Record<CurriculumRequisiteType, string> = {
  PRIOR: 'Học trước',
  PREREQUISITE: 'Tiên quyết',
  COREQUISITE: 'Song hành',
};
export const ELECTIVE_KIND_LABELS = {
  compulsory: 'Bắt buộc',
  elective: 'Tự chọn',
} as const;
// Kept as the Excel prints them (DEC-05).
export const HT_DA_LABEL = 'HT ĐA';
export const TQ_DA_LABEL = 'TQ ĐA';
export const CURRICULUM_VIEW = {
  rows: 'rows',
  semesters: 'semesters',
} as const;
export type CurriculumView = keyof typeof CURRICULUM_VIEW;
export const CURRICULUM_VIEW_LABELS: Record<CurriculumView, string> = {
  rows: 'Dạng dòng',
  semesters: 'Theo học kỳ',
};
export const NO_BLOCK_LABEL = '(Chưa gán khối)';
export const EMPTY_SEMESTER_LABEL = 'Chưa có học phần';
export const REQUISITE_LATER_TOOLTIP = (semester: number) =>
  `Học phần điều kiện xếp ở học kỳ ${semester}, không trước học kỳ này.`;
export const REQUISITES_INTRO =
  'Điều kiện ở đây chỉ áp dụng cho khung này; danh mục học phần không đổi.';
export const GROUP_BELOW_MINIMUM_LABEL = 'Ít hơn yêu cầu';
export const ITEM_DELETE_CONFIRM =
  'Các điều kiện riêng của dòng này và các ô của học phần trong ma trận học phần–PLO, CLO–PLO cũng bị xóa.';
export const GROUP_DELETE_CONFIRM = 'Các học phần trong nhóm vẫn là tự chọn.';
export const MINIMUM_REQUIRED_MESSAGE = 'Nhập ít nhất một yêu cầu tối thiểu.';
// Repeated in the syllabi feature's labels: features do not import each other.
export const SYLLABUS_LINK = 'Đề cương';
export const NO_SYLLABUS_TAG = 'Chưa có đề cương';
export const ELIGIBILITY_STUDENT_PARAM = 'studentId';
export const ELIGIBILITY_SEMESTER_PARAM = 'semesterId';
export const ELIGIBILITY_COLUMN_TITLE = 'Đăng ký được?';
export const ELIGIBILITY_CONTEXT_RELOAD_LIMIT = 1;
