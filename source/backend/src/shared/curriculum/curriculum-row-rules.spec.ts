import { describe, expect, it } from 'vitest';
import { CourseStatus } from '../../generated/prisma/client.js';
import { isCourseAddable, isSemesterInRange } from './curriculum-row-rules.js';

describe('curriculum row rules', () => {
  it.each([
    [0, false],
    [1, true],
    [8, true],
    [9, false],
    [2.5, false],
    [NaN, false],
    [-1, false],
  ])('semester %s in eight semesters: %s', (semester, expected) => {
    expect(isSemesterInRange(8, semester)).toBe(expected);
  });
  it.each(Object.values(CourseStatus))(
    'only ACTIVE is addable: %s',
    (status) => {
      expect(isCourseAddable(status)).toBe(status === CourseStatus.ACTIVE);
    },
  );
});
