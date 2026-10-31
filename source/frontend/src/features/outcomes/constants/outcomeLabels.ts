export const PLO_TITLE = 'PLO';
export const ADD_PLO = 'Thêm PLO';
export const NO_PLOS = 'Phiên bản này chưa có PLO';
export const PLO_CODE_REQUIRED = 'Nhập mã PLO.';
export const PLO_DESCRIPTION_REQUIRED = 'Nhập mô tả PLO.';
export const PLO_FORM_LIMITS = {
  CODE_MAX: 20,
  TEXT_MAX: 2000,
  GROUP_MAX: 100,
} as const;
// A confirmation states what goes with the PLO (US-042 AC4).
export const ploDeleteConfirm = (courseCount: number, cloLinkCount: number) =>
  courseCount === 0 && cloLinkCount === 0
    ? 'PLO này chưa được học phần nào dùng.'
    : `Xóa PLO này sẽ xóa ${courseCount} ô học phần–PLO và ${cloLinkCount} liên kết CLO.`;
export const cellClearConfirm = (cloLinkCount: number) =>
  `Xóa ô này sẽ xóa ${cloLinkCount} liên kết CLO–PLO của học phần với PLO này.`;
export const WEIGHT_MESSAGE =
  'Trọng số phải lớn hơn 0, không quá 1 và có tối đa hai chữ số thập phân.';
export const PLO_NOT_MAPPED_HINT =
  'Gắn học phần với PLO này ở ma trận học phần–PLO trước.';
export const NO_SYLLABUS_FOR_COURSE = 'Học phần chưa có đề cương';
export const NO_CLOS_IN_REVISION = 'Đề cương chưa có CLO';
export const SAVED = 'Đã lưu.';
export const NOTHING_CHANGED = 'Chưa có thay đổi để lưu.';
export const GROUP_FILTER_NOTE = 'Chỉ hiện học phần thuộc nhóm của bạn';
export const NO_GAPS = 'Không có thiếu sót';
