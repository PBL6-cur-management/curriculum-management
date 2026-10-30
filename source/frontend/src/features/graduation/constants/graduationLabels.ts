import type {
  GraduationAudit,
  GraduationBatch,
  GraduationBatchItem,
  GraduationResult,
  GraduationTask,
} from '../schema/graduation';

export const CONCLUSION_LABELS = {
  ELIGIBLE: 'Đủ điều kiện',
  NOT_ELIGIBLE: 'Chưa đủ điều kiện',
} satisfies Record<GraduationResult['conclusion'], string>;
export const CONCLUSION_COLORS = {
  ELIGIBLE: 'success',
  NOT_ELIGIBLE: 'warning',
} satisfies Record<GraduationResult['conclusion'], string>;
export const BATCH_LABELS = {
  QUEUED: 'Đang chờ',
  RUNNING: 'Đang xét',
  COMPLETED: 'Hoàn tất',
  COMPLETED_WITH_ERRORS: 'Hoàn tất có lỗi',
  FAILED: 'Thất bại',
} satisfies Record<GraduationBatch['status'], string>;
export const BATCH_COLORS = {
  QUEUED: 'default',
  RUNNING: 'processing',
  COMPLETED: 'success',
  COMPLETED_WITH_ERRORS: 'warning',
  FAILED: 'error',
} satisfies Record<GraduationBatch['status'], string>;
export const ITEM_LABELS = {
  PENDING: 'Chưa xét',
  REVIEWED: 'Đã xét',
  ERROR: 'Không thể xét',
} satisfies Record<GraduationBatchItem['status'], string>;
export const ITEM_COLORS = {
  PENDING: 'default',
  REVIEWED: 'success',
  ERROR: 'error',
} satisfies Record<GraduationBatchItem['status'], string>;
export const TASK_LABELS = {
  PENDING: 'Đang chờ xét lại',
  RUNNING: 'Đang xét lại',
  COMPLETED: 'Đã xét lại',
  COVERED: 'Đã được lần xét mới hơn bao phủ',
  FAILED: 'Cần kiểm tra dữ liệu',
} satisfies Record<GraduationTask['status'], string>;
export const TASK_COLORS = {
  PENDING: 'default',
  RUNNING: 'processing',
  COMPLETED: 'success',
  COVERED: 'default',
  FAILED: 'error',
} satisfies Record<GraduationTask['status'], string>;
export const FRESHNESS_LABELS = {
  CURRENT: 'Khớp kết quả học tập hiện tại',
  RECHECK_PENDING: 'Kết quả học tập đã thay đổi, đang chờ xét lại',
  RECHECK_FAILED: 'Không thể tự động xét lại, cần kiểm tra dữ liệu',
} satisfies Record<GraduationAudit['freshness'], string>;
export const TRIGGER_LABELS = {
  STAFF: 'Xét từng sinh viên',
  BATCH: 'Xét hàng loạt',
  RESULT_CHANGE: 'Tự động xét lại',
} satisfies Record<GraduationAudit['trigger'], string>;
export const SHORTFALL_LABELS = {
  MANDATORY_COURSE_MISSING: 'Thiếu học phần bắt buộc',
  ELECTIVE_CREDITS_MISSING: 'Thiếu tín chỉ nhóm tự chọn',
  ELECTIVE_COURSES_MISSING: 'Thiếu số học phần nhóm tự chọn',
  TOTAL_CREDITS_MISSING: 'Thiếu tổng tín chỉ',
  CONDITIONAL_COURSE_MISSING: 'Chưa hoàn thành học phần điều kiện',
} satisfies Record<GraduationResult['shortfalls'][number]['code'], string>;
export const WARNING_LABELS = {
  EQUIVALENT_CREDIT_GAP: 'Chênh lệch tín chỉ học phần tương đương',
  CURRENT_CATALOG_CREDIT_BASIS: 'Tín chỉ theo danh mục hiện tại',
  UNKNOWN_KNOWLEDGE_BLOCK: 'Chưa xác định khối kiến thức',
} satisfies Record<GraduationResult['warnings'][number]['code'], string>;
export const CREDIT_BASIS_LABELS = {
  APPLIED_VERSION_SNAPSHOT: 'Theo phiên bản áp dụng',
  CURRENT_CATALOG: 'Theo danh mục hiện tại',
} satisfies Record<
  GraduationResult['recognitions'][number]['creditBasis'],
  string
>;
export const FREE_CREDIT_LABELS = {
  SURPLUS_EQUIVALENT: 'Phần dư sau phân bổ tương đương',
  OUTSIDE_FRAME: 'Học phần ngoài khung',
} satisfies Record<GraduationResult['freeCredits'][number]['reason'], string>;
