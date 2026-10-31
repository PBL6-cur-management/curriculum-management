import { describe, expect, it } from 'vitest';
import { AcademicResultStatus } from '../../../../src/generated/prisma/client.js';
import { resultStatus } from './seed-people.js';

const result = (
  letterGrade: string | null,
  termCode = '2520',
  exempt = false,
) => ({
  letterGrade,
  termCode,
  exempt,
});

describe('resultStatus', () => {
  it.each([
    ['A+', AcademicResultStatus.PASSED],
    ['D', AcademicResultStatus.PASSED],
    ['F', AcademicResultStatus.FAILED],
  ])('maps letter %s', (letter, status) => {
    expect(resultStatus(result(letter), '2610')).toBe(status);
  });
  it('marks an exemption EXEMPT whatever its letter', () => {
    expect(resultStatus(result('A', '2510', true), '2610')).toBe(
      AcademicResultStatus.EXEMPT,
    );
  });
  it('keeps an unfinished row of the open term in progress', () => {
    expect(resultStatus(result(null, '2610'), '2610')).toBe(
      AcademicResultStatus.IN_PROGRESS,
    );
    expect(resultStatus(result('I', '2610'), '2610')).toBe(
      AcademicResultStatus.IN_PROGRESS,
    );
  });
  it('drops an unfinished row of a past term instead of guessing an outcome', () => {
    expect(resultStatus(result('I'), '2610')).toBeNull();
    expect(resultStatus(result(null), '2610')).toBeNull();
  });
});
