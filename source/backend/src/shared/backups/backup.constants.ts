// F-26 D1 (F26-01 A): a fixed policy, not an operator setting. The timeout is a safety cap, not a recovery target.
export const BACKUP_POLICY = {
  CRON: '0 2 * * *',
  DUE_HOUR: 2,
  RETENTION_COUNT: 30,
  OPERATION_LOCK_KEY: 5002,
  ATTEMPTS: 6,
  BACKOFF_MS: 60_000,
  OPERATION_TIMEOUT_MS: 1_800_000,
  CHILD_TERMINATION_GRACE_MS: 5_000,
  OVERDUE_GRACE_MS: 7_200_000,
  SEARCH_MAX: 100,
  OPERATOR_MAX: 100,
  ACCEPTANCE_NOTE_MAX: 1000,
  STDERR_MAX_BYTES: 16_384,
  QUEUE_FAILED_JOBS_KEPT: 20,
  CATALOG_VERSION: 1,
  PROJECTION_VERSION: 1,
  POSTGRES_MAJOR: 18,
} as const;

export const BACKUP_STATES = [
  'DISABLED',
  'READY',
  'RUNNING',
  'OVERDUE',
  'FAILED',
] as const;
export type BackupState = (typeof BACKUP_STATES)[number];

export const BACKUP_RUN_STATUSES = [
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'INTERRUPTED',
  'EXPIRED',
] as const;
export type BackupRunStatus = (typeof BACKUP_RUN_STATUSES)[number];

export const DELIVERY_TIERS = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'] as const;
export type DeliveryTier = (typeof DELIVERY_TIERS)[number];

export const DRILL_STATUSES = [
  'RUNNING',
  'RESTORED',
  'SUCCEEDED',
  'FAILED',
  'INTERRUPTED',
] as const;
export type DrillStatus = (typeof DRILL_STATUSES)[number];

export const DRILL_CHECK_CODES = [
  'DUMP_HASH',
  'DB_RESTORE',
  'FILE_HASHES',
  'DB_FILE_REFERENCES',
  'RELEASED_CONTENT',
  'LOCALE',
  'MIGRATIONS',
] as const;
export type DrillCheckCode = (typeof DRILL_CHECK_CODES)[number];

export const SORT_ORDERS = ['newest', 'oldest'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

// A drill writes only into a database whose name says it is a drill target (BE-06).
export const DRILL_DATABASE_NAME_PATTERN = /^ctdt_restore_drill_[a-z0-9_]+$/;
export const BACKUP_ID_PATTERN = /^daily-\d{4}-\d{2}-\d{2}$/;
export const SET_DUMP = 'database.dump';
export const SET_FILES = 'files';
export const SET_MANIFEST = 'manifest.json';
export const SET_RELEASED_CONTENT = 'released-content.json';
// FileStorageService's temp suffix: an upload in flight, never a durable file.
export const TRANSPORT_SUFFIX = '.part';
