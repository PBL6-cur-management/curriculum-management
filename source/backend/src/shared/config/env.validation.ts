import { plainToInstance } from 'class-transformer';
import { LOG_LEVELS } from '../logging/log-levels.js';
import {
  ELIGIBILITY_DEFAULTS,
  ELIGIBILITY_LIMITS,
} from '../registration-eligibility/eligibility.constants.js';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Matches,
  MinLength,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

const NODE_ENVS = ['development', 'test', 'production'] as const;
const MAX_PORT = 65535;
// Redis ships 16 logical databases: 0..15.
const MAX_REDIS_DB = 15;
const SESSION_SECRET_MIN_LENGTH = 32;
const DEFAULT_SESSION_IDLE_MINUTES = 60;
const DEFAULT_FILES_ROOT = 'files';
const DEFAULT_ATTACHMENT_MAX_MB = 50;
// 32 bytes in base64: 43 characters and one padding sign.
const CREDENTIAL_KEY_PATTERN = /^[A-Za-z0-9+/]{43}=$/;

// Keep the explicit types: implicit conversion reads design:type, which is Object for an unannotated property,
// so a numeric variable would stay a string and fail @IsInt.
export { LOG_LEVELS };

export class Env {
  @IsIn(NODE_ENVS)
  NODE_ENV: (typeof NODE_ENVS)[number] = 'development';

  @IsInt()
  @Min(1)
  @Max(MAX_PORT)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  REDIS_HOST: string = 'localhost';

  @IsInt()
  @Min(1)
  @Max(MAX_PORT)
  REDIS_PORT: number = 6379;

  // Logical Redis database. The e2e run takes its own so it never meets the dev app's keys.
  @IsInt()
  @Min(0)
  @Max(MAX_REDIS_DB)
  REDIS_DB: number = 0;

  @IsString()
  @MinLength(SESSION_SECRET_MIN_LENGTH)
  SESSION_SECRET: string;

  @IsInt()
  @Min(1)
  SESSION_IDLE_MINUTES: number = DEFAULT_SESSION_IDLE_MINUTES;

  // Attachment folder: relative to the working directory or absolute; back it up with the database.
  @IsString()
  @IsNotEmpty()
  FILES_ROOT: string = DEFAULT_FILES_ROOT;

  @IsInt()
  @Min(1)
  ATTACHMENT_MAX_MB: number = DEFAULT_ATTACHMENT_MAX_MB;

  // Chrome/Edge executable for curriculum PDFs (F-24). Unset: the browser Puppeteer installed (`puppeteer browsers install chrome`).
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  PDF_BROWSER_PATH?: string;

  // A container that drops every capability cannot start Chrome's sandbox; the browser then only renders
  // our own escaped HTML with scripts and network off. 'true'/'false' strings, as EMAIL_ENABLED.
  @IsIn(['true', 'false'])
  PDF_BROWSER_NO_SANDBOX: 'true' | 'false' = 'false';

  // F-25 email (US-115): off until the Faculty approves an SMTP sender (E-1). Development uses Mailpit on 1025.
  // 'true'/'false' strings: implicit conversion would turn the text "false" into true.
  @IsIn(['true', 'false'])
  EMAIL_ENABLED: 'true' | 'false' = 'false';

  @IsString()
  @IsNotEmpty()
  SMTP_HOST: string = 'localhost';

  @IsInt()
  @Min(1)
  @Max(MAX_PORT)
  SMTP_PORT: number = 1025;

  @IsIn(['true', 'false'])
  SMTP_SECURE: 'true' | 'false' = 'false';

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASSWORD?: string;

  @IsString()
  @IsNotEmpty()
  MAIL_FROM: string = 'CTĐT Khoa CNTT <no-reply@localhost>';

  // Where links in emails point (the web app, not the API).
  @IsString()
  @IsNotEmpty()
  APP_BASE_URL: string = 'http://localhost:5173';

  // F-25 deadline reminders (US-116): off by default; the numbers are examples, not Faculty policy.
  @IsIn(['true', 'false'])
  REMINDERS_ENABLED: 'true' | 'false' = 'false';

  @IsInt()
  @Min(1)
  REMINDER_MAX_DAYS: number = 7;

  @IsInt()
  @Min(1)
  REMINDER_REPEAT_DAYS: number = 3;

  // Redis key prefix of every queue. Unset means BullMQ's own default ("bull"); the e2e specs share one Redis and set a unique one each.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  BULLMQ_PREFIX?: string;

  // AES-256 key (base64 of 32 bytes) that protects the one-time initial-password file. Absent: the app starts, but a student import that must create accounts is refused.
  @IsOptional()
  @Matches(CREDENTIAL_KEY_PATTERN, {
    message:
      'STUDENT_CREDENTIAL_ENCRYPTION_KEY must be the base64 of exactly 32 bytes',
  })
  STUDENT_CREDENTIAL_ENCRYPTION_KEY?: string;

  // AES-256 key (base64 of 32 bytes) that seals the school database password (F-22). Absent: the connection cannot be saved.
  @IsOptional()
  @Matches(CREDENTIAL_KEY_PATTERN, {
    message:
      'SCHOOL_SYNC_ENCRYPTION_KEY must be the base64 of exactly 32 bytes',
  })
  SCHOOL_SYNC_ENCRYPTION_KEY?: string;

  // Comma-separated school SQL Server host names the operator allows. Empty: only the local simulator.
  @IsOptional()
  @IsString()
  SCHOOL_SYNC_EXTERNAL_HOSTS?: string;

  // F-26: daily database + attachment backups. Off until an operator names a root on another disk.
  @IsIn(['true', 'false'])
  BACKUP_ENABLED: 'true' | 'false' = 'false';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  BACKUP_ROOT?: string;

  @IsString()
  @IsNotEmpty()
  PG_DUMP_PATH: string = 'pg_dump';

  @IsString()
  @IsNotEmpty()
  PG_RESTORE_PATH: string = 'pg_restore';

  @IsInt()
  @Min(ELIGIBILITY_LIMITS.MIN_DEPTH)
  @Max(ELIGIBILITY_LIMITS.MAX_DEPTH)
  ELIGIBILITY_MAX_DEPTH: number = ELIGIBILITY_DEFAULTS.MAX_DEPTH;

  // F-27: structured log verbosity in production.
  @IsIn(LOG_LEVELS)
  LOG_LEVEL: (typeof LOG_LEVELS)[number] = 'info';
}

// Names the offending variables and rules, never their values: the bootstrap log prints only the names.
export class EnvValidationError extends Error {
  readonly code = 'INVALID_ENVIRONMENT';
  constructor(
    readonly properties: string[],
    details: string[],
  ) {
    super(`Invalid environment: ${details.join('; ')}`);
    this.name = 'EnvValidationError';
  }
}

export function validateEnv(raw: Record<string, unknown>): Env {
  const env = plainToInstance(Env, raw, { enableImplicitConversion: true });
  const errors = validateSync(env);
  if (errors.length > 0) {
    const details = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );
    throw new EnvValidationError(
      errors.map((error) => error.property),
      details,
    );
  }
  return env;
}
