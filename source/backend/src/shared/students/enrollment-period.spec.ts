import { describe, expect, it } from 'vitest';
import {
  coversSemester,
  hasKnownEnrollmentBoundaries,
} from './enrollment-period.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('coversSemester', () => {
  const stay = {
    fromStart: day('2025-09-01'),
    untilSemester: { startDate: day('2026-02-01') },
  };

  it('includes the first semester and excludes the one that ends the stay', () => {
    expect(coversSemester(stay, day('2025-09-01'))).toBe(true);
    expect(coversSemester(stay, day('2026-01-31'))).toBe(true);
    expect(coversSemester(stay, day('2026-02-01'))).toBe(false);
  });

  it('excludes semesters before the stay began', () => {
    expect(coversSemester(stay, day('2025-08-31'))).toBe(false);
  });

  it('keeps an open stay covering every later semester', () => {
    const open = { fromStart: day('2025-09-01'), untilSemester: null };
    expect(coversSemester(open, day('2030-01-01'))).toBe(true);
  });

  it('never selects a zero-length stay', () => {
    const empty = {
      fromStart: day('2026-02-01'),
      untilSemester: { startDate: day('2026-02-01') },
    };
    expect(coversSemester(empty, day('2026-02-01'))).toBe(false);
  });

  it('refuses a stay with no known start', () => {
    expect(
      coversSemester(
        { fromStart: null, untilSemester: null },
        day('2026-02-01'),
      ),
    ).toBe(false);
  });

  it('rejects a present end semester with an unknown start rather than opening the stay', () => {
    const unknownEnd = {
      fromStart: day('2025-09-01'),
      untilSemester: { startDate: null },
    };
    expect(hasKnownEnrollmentBoundaries(unknownEnd)).toBe(false);
    expect(coversSemester(unknownEnd, day('2026-09-01'))).toBe(false);
    expect(
      hasKnownEnrollmentBoundaries({ ...unknownEnd, untilSemester: null }),
    ).toBe(true);
  });
});
