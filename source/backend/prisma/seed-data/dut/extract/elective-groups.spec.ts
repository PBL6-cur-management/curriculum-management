import { describe, expect, it } from 'vitest';
import { buildElectiveLayout, type FrameRowInput } from './elective-groups.js';

let next = 0;
const row = (
  semester: number,
  courseCode: string,
  isElective: boolean,
  note = '',
): FrameRowInput => ({
  key: `${courseCode}-${next++}`,
  semester,
  courseCode,
  isElective,
  note,
});
const credits = new Map([
  ['C3', '3'],
  ['C2', '2'],
  ['E2a', '2'],
  ['E2b', '2'],
  ['E3a', '3'],
  ['E3b', '3'],
  ['E3c', '3'],
]);

describe('buildElectiveLayout', () => {
  it('anchors a "Chọn k trong n" group and fills it with blank-note rows', () => {
    const rows = [
      row(1, 'C3', false),
      row(1, 'E2a', true, 'Chọn 1 trong 3'),
      row(1, 'E2b', true, ''),
      row(1, 'E3a', true, 'x'),
    ];
    const layout = buildElectiveLayout({
      rows,
      credits,
      semesterBudgets: new Map(),
      totalCredits: '5',
      declaredElectiveCredits: '2',
    });
    expect(layout.groups).toEqual([
      {
        groupCode: 'HK1-1',
        groupName: 'Chọn 1 trong 3',
        minCourses: 1,
        minCredits: null,
      },
    ]);
    expect(
      rows.every((entry) => entry.isElective === layout.groupOf.has(entry.key)),
    ).toBe(true);
    expect(layout.balanced).toBe(true);
    expect(layout.listSizeMismatches).toBe(0);
  });

  it('puts direction-labelled rows in the semester group, budgeted by tmKhungTC', () => {
    const rows = [
      row(7, 'C3', false),
      row(7, 'E3a', true, 'ATTT'),
      row(7, 'E3b', true, 'Mạng'),
    ];
    const layout = buildElectiveLayout({
      rows,
      credits,
      semesterBudgets: new Map([[7, '3']]),
      totalCredits: '6',
      declaredElectiveCredits: '3',
    });
    expect(layout.groups).toEqual([
      {
        groupCode: 'HK7-1',
        groupName: 'Tự chọn HK7',
        minCourses: null,
        minCredits: '3',
      },
    ]);
    expect(layout.balanced).toBe(true);
  });

  it('turns compulsory-flagged direction courses into electives when the frame over-counts compulsory credits', () => {
    const rows = [
      row(7, 'C2', false),
      row(7, 'E3a', true, 'ATTT'),
      row(7, 'E3b', true, 'HTTT'),
      row(7, 'E3c', false, 'ATTT'),
      row(7, 'E2a', false, 'HTTT'),
    ];
    const layout = buildElectiveLayout({
      rows,
      credits,
      semesterBudgets: new Map(),
      totalCredits: '8',
      declaredElectiveCredits: '6',
    });
    expect(layout.reclassifiedRows).toBe(2);
    expect(layout.compulsoryCredits).toBe('2');
    expect(layout.electiveCredits).toBe('6');
    expect(layout.groups).toEqual([
      {
        groupCode: 'HK7-1',
        groupName: 'Tự chọn HK7',
        minCourses: null,
        minCredits: '6',
      },
    ]);
    expect(layout.balanced).toBe(true);
  });

  it('splits what remains: one course from earlier unbudgeted groups, the rest from the last', () => {
    const rows = [
      row(5, 'C3', false),
      row(5, 'E2a', true, 'KTMT'),
      row(6, 'E3a', true, 'KTMT'),
      row(6, 'E3b', true, 'CNPM'),
    ];
    const layout = buildElectiveLayout({
      rows,
      credits,
      semesterBudgets: new Map(),
      totalCredits: '11',
      declaredElectiveCredits: '8',
    });
    expect(layout.groups).toEqual([
      {
        groupCode: 'HK5-1',
        groupName: 'Tự chọn HK5',
        minCourses: 1,
        minCredits: null,
      },
      {
        groupCode: 'HK6-1',
        groupName: 'Tự chọn HK6',
        minCourses: null,
        minCredits: '6',
      },
    ]);
    expect(layout.requiredCredits).toBe('11');
  });

  it('reports a frame whose minima cannot reach the declared total', () => {
    const layout = buildElectiveLayout({
      rows: [row(1, 'C3', false), row(1, 'E3a', true, 'Chọn 1 trong 1')],
      credits,
      semesterBudgets: new Map(),
      totalCredits: '9',
      declaredElectiveCredits: '6',
    });
    expect(layout.balanced).toBe(false);
    expect(layout.requiredCredits).toBe('6');
  });
});
