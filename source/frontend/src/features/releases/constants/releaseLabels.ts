export const SEMESTER_FORM_TITLE = 'Thêm học kỳ';
export const COHORT_FORM_TITLE = 'Thêm khóa tuyển sinh';
export const RELEASE_CONFIRM_TITLE = 'Ban hành phiên bản này?';
export const RELEASE_CONFIRM_BODY =
  'Sau khi ban hành, phiên bản, khung chương trình, đề cương và số quyết định không sửa trực tiếp được nữa; mọi thay đổi sau đó đi qua đề xuất hoặc đính chính.';
export const CORRECTION_CONFIRM_TITLE = 'Ban hành đính chính?';
export const CORRECTION_CONFIRM_BODY =
  'Bản đính chính thành phiên bản mới (số phụ tăng thêm 1); phiên bản bị đính chính chuyển sang Lịch sử.';
export const VERSION_NUMBER_MESSAGE =
  'Số phiên bản có dạng Chính.Phụ, ví dụ 1.0.';
// Mirrors VERSION_NUMBER_PATTERN in source/backend/src/shared/releases/version-number.ts.
export const VERSION_NUMBER_PATTERN = /^\d{1,3}\.\d{1,3}$/;
export const REASON_MAX = 2000;
export const DECISION_NUMBER_MAX = 100;

// The server names a missing DC-03 condition by code; the page words it.
export const SYLLABUS_CONDITION_LABELS: Record<string, string> = {
  COURSE_DESCRIPTION_EMPTY: 'chưa có mô tả học phần',
  OBJECTIVES_EMPTY: 'chưa có mục tiêu học phần',
  ASSESSMENT_FORMULA_EMPTY: 'chưa khai báo công thức điểm',
  ASSESSMENT_WEIGHT_TOTAL_INVALID: 'tổng trọng số phải bằng 100%',
  ASSESSMENT_COMPONENT_INVALID: 'có thành phần đánh giá chưa hợp lệ',
  ASSESSMENT_CONDITION_THRESHOLD_REQUIRED:
    'thành phần điều kiện chưa có ngưỡng',
  ASSESSMENT_CLO_UNCOVERED: 'còn CLO chưa được đánh giá',
};
export const SYLLABUS_ISSUE_LABELS = {
  MISSING_SYLLABUS: 'Chưa có đề cương',
  SYLLABUS_INCOMPLETE: 'Đề cương chưa đủ điều kiện ban hành',
} as const;

export const CHECK_BLOCKED_NOTE =
  'Còn lỗi: chưa ban hành được. Sửa các mục dưới đây rồi kiểm tra lại.';
export const CHECK_CLEAN_NOTE =
  'Đủ điều kiện ban hành: khung nhất quán và mọi học phần đã có đề cương đủ nội dung.';
export const CHECK_RERUN_LABEL = 'Kiểm tra lại';
export const ISSUE_SEVERITY_LABELS = {
  ERROR: 'Lỗi',
  HIGH: 'Cảnh báo',
  INFO: 'Lưu ý',
} as const;

// The state of the syllabus revision a version pins, as that version's readers see it.
export const PIN_STATUS_LABELS = {
  DRAFT: 'Nháp',
  PUBLISHED: 'đang ban hành',
  HISTORICAL: 'đã thay bằng bản mới',
} as const;
export const CORRECTION_REASON_REQUIRED = 'Nhập lý do đính chính.';
export const NO_VERSIONS = 'Chương trình chưa có phiên bản nào.';
export const COMPARISON_OPERATIONS = [
  { change: 'ADDED', label: 'Thêm', color: 'success' },
  { change: 'REMOVED', label: 'Bớt', color: 'error' },
  { change: 'CHANGED', label: 'Sửa', color: 'warning' },
] as const;
export const ASSIGNMENT_NOTE =
  'Phiên bản mới không tự áp dụng cho mọi khóa. Chỉ các khóa được chọn mới thay đổi từ học kỳ đã chỉ định.';
export const STUDENT_ASSIGNMENT_NOTE =
  'Gán theo khóa; ghi danh và ngoại lệ từng sinh viên được xử lý ở tính năng hồ sơ sinh viên.';
export const ASSIGNMENT_REVISION_CHANGED =
  'Lịch gán hoặc lịch học kỳ đã thay đổi. Nạp lại dữ liệu, kiểm tra lựa chọn và xác nhận lại.';
