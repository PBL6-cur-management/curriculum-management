import { Prisma } from '../../generated/prisma/client.js';
import { compareVersions, creditDistribution } from './report-calculations.js';
import type { ReportItem, ReportVersion } from './report-source.reader.js';
import { levelVisits } from './change-request-statistics.service.js';

const D = (value: number) => new Prisma.Decimal(value);

function item(courseId: string, patch: Partial<ReportItem> = {}): ReportItem {
  return {
    id: `item-${courseId}-${patch.plannedSemester ?? 1}`,
    courseId,
    courseCode: courseId.toUpperCase(),
    courseName: `Học phần ${courseId}`,
    courseType: 'THEORY',
    equivalenceGroupId: null,
    credits: D(3),
    plannedSemester: 1,
    sortOrder: 1,
    isElective: false,
    blockSymbol: 'A',
    electiveGroupCode: null,
    syllabusId: null,
    revision: null,
    ...patch,
  };
}

function version(
  id: string,
  items: ReportItem[],
  patch: Partial<ReportVersion> = {},
): ReportVersion {
  return {
    id,
    programId: `program-${id}`,
    programCode: id.toUpperCase(),
    programName: `Chương trình ${id}`,
    versionNumber: '1.0',
    status: 'ACTIVE',
    decisionNumber: null,
    publishedAt: null,
    majorCode: 'M',
    majorName: 'Ngành',
    semesterCount: 8,
    totalCredits: D(9),
    compulsoryCredits: D(6),
    electiveCredits: D(3),
    items,
    electiveGroups: [],
    plos: [],
    cells: [],
    cloLinks: [],
    ...patch,
  };
}

describe('compareVersions (US-105)', () => {
  it('splits shared, equivalent and exclusive courses and names each difference', () => {
    const left = version('l', [
      item('a'),
      item('b', { plannedSemester: 2, credits: D(4) }),
      item('x', { equivalenceGroupId: 'g1' }),
      item('only-left'),
    ]);
    const right = version('r', [
      item('a'),
      item('b', { plannedSemester: 3, credits: D(4), isElective: true }),
      item('y', { equivalenceGroupId: 'g1' }),
      item('only-right'),
    ]);
    const result = compareVersions(left, right);
    expect(
      result.shared.map((row) => [row.courseCode, row.differences]),
    ).toEqual([
      ['A', []],
      ['B', ['SEMESTER', 'ELECTIVE']],
    ]);
    expect(
      result.equivalent.map((pair) => [
        pair.left.courseCode,
        pair.right.courseCode,
      ]),
    ).toEqual([['X', 'Y']]);
    expect(result.leftOnly.map((row) => row.courseCode)).toEqual(['ONLY-LEFT']);
    expect(result.rightOnly.map((row) => row.courseCode)).toEqual([
      'ONLY-RIGHT',
    ]);
    expect(result.summary).toMatchObject({
      sharedCount: 2,
      equivalentCount: 1,
      sharedCreditsLeft: '7',
    });
  });
});

describe('creditDistribution (US-106, BR-04)', () => {
  it('distributes every row once in each table and keeps elective minimums apart', () => {
    const result = creditDistribution(
      version(
        'v',
        [
          item('a', { blockSymbol: 'A' }),
          item('b', {
            blockSymbol: null,
            plannedSemester: 2,
            courseType: 'PROJECT',
          }),
          item('e1', {
            isElective: true,
            electiveGroupCode: 'G',
            plannedSemester: 2,
          }),
          item('e2', {
            isElective: true,
            electiveGroupCode: 'G',
            plannedSemester: 3,
          }),
        ],
        {
          electiveGroups: [
            {
              groupCode: 'G',
              groupName: 'Nhóm G',
              minCredits: D(3),
              minCourses: null,
            },
          ],
        },
      ),
      new Map([['A', 'Đại cương']]),
    );
    expect(result.totals).toMatchObject({
      allRows: '12',
      compulsory: '6',
      electiveOffered: '6',
      required: '9',
      requiredIsPartial: false,
    });
    for (const table of [
      result.byBlock,
      result.bySemester,
      result.byCourseType,
    ])
      expect(table.reduce((total, row) => total + Number(row.total), 0)).toBe(
        12,
      );
    expect(result.byBlock.map((row) => row.label)).toEqual([
      'Đại cương',
      'Chưa gán khối kiến thức',
    ]);
    expect(result.electiveGroups[0]).toMatchObject({
      minCredits: '3',
      offeredCredits: '6',
    });
  });
});

describe('levelVisits (US-109)', () => {
  const at = (hour: number) => new Date(Date.UTC(2026, 0, 1, hour));
  const step = (
    level: number,
    action: 'APPROVE' | 'RETURN' | 'PENDING',
    recorded: number | null,
    extra = {},
  ) => ({
    submissionRound: 1,
    approvalLevel: level,
    action,
    isSkipped: false,
    recordedAt: recorded === null ? null : at(recorded),
    createdAt: at(0),
    ...extra,
  });

  it('times each deciding level from the previous decision, not from step creation', () => {
    expect(
      levelVisits([
        step(1, 'APPROVE', 2),
        step(2, 'APPROVE', 5),
        step(3, 'PENDING', null),
      ]),
    ).toEqual([
      { approvalLevel: 1, hours: 2 },
      { approvalLevel: 2, hours: 3 },
    ]);
  });

  it('skips skipped levels, waits for parallel approvers and stops at a return', () => {
    expect(
      levelVisits([
        step(1, 'APPROVE', 1),
        step(1, 'PENDING', null),
        step(2, 'APPROVE', 4),
      ]),
    ).toEqual([]);
    expect(
      levelVisits([
        step(1, 'APPROVE', 0, { isSkipped: true }),
        step(2, 'RETURN', 6),
        step(3, 'PENDING', null),
      ]),
    ).toEqual([{ approvalLevel: 2, hours: 6 }]);
  });
});
