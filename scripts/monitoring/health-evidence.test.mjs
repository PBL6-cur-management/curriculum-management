import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifySample,
  summarizeAvailability,
  TARGET_AVAILABILITY,
} from './health-evidence.mjs';

const up = (timestamp) => ({
  timestamp,
  httpStatus: 200,
  status: 'ok',
  database: 'up',
  redis: 'up',
  elapsedMs: 12,
});
const down = (timestamp, patch = {}) => ({
  timestamp,
  httpStatus: 503,
  status: 'error',
  database: 'down',
  redis: 'up',
  elapsedMs: 12,
  ...patch,
});

test('only a 200 with ok/up/up counts as UP', () => {
  assert.equal(classifySample(up('2026-10-31T00:00:00Z')), 'UP');
  assert.equal(classifySample(down('2026-10-31T00:00:00Z')), 'DOWN');
  assert.equal(
    classifySample(up('2026-10-31T00:00:00Z', { redis: 'down' })),
    'UP',
    'object spread order: the up() helper ignores its second argument',
  );
  assert.equal(
    classifySample({ ...up('2026-10-31T00:00:00Z'), redis: 'down' }),
    'DOWN',
  );
  assert.equal(
    classifySample({ ...up('2026-10-31T00:00:00Z'), httpStatus: null }),
    'DOWN',
  );
});

test('a network error or invalid JSON (all null) is DOWN, never up', () => {
  assert.equal(
    classifySample({
      timestamp: '2026-10-31T00:00:00Z',
      httpStatus: null,
      status: null,
      database: null,
      redis: null,
      elapsedMs: 10_000,
    }),
    'DOWN',
  );
});

test('missing minutes are unknown and stay in the denominator', () => {
  const result = summarizeAvailability({
    samples: [up('2026-10-31T00:00:10Z'), up('2026-10-31T00:02:10Z')],
    from: '2026-10-31T00:00:00Z',
    to: '2026-10-31T00:04:00Z',
    calendar: null,
  });
  assert.equal(result.eligibleMinutes, 4);
  assert.equal(result.upMinutes, 2);
  assert.equal(result.downMinutes, 0);
  assert.equal(result.unknownMinutes, 2);
  assert.equal(result.availability, 0.5);
});

test('down minutes count against availability', () => {
  const result = summarizeAvailability({
    samples: [
      up('2026-10-31T00:00:10Z'),
      down('2026-10-31T00:01:10Z'),
      up('2026-10-31T00:02:10Z'),
      up('2026-10-31T00:03:10Z'),
    ],
    from: '2026-10-31T00:00:00Z',
    to: '2026-10-31T00:04:00Z',
    calendar: null,
  });
  assert.equal(result.downMinutes, 1);
  assert.equal(result.availability, 0.75);
  assert.ok(result.availability < TARGET_AVAILABILITY);
});

test('two samples in one minute are merged when they agree and rejected when they do not', () => {
  const merged = summarizeAvailability({
    samples: [up('2026-10-31T00:00:05Z'), up('2026-10-31T00:00:50Z')],
    from: '2026-10-31T00:00:00Z',
    to: '2026-10-31T00:01:00Z',
    calendar: null,
  });
  assert.equal(merged.upMinutes, 1);
  assert.throws(
    () =>
      summarizeAvailability({
        samples: [up('2026-10-31T00:00:05Z'), down('2026-10-31T00:00:50Z')],
        from: '2026-10-31T00:00:00Z',
        to: '2026-10-31T00:01:00Z',
        calendar: null,
      }),
    /mâu thuẫn/,
  );
});

test('without a confirmed calendar the result is a 24/7 diagnostic, not business-hours proof', () => {
  const none = summarizeAvailability({
    samples: [],
    from: '2026-10-31T00:00:00Z',
    to: '2026-10-31T00:02:00Z',
    calendar: null,
  });
  assert.equal(none.businessHoursVerified, false);
  const unconfirmed = summarizeAvailability({
    samples: [],
    from: '2026-10-31T00:00:00Z',
    to: '2026-10-31T00:02:00Z',
    calendar: {
      confirmed: false,
      timeZone: 'Asia/Ho_Chi_Minh',
      intervals: [
        { start: '2026-10-31T00:00:00Z', end: '2026-10-31T00:01:00Z' },
      ],
    },
  });
  assert.equal(unconfirmed.businessHoursVerified, false);
  assert.equal(unconfirmed.eligibleMinutes, 2);
});

test('a confirmed calendar uses half-open intervals', () => {
  const result = summarizeAvailability({
    samples: [
      up('2026-10-31T00:00:10Z'),
      up('2026-10-31T00:01:10Z'),
      down('2026-10-31T00:02:10Z'),
    ],
    from: '2026-10-31T00:00:00Z',
    to: '2026-10-31T00:04:00Z',
    calendar: {
      confirmed: true,
      timeZone: 'Asia/Ho_Chi_Minh',
      intervals: [
        { start: '2026-10-31T00:00:00Z', end: '2026-10-31T00:02:00Z' },
      ],
    },
  });
  assert.equal(result.eligibleMinutes, 2);
  assert.equal(result.upMinutes, 2);
  assert.equal(result.downMinutes, 0, 'the 00:02 outage is outside the interval');
  assert.equal(result.availability, 1);
  assert.equal(result.businessHoursVerified, true);
});

test('a zero denominator gives null, never 100%', () => {
  const result = summarizeAvailability({
    samples: [up('2026-10-31T05:00:10Z')],
    from: '2026-10-31T00:00:00Z',
    to: '2026-10-31T00:02:00Z',
    calendar: {
      confirmed: true,
      timeZone: 'Asia/Ho_Chi_Minh',
      intervals: [
        { start: '2026-10-31T10:00:00Z', end: '2026-10-31T11:00:00Z' },
      ],
    },
  });
  assert.equal(result.eligibleMinutes, 0);
  assert.equal(result.availability, null);
});

test('rejects an empty or reversed observation window', () => {
  assert.throws(
    () =>
      summarizeAvailability({
        samples: [],
        from: '2026-10-31T00:02:00Z',
        to: '2026-10-31T00:00:00Z',
        calendar: null,
      }),
    /to > from/,
  );
});
