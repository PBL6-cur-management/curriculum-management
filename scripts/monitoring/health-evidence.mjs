// F-27 BE-05. Pure availability maths over collected /api/health samples. Built-ins only, no I/O.
// A sample only counts as UP when the endpoint answered 200 AND every dependency reported healthy.

export const HEARTBEAT_SECONDS = 60;
export const PROBE_TIMEOUT_MS = 10_000;
export const TRIAL_DAYS = 28;
export const TARGET_AVAILABILITY = 0.99;

const MINUTE_MS = 60_000;

/**
 * @typedef {{
 *   timestamp: string,
 *   httpStatus: number | null,
 *   status: 'ok' | 'error' | null,
 *   database: 'up' | 'down' | null,
 *   redis: 'up' | 'down' | null,
 *   elapsedMs: number,
 * }} HealthSample
 * @typedef {{ confirmed: boolean, timeZone: 'Asia/Ho_Chi_Minh', intervals: { start: string, end: string }[] }} ObservationCalendar
 */

/** @param {HealthSample} sample @returns {'UP' | 'DOWN'} */
export function classifySample(sample) {
  return sample.httpStatus === 200 &&
    sample.status === 'ok' &&
    sample.database === 'up' &&
    sample.redis === 'up'
    ? 'UP'
    : 'DOWN';
}

/** @param {string} iso */
function instant(iso) {
  const value = Date.parse(iso);
  if (Number.isNaN(value)) throw new Error(`Thời điểm không hợp lệ: ${iso}`);
  return value;
}

const slotOf = (ms) => Math.floor(ms / MINUTE_MS);

/**
 * @param {{ samples: HealthSample[], from: string, to: string, calendar: ObservationCalendar | null }} input
 */
export function summarizeAvailability({ samples, from, to, calendar }) {
  const start = instant(from);
  const end = instant(to);
  if (end <= start) throw new Error('Khoảng quan sát phải có to > from.');

  const confirmed = Boolean(
    calendar && calendar.confirmed === true && calendar.intervals.length > 0,
  );
  const intervals = confirmed
    ? calendar.intervals.map((interval) => {
        const intervalStart = instant(interval.start);
        const intervalEnd = instant(interval.end);
        if (intervalEnd <= intervalStart)
          throw new Error('Khoảng làm việc phải có end > start.');
        return [intervalStart, intervalEnd];
      })
    : [[start, end]];

  // At most one valid classification per UTC minute slot; disagreeing duplicates are rejected, not cherry-picked.
  const bySlot = new Map();
  for (const sample of samples) {
    const slot = slotOf(instant(sample.timestamp));
    const verdict = classifySample(sample);
    const known = bySlot.get(slot);
    if (known && known !== verdict)
      throw new Error(
        `Hai mẫu mâu thuẫn trong cùng một phút: ${new Date(slot * MINUTE_MS).toISOString()}`,
      );
    bySlot.set(slot, verdict);
  }

  let eligibleMinutes = 0;
  let upMinutes = 0;
  let downMinutes = 0;
  for (let slot = slotOf(start); slot * MINUTE_MS < end; slot += 1) {
    const slotStart = slot * MINUTE_MS;
    if (slotStart < start) continue;
    if (!intervals.some(([from_, to_]) => slotStart >= from_ && slotStart < to_))
      continue;
    eligibleMinutes += 1;
    const verdict = bySlot.get(slot);
    if (verdict === 'UP') upMinutes += 1;
    else if (verdict === 'DOWN') downMinutes += 1;
  }
  // Missing slots are unknown, and unknown stays in the denominator: a gap is never silently "up".
  const unknownMinutes = eligibleMinutes - upMinutes - downMinutes;
  return {
    eligibleMinutes,
    upMinutes,
    downMinutes,
    unknownMinutes,
    availability: eligibleMinutes === 0 ? null : upMinutes / eligibleMinutes,
    businessHoursVerified: confirmed,
  };
}
