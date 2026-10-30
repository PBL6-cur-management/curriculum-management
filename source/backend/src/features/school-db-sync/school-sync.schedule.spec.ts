import { isLocalTime, nextRunAfter } from './school-sync.schedule.js';

describe('nextRunAfter', () => {
  // 2026-10-31 is a Saturday. 10:00 UTC is 17:00 in Vietnam.
  const now = new Date('2026-10-31T10:00:00.000Z');

  it('runs later today when the school time has not passed', () => {
    expect(
      nextRunAfter({ cadence: 'DAILY', localTime: '18:30', weekday: null }, now),
    ).toEqual(new Date('2026-10-31T11:30:00.000Z'));
  });

  it('runs tomorrow when the school time has passed', () => {
    expect(
      nextRunAfter({ cadence: 'DAILY', localTime: '02:00', weekday: null }, now),
    ).toEqual(new Date('2026-10-31T19:00:00.000Z'));
  });

  it('never returns the instant it was asked from', () => {
    const slot = new Date('2026-10-31T19:00:00.000Z');
    expect(
      nextRunAfter({ cadence: 'DAILY', localTime: '02:00', weekday: null }, slot),
    ).toEqual(new Date('2026-11-01T19:00:00.000Z'));
  });

  it('picks the school weekday, not the UTC weekday', () => {
    // Monday 02:00 in Vietnam is Sunday 19:00 UTC.
    expect(
      nextRunAfter({ cadence: 'WEEKLY', localTime: '02:00', weekday: 1 }, now),
    ).toEqual(new Date('2026-11-01T19:00:00.000Z'));
  });

  it('waits a full week for the same weekday once its time has passed', () => {
    // Saturday 08:00 local has passed at 17:00 local.
    expect(
      nextRunAfter({ cadence: 'WEEKLY', localTime: '08:00', weekday: 6 }, now),
    ).toEqual(new Date('2026-11-07T01:00:00.000Z'));
  });
});

describe('isLocalTime', () => {
  it.each(['00:00', '09:05', '23:59'])('accepts %s', (value) => {
    expect(isLocalTime(value)).toBe(true);
  });
  it.each(['24:00', '9:05', '12:60', '12:00:00'])('rejects %s', (value) => {
    expect(isLocalTime(value)).toBe(false);
  });
});
