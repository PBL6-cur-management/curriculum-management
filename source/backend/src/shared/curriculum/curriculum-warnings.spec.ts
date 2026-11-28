import { describe, expect, it } from 'vitest';
import { CourseRelationType, Prisma } from '../../generated/prisma/client.js';
import {
  CURRICULUM_WARNING,
  WARNING_SEVERITY,
  curriculumWarnings,
  type WarningGroup,
  type WarningItem,
} from './curriculum-warnings.js';

function item(
  code: string,
  plannedSemester: number,
  requisites: WarningItem['requisites'] = [],
  patch: Partial<WarningItem> = {},
): WarningItem {
  return {
    id: `item-${code}`,
    courseId: `course-${code}`,
    courseCode: code,
    plannedSemester,
    credits: new Prisma.Decimal(3),
    isElective: false,
    electiveGroupId: null,
    requisites,
    ...patch,
  };
}

const needs = (code: string, relationType: CourseRelationType) => ({
  sourceCourseId: `course-${code}`,
  sourceCourseCode: code,
  relationType,
});

function group(patch: Partial<WarningGroup> = {}): WarningGroup {
  return {
    id: 'g1',
    groupCode: 'TC1',
    minCredits: null,
    minCourses: null,
    ...patch,
  };
}

const run = (semesterCount: number, items: WarningItem[], groups = []) =>
  curriculumWarnings({ semesterCount, items, groups });

const only = (code: string, warnings: ReturnType<typeof run>) =>
  warnings.filter((warning) => warning.code === code);

