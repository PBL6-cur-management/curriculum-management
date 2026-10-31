import dayjs from 'dayjs';
import { NO_RECORD } from '../constants/backupLabels';

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
const BYTE_STEP = 1024n;
const BYTE_PRECISION = 1;

// null means "not recorded"; zero is a real measurement and is shown as such.
export function formatRecoveryMs(value: number | null): string {
  if (value === null) return NO_RECORD;
  if (value < MS_PER_SECOND) return `${value} ms`;
  const seconds = Math.round(value / MS_PER_SECOND);
  if (seconds < SECONDS_PER_MINUTE) return `${seconds} giây`;
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  const rest = seconds % SECONDS_PER_MINUTE;
  return rest === 0 ? `${minutes} phút` : `${minutes} phút ${rest} giây`;
}

// Byte counts arrive as decimal strings so they survive beyond Number.MAX_SAFE_INTEGER.
export function formatBackupBytes(value: string | null): string {
  if (value === null || !/^\d+$/.test(value)) return NO_RECORD;
  let whole = BigInt(value);
  let unit = 0;
  let remainder = 0n;
  while (whole >= BYTE_STEP && unit < BYTE_UNITS.length - 1) {
    remainder = whole % BYTE_STEP;
    whole /= BYTE_STEP;
    unit += 1;
  }
  if (unit === 0) return `${whole} ${BYTE_UNITS[0]}`;
  const fraction = Number(remainder) / Number(BYTE_STEP);
  return `${(Number(whole) + fraction).toFixed(BYTE_PRECISION)} ${BYTE_UNITS[unit]}`;
}

export function formatBackupTime(iso: string | null): string {
  return iso ? dayjs(iso).format('DD/MM/YYYY HH:mm') : NO_RECORD;
}
