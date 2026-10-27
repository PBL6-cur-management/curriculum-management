export const IMPORT_QUEUE = 'imports';
export const IMPORT_JOB = {
  VALIDATE: 'validate',
  COMMIT: 'commit',
  SWEEP: 'sweep',
} as const;
export type ImportJobName = (typeof IMPORT_JOB)[keyof typeof IMPORT_JOB];
export const IMPORT_LIMITS = {
  FILE_MAX_BYTES: 5 * 1024 * 1024,
  FILE_NAME_MAX: 255,
  ROWS_MAX: 2000,
  HEADER_SCAN_ROWS: 20,
  FILE_RETENTION_DAYS: 30,
  STALE_AFTER_MS: 60 * 60 * 1000,
  TX_TIMEOUT_MS: 120_000,
  JOB_ATTEMPTS: 3,
  JOB_BACKOFF_MS: 5_000,
  SHUTDOWN_GRACE_MS: 10_000,
} as const;
export const IMPORT_SWEEP = {
  SCHEDULER_ID: 'imports-sweep',
  CRON: '0 2 * * *',
  TIME_ZONE: 'Asia/Ho_Chi_Minh',
} as const;
export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const XLSX_EXTENSION = '.xlsx';
export const DAY_SECONDS = 86_400;
export const DAY_MS = DAY_SECONDS * 1000;
export const IMPORT_CATALOG_LOCK_KEY = 9_009;
export interface ImportJobData {
  batchId: string;
}
