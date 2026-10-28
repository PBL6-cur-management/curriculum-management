export const STUDENT_ROLES = {
  OFFICE: 'R1',
  DIRECTOR: 'R3',
  SELF: 'R6',
} as const;

export const STUDENT_LIMITS = {
  CODE_MIN: 3,
  CODE_MAX: 32,
  NAME_MAX: 200,
  MAJOR_MAX: 64,
  BASIS_MAX: 1000,
  LETTER_MAX: 16,
  PASSWORD_HASH_CONCURRENCY: 4,
  PERFORMANCE_ROWS: 1000,
  PERFORMANCE_BUDGET_MS: 100_000,
} as const;

// A code never begins with a separator; lowercase is upper-cased before matching.
export const STUDENT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;

export const STUDENT_WRITE_TRANSACTION = {
  timeout: 30_000,
  maxWait: 10_000,
} as const;