describe('curriculumWarnings', () => {
  it('reports an empty semester with an info warning (KB-016)', () => {
    const rows = [1, 2, 3, 4, 5, 6, 7].map((semester) =>
      item(`C${semester}`, semester),
    );

    expect(run(8, rows)).toEqual([
      {
        code: CURRICULUM_WARNING.EMPTY_SEMESTER,
        severity: WARNING_SEVERITY.INFO,
        message: 'Học kỳ 8 chưa có học phần nào.',
        semester: 8,
        itemId: null,
        groupId: null,
      },
    ]);
  });

  it('flags a prerequisite planned in a later semester, naming both courses (KB-019)', () => {
    const rows = [
      item('B', 4, [needs('A', CourseRelationType.PREREQUISITE)]),
      item('A', 5),
    ];

    const warnings = only(
      CURRICULUM_WARNING.REQUISITE_NOT_EARLIER,
      run(5, rows),
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      severity: WARNING_SEVERITY.HIGH,
      semester: 4,
      itemId: 'item-B',
    });
    expect(warnings[0].message).toContain('học kỳ 5');
  });

  it('flags a requisite planned in the same semester', () => {
    const rows = [
      item('B', 3, [needs('A', CourseRelationType.PRIOR)]),
      item('A', 3),
    ];
    expect(
      only(CURRICULUM_WARNING.REQUISITE_NOT_EARLIER, run(3, rows)),
    ).toHaveLength(1);
  });

  it('does not flag a prerequisite planned earlier or a corequisite planned later', () => {
    const rows = [
      item('B', 3, [needs('A', CourseRelationType.PREREQUISITE)]),
      item('D', 2, [needs('E', CourseRelationType.COREQUISITE)]),
      item('A', 2),
      item('E', 3),
      item('C', 1),
    ];
    expect(run(3, rows)).toEqual([]);
  });

  it('warns about a requisite outside the curriculum, naming both courses (KB-021)', () => {
    const rows = [item('B', 1, [needs('X', CourseRelationType.PREREQUISITE)])];
    const warnings = only(CURRICULUM_WARNING.REQUISITE_OUTSIDE, run(1, rows));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      severity: WARNING_SEVERITY.HIGH,
      itemId: 'item-B',
    });
    expect(warnings[0].message).toContain('B');
    expect(warnings[0].message).toContain('X');
  });

  it('warns about a corequisite outside the curriculum too', () => {
    const rows = [item('B', 1, [needs('X', CourseRelationType.COREQUISITE)])];
    expect(
      only(CURRICULUM_WARNING.REQUISITE_OUTSIDE, run(1, rows)),
    ).toHaveLength(1);
  });

  it('reports a course listed twice once, as an error naming the semesters', () => {
    const rows = [
      item('A', 2, [], { id: 'first' }),
      item('A', 5, [], { id: 'second' }),
    ];
    const warnings = only(CURRICULUM_WARNING.DUPLICATE_COURSE, run(5, rows));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      severity: WARNING_SEVERITY.ERROR,
      itemId: 'second',
    });
    expect(warnings[0].message).toContain('2, 5');
  });

  it('allows the same course in two different tracks but flags common-core + track overlap', () => {
    const differentTracks = [
      item('A', 3, [], { id: 't1-a', trackId: 'track-1' }),
      item('A', 3, [], { id: 't2-a', trackId: 'track-2' }),
    ];
    expect(
      only(CURRICULUM_WARNING.DUPLICATE_COURSE, run(3, differentTracks)),
    ).toEqual([]);

    const commonAndTrack = [
      item('A', 2, [], { id: 'common-a', trackId: null }),
      item('A', 3, [], { id: 't1-a', trackId: 'track-1' }),
    ];
    expect(
      only(CURRICULUM_WARNING.DUPLICATE_COURSE, run(3, commonAndTrack)),
    ).toHaveLength(1);
  });

  it('flags an elective row with no group and still counts nothing for it', () => {
    const rows = [item('E', 1, [], { isElective: true })];
    const warnings = only(
      CURRICULUM_WARNING.ELECTIVE_WITHOUT_GROUP,
      run(1, rows),
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe(WARNING_SEVERITY.HIGH);
  });

  it('flags a group whose members cannot reach its credit minimum', () => {
    const rows = [1, 2].map((n) =>
      item(`E${n}`, 1, [], { isElective: true, electiveGroupId: 'g1' }),
    );
    const warnings = curriculumWarnings({
      semesterCount: 1,
      items: rows,
      groups: [group({ minCredits: new Prisma.Decimal(9) })],
    });
    expect(
      only(CURRICULUM_WARNING.GROUP_MINIMUM_UNREACHABLE, warnings),
    ).toEqual([
      expect.objectContaining({
        severity: WARNING_SEVERITY.ERROR,
        groupId: 'g1',
        itemId: null,
      }),
    ]);
  });

  it('flags a group with fewer members than its course minimum', () => {
    const rows = [1, 2].map((n) =>
      item(`E${n}`, 1, [], { isElective: true, electiveGroupId: 'g1' }),
    );
    const warnings = curriculumWarnings({
      semesterCount: 1,
      items: rows,
      groups: [group({ minCourses: 3 })],
    });
    expect(
      only(CURRICULUM_WARNING.GROUP_MINIMUM_UNREACHABLE, warnings),
    ).toHaveLength(1);
  });

  it('accepts a group that reaches its minimum', () => {
    const rows = [1, 2, 3].map((n) =>
      item(`E${n}`, 1, [], { isElective: true, electiveGroupId: 'g1' }),
    );
    const warnings = curriculumWarnings({
      semesterCount: 1,
      items: rows,
      groups: [group({ minCredits: new Prisma.Decimal(6), minCourses: 2 })],
    });
    expect(warnings).toEqual([]);
  });

  it('does not cross-check requisite semester against a different track row', () => {
    const rows = [
      // course-A is semester 6 in track-1 (valid) and semester 8 in track-2 (later)
      item('A', 6, [], { id: 't1-a', trackId: 'track-1' }),
      item('A', 8, [], { id: 't2-a', trackId: 'track-2' }),
      item('B', 7, [needs('A', CourseRelationType.PREREQUISITE)], {
        id: 't1-b',
        trackId: 'track-1',
      }),
      item('C', 7, [needs('A', CourseRelationType.PREREQUISITE)], {
        id: 't2-c',
        trackId: 'track-2',
      }),
      // course-D only exists in track-2 at semester 8; track-1 item at semester 6 should not cross-check it
      item('D', 8, [], { id: 't2-d', trackId: 'track-2' }),
      item('E', 6, [needs('D', CourseRelationType.PRIOR)], {
        id: 't1-e',
        trackId: 'track-1',
      }),
      // common-core requisite is still checked for track items
      item('CORE', 7, [], { id: 'common-core', trackId: null }),
      item('F', 6, [needs('CORE', CourseRelationType.PREREQUISITE)], {
        id: 't1-f',
        trackId: 'track-1',
      }),
    ];

    const warnings = only(
      CURRICULUM_WARNING.REQUISITE_NOT_EARLIER,
      run(8, rows),
    );
    expect(warnings.map((w) => w.itemId)).toEqual(['t1-f', 't2-c']);
  });

  it('orders errors, then high, then info', () => {
    const rows = [
      item('A', 1, [needs('X', CourseRelationType.PREREQUISITE)]),
      item('A', 1, [], { id: 'dup' }),
    ];
    const severities = run(2, rows).map((warning) => warning.severity);
    expect(severities).toEqual(['ERROR', 'HIGH', 'INFO']);
  });
});
