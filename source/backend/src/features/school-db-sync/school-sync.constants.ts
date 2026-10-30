export const SCHOOL_SYNC_QUEUE = 'school-db-sync';
export const SCHOOL_SYNC_JOBS = {
  // Every minute: start a due scheduled run and fail runs past their deadline.
  TICK: 'reconcile-schedule',
  RUN: 'run-sync',
} as const;
export const SCHOOL_SYNC_TICK_CRON = '* * * * *';

export const SCHOOL_SYNC_LIMITS = {
  // Absolute deadline of one run; a worker that is still busy after it can no longer commit.
  RUN_DEADLINE_MS: 30 * 60 * 1000,
  CONNECT_TIMEOUT_MS: 15_000,
  REQUEST_TIMEOUT_MS: 5 * 60 * 1000,
  APPLY_TIMEOUT_MS: 10 * 60 * 1000,
  MAX_STUDENTS: 50_000,
  MAX_RESULTS: 1_000_000,
  MAX_CLASSES: 100_000,
  MAX_MAPPINGS: 2_000,
  CODE_MAX: 60,
  HOST_MAX: 253,
  NAME_MAX: 128,
  PASSWORD_MAX: 256,
  // Row issues quoted in a failed run's message; the rest are counted.
  ISSUES_QUOTED: 5,
} as const;

export const SCHOOL_SOURCE_SCHEMA = 'cms_sync_v1';
export const SIMULATED_HOSTS: readonly string[] = ['localhost', '127.0.0.1'];
export const ACADEMIC_OFFICE_ROLE = 'R1';
