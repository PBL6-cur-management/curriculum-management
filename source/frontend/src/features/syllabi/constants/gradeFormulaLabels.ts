import {
  FORMULA_VALUE_LIMITS,
  type WeightSummary,
} from '../utils/gradeFormulaValues';

export const FORMULA_TAB_LABEL = 'Công thức điểm';
export const MAPPING_TAB_LABEL = 'Ánh xạ đánh giá–CLO';
export const ADD_COMPONENT = 'Thêm thành phần';
export const SAVE_FORMULA = 'Lưu công thức điểm';
export const SAVE_MAPPINGS = 'Lưu ánh xạ';
export const COURSE_FAILING_SCORE = 'Điểm liệt học phần';
export const COMPONENT_FAILING_SCORE = 'Điểm liệt thành phần';
export const CONDITIONAL_COMPONENT = 'Thành phần điều kiện';
export const CONDITION_THRESHOLD = 'Ngưỡng điều kiện';
export const CLO_WEIGHT = 'Tỷ trọng CLO (%)';
export const NO_FORMULA = 'Chưa khai báo công thức điểm';
export const SAVE_FORMULA_FIRST = 'Lưu công thức điểm trước khi ánh xạ CLO.';
export const NO_CLOS_TO_MAP = 'Chưa có CLO để ánh xạ.';
export const GO_TO_FORMULA_TAB = 'Mở tab Công thức điểm';
export const GO_TO_CLO_TAB = 'Mở tab CLO';
export const CONDITION_EXPLANATION =
  'Dưới ngưỡng này thì học phần Không đạt, bất kể điểm tổng.';
export const RULE_ONLY_NOTE =
  'Chỉ khai báo quy tắc; kết quả Đạt/Không đạt lấy từ nguồn kết quả học tập.';
export const COVERAGE_HINT =
  'Có thể lưu Nháp; phải bao phủ mọi CLO trước khi gửi duyệt hoặc ban hành.';
export const FORMULA_SAVED = 'Đã lưu công thức điểm';
export const MAPPINGS_SAVED = 'Đã lưu ánh xạ đánh giá–CLO';
export const SAVE_FORMULA_FAILED = 'Không lưu được công thức điểm';
export const SAVE_MAPPINGS_FAILED = 'Không lưu được ánh xạ đánh giá–CLO';
export const STALE_FORM =
  'Đề cương đã thay đổi sau lần tải gần nhất. Dữ liệu bạn nhập vẫn được giữ; tải lại sẽ bỏ phần chưa lưu.';
export const RELOAD_DATA = 'Tải lại dữ liệu';
export const DISCARD_TITLE = 'Bỏ các thay đổi chưa lưu?';
export const DISCARD_OK = 'Bỏ thay đổi';
export const DISCARD_CANCEL = 'Giữ lại';
export const LEAVE_DIRTY_TITLE = 'Có thay đổi chưa lưu';
export const LEAVE_DIRTY_BODY =
  'Chuyển tab sẽ bỏ các thay đổi chưa lưu ở tab này.';
export const NOT_DECLARED =
  'Chưa khai báo công thức điểm cho bản đề cương này.';
export const NO_MAPPINGS = 'Chưa có ánh xạ đánh giá–CLO.';
export const GRADING_REQUEST_LABEL = 'Sửa công thức điểm và ánh xạ CLO';
export const REMOVE_COMPONENT = 'Xóa thành phần';
export const REMOVE_PERSISTED_TITLE = 'Xóa thành phần đã lưu?';
export const REMOVE_PERSISTED_BODY =
  'Các ánh xạ CLO của thành phần này cũng bị xóa khi bạn lưu.';

export const FORMULA_COLUMN_LABELS = {
  code: 'Mã',
  name: 'Tên thành phần',
  weight: 'Tỷ trọng (%)',
  form: 'Hình thức đánh giá',
  conditional: CONDITIONAL_COMPONENT,
  threshold: CONDITION_THRESHOLD,
  failingScore: COMPONENT_FAILING_SCORE,
  actions: 'Thao tác',
} as const;

export const FORMULA_ERRORS = {
  codeRequired: 'Nhập mã thành phần.',
  codeDuplicate: 'Mã thành phần bị trùng.',
  codeReserved: `Mã không được bắt đầu bằng ${FORMULA_VALUE_LIMITS.TEMPORARY_CODE_PREFIX}.`,
  codeMax: `Mã tối đa ${FORMULA_VALUE_LIMITS.CODE_MAX} ký tự.`,
  nameRequired: 'Nhập tên thành phần.',
  nameMax: `Tên tối đa ${FORMULA_VALUE_LIMITS.NAME_MAX} ký tự.`,
  formMax: `Hình thức tối đa ${FORMULA_VALUE_LIMITS.FORM_MAX} ký tự.`,
  weight:
    'Tỷ trọng là số lớn hơn 0 và không quá 100, tối đa 2 chữ số thập phân.',
  threshold:
    'Ngưỡng là số không âm, tối đa 7 chữ số nguyên và 2 chữ số thập phân.',
  thresholdRequired: 'Thành phần điều kiện phải có ngưỡng điều kiện.',
  cloWeight:
    'Tỷ trọng là số lớn hơn 0 và không quá 100, tối đa 2 chữ số thập phân.',
} as const;

export function weightGapText(summary: WeightSummary): string {
  if (summary.valid) return `Tổng ${summary.total}% — đủ 100%.`;
  const gap = Number(summary.difference);
  if (gap === 0) return `Tổng ${summary.total}% — còn dòng chưa hợp lệ.`;
  return gap > 0
    ? `Tổng ${summary.total}% — còn thiếu ${summary.difference}%.`
    : `Tổng ${summary.total}% — vượt ${summary.difference.replace('-', '')}%.`;
}

export const cloWarningText = (cloCodes: readonly string[]) =>
  `Chưa có thành phần đánh giá nào ánh xạ tới: ${cloCodes.join(', ')}. ${COVERAGE_HINT}`;
