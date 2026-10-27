import type { ImportStatus, ImportType } from '../api/imports';

export const IMPORT_TYPE_LABELS = {
  COURSE_CATALOG: 'Danh mục học phần',
  CURRICULUM: 'Khung chương trình',
  STUDENT_LIST: 'Danh sách sinh viên',
  ACADEMIC_RESULT: 'Kết quả học tập',
} satisfies Record<ImportType, string>;
export const IMPORT_STATUS_LABELS = {
  VALIDATING: 'Đang chạy thử',
  DRY_RUN: 'Chạy thử',
  COMMITTING: 'Đang ghi',
  COMMITTED: 'Đã ghi',
  ABORTED: 'Không ghi do lỗi',
} satisfies Record<ImportStatus, string>;
export const IMPORT_STATUS_COLORS = {
  VALIDATING: 'processing',
  DRY_RUN: 'blue',
  COMMITTING: 'processing',
  COMMITTED: 'success',
  ABORTED: 'default',
} satisfies Record<ImportStatus, string>;
export const IMPORT_SEVERITY_LABELS = {
  ERROR: 'LỖI',
  HIGH: 'CẢNH BÁO',
  INFO: 'LƯU Ý',
} as const;
export const IMPORT_SEVERITY_ALERT_TYPE = {
  ERROR: 'error',
  HIGH: 'warning',
  INFO: 'info',
} as const;
export const TRANSIENT_IMPORT_STATUSES: readonly ImportStatus[] = [
  'VALIDATING',
  'COMMITTING',
];
export const IMPORT_POLL_INTERVAL_MS = 1500;
export const IMPORT_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_ACCEPT = '.xlsx';
