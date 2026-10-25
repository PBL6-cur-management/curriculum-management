import { describe, expect, it } from 'vitest';
import {
  CourseRelationType,
  CourseType,
} from '../../../src/generated/prisma/client.js';
import {
  cohortFromLegacyCode,
  courseTypeFor,
  legacyDecimal,
  parseElectiveNote,
  pickRelationType,
  releasedStatuses,
  requisiteTypeFor,
  semesterFromLegacyCode,
  sortOrders,
} from './legacy-mapping.js';
const defaults = {
  loaiHp: '',
  datn: '',
  lyThuyet: '0',
  thucTap: '0',
  doAn: '0',
};
describe('legacy mappings', () => {
  it.each([
    [{ loaiHp: '1', datn: '1' }, CourseType.CONDITIONAL],
    [{ loaiHp: '3', datn: '1' }, CourseType.LAB],
    [{ datn: '1', thucTap: '1' }, CourseType.CAPSTONE],
    [{ thucTap: '1', doAn: '1' }, CourseType.INTERNSHIP],
    [{ doAn: '1' }, CourseType.PROJECT],
    [{ lyThuyet: '1', doAn: '1', thucTap: '1' }, CourseType.THEORY],
    [{}, CourseType.THEORY],
  ])('classifies course flags %j', (flags, expected) => {
    expect(courseTypeFor({ ...defaults, ...flags })).toBe(expected);
  });
  it.each([
    ['0', CourseRelationType.PRIOR],
    ['1', CourseRelationType.PREREQUISITE],
    ['2', CourseRelationType.COREQUISITE],
  ])('maps requisite code %s', (code, expected) => {
    expect(requisiteTypeFor(code)).toBe(expected);
  });
  it('rejects unknown requisite codes', () => {
    expect(() => requisiteTypeFor('9')).toThrow();
  });
  it.each([
    ['2110', 1],
    ['2120', 2],
    ['2121', 3],
  ])('maps semester %s', (code, term) => {
    expect(semesterFromLegacyCode(code)).toEqual({
      semesterCode: `2021-2022-${term}`,
      academicYear: '2021-2022',
      termInYear: term,
    });
  });
  it.each(['', '2199', '21100', 'abcd'])('rejects semester %s', (code) => {
    expect(() => semesterFromLegacyCode(code)).toThrow();
  });
  it('maps a cohort', () => {
    expect(cohortFromLegacyCode('2510')).toEqual({
      cohortCode: 'K2025',
      intakeYear: 2025,
    });
  });
  it.each([
    ['Chọn 2 trong 5', { minCourses: 2 }],
    ['chọn 6 TC', { minCredits: '6' }],
    ['Chọn 2,5 TC', { minCredits: '2.5' }],
    ['Chọn 2.5 TC', { minCredits: '2.5' }],
    ['KTMT', null],
    ['', null],
  ])('parses an elective note %s', (note, expected) => {
    expect(parseElectiveNote(note)).toEqual(expected);
  });
  it('ranks STT numerically', () => {
    expect(sortOrders(['3', '10', '9'])).toEqual([1, 3, 2]);
  });
  it('rejects nonnumeric STT', () => {
    expect(() => sortOrders(['bad'])).toThrow();
  });
  it('prefers the stronger tied type', () => {
    expect(
      pickRelationType(
        new Map([
          [CourseRelationType.PRIOR, 2],
          [CourseRelationType.PREREQUISITE, 2],
        ]),
      ),
    ).toBe(CourseRelationType.PREREQUISITE);
  });
  it('prefers a majority over strength', () => {
    expect(
      pickRelationType(
        new Map([
          [CourseRelationType.COREQUISITE, 3],
          [CourseRelationType.PREREQUISITE, 2],
        ]),
      ),
    ).toBe(CourseRelationType.COREQUISITE);
  });
  it('rejects an empty vote', () => {
    expect(() => pickRelationType(new Map())).toThrow();
  });
  const starts = [
    new Date('2021-08-02'),
    new Date('2022-08-01'),
    new Date('2023-07-31'),
  ];
  it('marks all-past releases', () => {
    expect(releasedStatuses(starts, new Date('2025-01-01'))).toEqual([
      'HISTORICAL',
      'HISTORICAL',
      'ACTIVE',
    ]);
  });
  it('marks mixed releases inclusively', () => {
    expect(releasedStatuses(starts, starts[1])).toEqual([
      'HISTORICAL',
      'ACTIVE',
      'PENDING',
    ]);
  });
  it('permits all-future releases', () => {
    expect(releasedStatuses(starts, new Date('2020-01-01'))).toEqual([
      'PENDING',
      'PENDING',
      'PENDING',
    ]);
  });
  it('permits no releases', () => {
    expect(releasedStatuses([], starts[0])).toEqual([]);
  });
  it('rejects descending release dates', () => {
    expect(() => releasedStatuses([...starts].reverse(), starts[0])).toThrow();
  });
  it.each([
    ['', '0'],
    ['2,5', '2.5'],
    ['2.50', '2.5'],
    ['0', '0'],
  ])('normalizes decimal %s', (value, expected) => {
    expect(legacyDecimal(value)).toBe(expected);
  });
  it.each(['NaN', '2x', '-1', 'Infinity'])('rejects decimal %s', (value) => {
    expect(() => legacyDecimal(value)).toThrow();
  });
});
