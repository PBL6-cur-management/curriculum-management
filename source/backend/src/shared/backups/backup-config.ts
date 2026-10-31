import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation.js';
import { APP_TIME_ZONE } from '../time/today.js';
import { BACKUP_POLICY } from './backup.constants.js';
import { BACKUP_ERRORS, BackupFailure } from './backup.errors.js';

export interface BackupConfig {
  enabled: boolean;
  root: string | null;
  filesRoot: string;
  databaseUrl: string;
  pgDumpPath: string;
  pgRestorePath: string;
}

type BackupEnv = Pick<
  Env,
  | 'BACKUP_ENABLED'
  | 'BACKUP_ROOT'
  | 'FILES_ROOT'
  | 'DATABASE_URL'
  | 'PG_DUMP_PATH'
  | 'PG_RESTORE_PATH'
>;

export function backupConfig(config: ConfigService<Env, true>): BackupConfig {
  return backupConfigFrom({
    BACKUP_ENABLED: config.get('BACKUP_ENABLED', { infer: true }),
    BACKUP_ROOT: config.get('BACKUP_ROOT', { infer: true }),
    FILES_ROOT: config.get('FILES_ROOT', { infer: true }),
    DATABASE_URL: config.get('DATABASE_URL', { infer: true }),
    PG_DUMP_PATH: config.get('PG_DUMP_PATH', { infer: true }),
    PG_RESTORE_PATH: config.get('PG_RESTORE_PATH', { infer: true }),
  });
}

// The string 'false' is truthy: enabled is exact equality, never a cast.
export function backupConfigFrom(env: BackupEnv): BackupConfig {
  const root = env.BACKUP_ROOT?.trim() ? env.BACKUP_ROOT.trim() : null;
  return {
    enabled: env.BACKUP_ENABLED === 'true',
    root: root && path.isAbsolute(root) ? path.resolve(root) : root,
    filesRoot: path.resolve(env.FILES_ROOT),
    databaseUrl: env.DATABASE_URL,
    pgDumpPath: env.PG_DUMP_PATH,
    pgRestorePath: env.PG_RESTORE_PATH,
  };
}

// The configured root, or a failure saying why there is none: enabled mode never guesses a destination.
export function requireRoot(config: BackupConfig): string {
  if (!config.root) throw new BackupFailure(BACKUP_ERRORS.NOT_CONFIGURED);
  if (!path.isAbsolute(config.root)) {
    throw new BackupFailure(BACKUP_ERRORS.ROOT_INVALID);
  }
  return config.root;
}

const comparable = (p: string) =>
  process.platform === 'win32' ? p.toLowerCase() : p;

// Component-wise containment, case-insensitive on Windows: '/a/bc' is not inside '/a/b'.
export function isInside(parent: string, child: string): boolean {
  const relative = path.relative(comparable(parent), comparable(child));
  return (
    relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
  );
}

export function overlaps(a: string, b: string): boolean {
  return (
    comparable(path.resolve(a)) === comparable(path.resolve(b)) ||
    isInside(a, b) ||
    isInside(b, a)
  );
}

// A real directory, not a link or junction, and not the root of a drive.
export async function assertPlainDirectory(dir: string): Promise<string> {
  const stats = await lstat(dir).catch(() => null);
  if (!stats || !stats.isDirectory() || stats.isSymbolicLink()) {
    throw new BackupFailure(BACKUP_ERRORS.ROOT_INVALID);
  }
  const real = await realpath(dir);
  if (comparable(real) !== comparable(path.resolve(dir))) {
    throw new BackupFailure(BACKUP_ERRORS.ROOT_INVALID);
  }
  if (path.parse(real).root === real) {
    throw new BackupFailure(BACKUP_ERRORS.ROOT_INVALID);
  }
  return real;
}

// BE-01: the backup root and FILES_ROOT must both exist and be disjoint. A different physical disk cannot be
// proven from here (F26-02); the runbook makes the operator check it.
export async function assertSafeRoots(
  root: string,
  filesRoot: string,
): Promise<void> {
  const [realRoot, realFiles] = await Promise.all([
    assertPlainDirectory(root),
    assertPlainDirectory(filesRoot),
  ]);
  if (overlaps(realRoot, realFiles)) {
    throw new BackupFailure(BACKUP_ERRORS.ROOT_INVALID);
  }
}

function localParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
  };
}

// The calendar day whose 02:00 (Vietnam time) is the latest one not after `now`; before 02:00 that is yesterday.
export function latestDueSlot(now: Date): string {
  const { day, hour } = localParts(now);
  if (hour >= BACKUP_POLICY.DUE_HOUR) return day;
  const previous = new Date(`${day}T00:00:00.000Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

// The instant of a slot's 02:00 in Vietnam (UTC+7, no daylight saving).
export function slotInstant(slot: string): Date {
  return new Date(
    `${slot}T${String(BACKUP_POLICY.DUE_HOUR).padStart(2, '0')}:00:00.000+07:00`,
  );
}

export const backupIdOf = (slot: string) => `daily-${slot}`;
