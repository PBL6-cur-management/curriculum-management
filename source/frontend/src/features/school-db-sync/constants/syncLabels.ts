import type {
  SyncConnectionTest,
  SyncMappingKind,
  SyncRunStatus,
  SyncTrigger,
} from '../api/schoolSync';

export const SYNC_POLL_INTERVAL_MS = 2000;

export const RUN_STATUS_LABELS: Record<SyncRunStatus, string> = {
  RUNNING: 'Đang chạy',
  SUCCEEDED: 'Thành công',
  FAILED: 'Thất bại',
};
export const RUN_STATUS_COLORS: Record<SyncRunStatus, string> = {
  RUNNING: 'processing',
  SUCCEEDED: 'success',
  FAILED: 'error',
};
export const TRIGGER_LABELS: Record<SyncTrigger, string> = {
  SCHEDULED: 'Theo lịch',
  MANUAL: 'Chạy tay',
  RETRY: 'Chạy lại',
};
export const MAPPING_KIND_LABELS: Record<SyncMappingKind, string> = {
  COHORT: 'Khóa tuyển sinh',
  PROGRAM: 'Chương trình',
  SEMESTER: 'Học kỳ',
  COURSE: 'Học phần',
};
export const WEEKDAY_LABELS = [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ nhật',
] as const;
export const CONFLICT_FIELD_LABELS: Record<string, string> = {
  fullName: 'Họ tên',
  cohort: 'Khóa',
  major: 'Ngành',
  admissionSemester: 'Học kỳ nhập học',
  statusSemester: 'Học kỳ trạng thái',
  status: 'Trạng thái',
  score10: 'Điểm thang 10',
  score4: 'Điểm thang 4',
  letterGrade: 'Điểm chữ',
};
export const CONNECTION_TEST_TONE: Record<
  SyncConnectionTest['code'],
  'success' | 'warning' | 'error'
> = {
  CONNECTED: 'success',
  CONNECTION_FAILED: 'error',
  READ_ONLY_REQUIRED: 'warning',
  SOURCE_CONTRACT_INVALID: 'error',
  CONNECTOR_UNAVAILABLE: 'warning',
};
