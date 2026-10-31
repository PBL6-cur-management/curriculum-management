import type {
  ChangeDocumentType,
  ChangeRequestType,
  ChangeTargetType,
  RequestOrigin,
} from '../api/changeRequests';

export const REQUEST_TYPE_LABELS: Record<ChangeRequestType, string> = {
  GRADING_FORMULA: 'Công thức tính điểm',
  OUTCOME: 'Chuẩn đầu ra (PLO/CLO)',
  SYLLABUS_CONTENT: 'Nội dung đề cương',
  CURRICULUM: 'Khung chương trình',
  COURSE_RELATION: 'Thông tin và quan hệ học phần',
  PROGRAM_INFO: 'Thông tin chương trình',
  ORGANIZATION: 'Tổ chức (thành viên nhóm, Giám đốc CTĐT)',
};
export const UNSUPPORTED_TYPE_HINT = 'Chưa hỗ trợ';
export const ORIGIN_LABELS: Record<RequestOrigin, string> = {
  UNIVERSITY: 'Theo yêu cầu của Trường',
  FACULTY: 'Khoa đề xuất',
};
export const DOCUMENT_TYPE_LABELS: Record<ChangeDocumentType, string> = {
  SUBMISSION: 'Tờ trình',
  MINUTES: 'Biên bản họp',
  COUNCIL_MINUTES: 'Biên bản Hội đồng',
  REVIEW_MINUTES: 'Biên bản thẩm định',
  OFFICIAL_LETTER: 'Công văn',
};
export const TARGET_TYPE_LABELS: Record<ChangeTargetType, string> = {
  COURSE: 'Học phần',
  PROGRAM: 'Chương trình đào tạo',
  SUBJECT_GROUP: 'Nhóm chuyên môn',
};
export const DIFF_CHANGE_LABELS = {
  ADDED: 'Thêm',
  REMOVED: 'Xóa',
  CHANGED: 'Sửa',
} as const;
export const DIFF_CHANGE_COLORS = {
  ADDED: 'success',
  REMOVED: 'error',
  CHANGED: 'processing',
} as const;
export const ACTION_LABELS = {
  PENDING: 'Chờ duyệt',
  APPROVE: 'Đã duyệt',
  RETURN: 'Trả lại',
  REJECT: 'Từ chối',
} as const;
export const ACADEMIC_OFFICE_LABEL = 'Phòng Đào tạo';

export const DELETE_REQUEST_CONFIRM =
  'Xóa đề xuất Nháp này? Bản nháp dữ liệu và hồ sơ đính kèm cũng bị xóa.';
export const WITHDRAW_CONFIRM =
  'Rút đề xuất? Đề xuất sẽ rời khỏi hàng chờ của mọi người duyệt và không gửi lại được.';
export const REBASE_CONFIRM =
  'Làm lại bản nháp trên dữ liệu mới nhất? Mọi thay đổi đã soạn trên bản nháp hiện tại sẽ mất.';
export const STALE_WORKSPACE =
  'Dữ liệu gốc đã thay đổi sau khi bản nháp được tạo. Cần làm lại bản nháp trước khi gửi.';
export const LIVE_DIFF_NOTE =
  'Bản xem trước — tính lại từ bản nháp mỗi lần mở.';
export const NO_CHANGES_YET = 'Chưa có thay đổi nào so với bản đang áp dụng.';
export const CONFLICT_TITLE =
  'Đối tượng này đang có đề xuất khác chưa kết thúc';
export const NO_REQUESTS =
  'Chưa có đề xuất nào. Mở học phần, đề cương hoặc chương trình cần sửa rồi bấm “Tạo đề xuất”.';
export const NO_MATCHING_REQUESTS =
  'Không có đề xuất khớp bộ lọc. Bỏ bớt điều kiện lọc để xem thêm.';
export const NO_DOCUMENTS = 'Chưa có hồ sơ đính kèm';
export const TARGET_FIELD_HINT = 'Chọn đối tượng cần thay đổi.';
