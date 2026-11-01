import { describe, expect, it } from 'vitest';
import type { Semester } from '../../../shared/releases/semesters';
import { currentSemester } from './currentSemester';

const semester = (id: string, startDate: string | null) =>
  ({ id, startDate }) as unknown as Semester;

describe('currentSemester', () => {
  it('picks the latest semester already started', () => {
    const list = [
      semester('a', '2025-08-15'),
      semester('c', '2026-12-01'),
      semester('b', '2026-01-10'),
      semester('x', null),
    ];
    expect(currentSemester(list, '2026-11-01')?.id).toBe('b');
  });
  it('falls back to the first dated semester before any has started', () => {
    expect(
      currentSemester(
        [semester('c', '2027-01-01'), semester('x', null)],
        '2026-11-01',
      )?.id,
    ).toBe('c');
    expect(currentSemester([semester('x', null)])).toBeUndefined();
  });
});
