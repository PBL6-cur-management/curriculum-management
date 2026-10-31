import type {
  BackupRunStatus,
  BackupState,
  DrillCheckCode,
  DrillStatus,
} from '../api/backups';

export const BACKUP_POLL_INTERVAL_MS = 30_000;
export const BACKUP_DEFAULT_PAGE = 1;

export const BACKUP_STATE_LABELS: Record<BackupState, string> = {
  DISABLED: 'Đã tắt',
  READY: 'Sẵn sàng',
  RUNNING: 'Đang sao lưu',
  OVERDUE: 'Quá hạn sao lưu',
  FAILED: 'Sao lưu thất bại',
};
export const BACKUP_STATE_COLORS: Record<BackupState, string> = {
  DISABLED: 'default',
  READY: 'success',
  RUNNING: 'processing',
  OVERDUE: 'warning',
  FAILED: 'error',
};

export const RUN_STATUS_LABELS: Record<BackupRunStatus, string> = {
  RUNNING: 'Đang sao lưu',
  SUCCEEDED: 'Đã sao lưu',
  FAILED: 'Sao lưu thất bại',
  INTERRUPTED: 'Bị gián đoạn',
  EXPIRED: 'Đã hết thời hạn lưu',
};
export const RUN_STATUS_COLORS: Record<BackupRunStatus, string> = {
  RUNNING: 'processing',
  SUCCEEDED: 'success',
  FAILED: 'error',
  INTERRUPTED: 'warning',
  EXPIRED: 'default',
};

// RESTORED is a technical result only; SUCCEEDED means a person accepted the recovery.
export const DRILL_STATUS_LABELS: Record<DrillStatus, string> = {
  RUNNING: 'Đang phục hồi',
  RESTORED: 'Đã phục hồi — chờ nghiệm thu',
  SUCCEEDED: 'Đã nghiệm thu phục hồi',
  FAILED: 'Phục hồi thất bại',
  INTERRUPTED: 'Bị gián đoạn',
};
export const DRILL_STATUS_COLORS: Record<DrillStatus, string> = {
  RUNNING: 'processing',
  RESTORED: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'error',
  INTERRUPTED: 'warning',
};

export const CHECK_LABELS: Record<DrillCheckCode, string> = {
  DUMP_HASH: 'Mã băm bản dump',
  DB_RESTORE: 'Phục hồi cơ sở dữ liệu',
  FILE_HASHES: 'Mã băm tệp đính kèm',
  DB_FILE_REFERENCES: 'Tệp được dữ liệu tham chiếu',
  RELEASED_CONTENT: 'Nội dung phiên bản đã ban hành',
  LOCALE: 'Bộ sắp xếp tiếng Việt (ICU)',
  MIGRATIONS: 'Migration',
};

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất trước' },
  { value: 'oldest', label: 'Cũ nhất trước' },
] as const;

export const RECOVERY_TIME_LABEL =
  'Thời gian phục hồi dữ liệu và kiểm tra tự động';
export const NO_RECORD = 'Chưa ghi nhận';
