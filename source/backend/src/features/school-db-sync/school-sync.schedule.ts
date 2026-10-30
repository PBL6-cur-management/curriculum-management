import type { SchoolSyncCadence } from '../../generated/prisma/client.js';

// The school is on UTC+7 all year (no daylight saving), so its wall time is a fixed offset.
const SCHOOL_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const LOCAL_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface ScheduleRule {
  cadence: SchoolSyncCadence;
  localTime: string;
  // ISO weekday, Monday = 1; WEEKLY only.
  weekday: number | null;
}

export function isLocalTime(value: string): boolean {
  return LOCAL_TIME.test(value);
}

// First slot strictly after `after`. Missed slots are not replayed: the caller asks from "now".
export function nextRunAfter(rule: ScheduleRule, after: Date): Date {
  const match = LOCAL_TIME.exec(rule.localTime);
  if (!match) throw new Error(`Invalid local time ${rule.localTime}`);
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  const local = new Date(after.getTime() + SCHOOL_OFFSET_MS);
  const localMidnight = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  );
  for (let day = 0; day <= 7; day++) {
    const slotLocal = localMidnight + day * DAY_MS + minutes * 60_000;
    if (slotLocal - SCHOOL_OFFSET_MS <= after.getTime()) continue;
    if (rule.cadence === 'WEEKLY') {
      const isoWeekday = new Date(slotLocal).getUTCDay() || 7;
      if (isoWeekday !== rule.weekday) continue;
    }
    return new Date(slotLocal - SCHOOL_OFFSET_MS);
  }
  throw new Error('No slot within a week');
}
