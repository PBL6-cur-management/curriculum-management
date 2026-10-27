import { describe, expect, it, vi } from 'vitest';
import {
  CourseRelationType,
  CourseStatus,
  Prisma,
} from '../../../generated/prisma/client.js';
import { CURRICULUM_WARNING } from '../../../shared/curriculum/curriculum-warnings.js';
import {
  CURRICULUM_SHEET,
  type CurriculumColumnKey,
} from '../sheets/curriculum.sheet.js';
import type { SheetRow } from '../sheets/sheet-reader.js';
import {
  loadCurriculumContext,
  type CurriculumContext,
  type CurriculumCourseRow,
} from './curriculum-context.js';
import { validateCurriculumRows } from './curriculum-validator.js';
import { IMPORT_ISSUE } from './import-issues.js';
import { IssueCollector, sortIssues } from './import-report.js';

function course(code: string): CurriculumCourseRow {
  return {
    id: code,
    courseCode: code,
    courseName: `Tên ${code}`,
    credits: new Prisma.Decimal(3),
    status: CourseStatus.ACTIVE,
  };
}
function context(): CurriculumContext {
  return {
    version: {
      id: 'version',
      semesterCount: 8,
      totalCredits: new Prisma.Decimal(6),
      compulsoryCredits: new Prisma.Decimal(6),
      electiveCredits: new Prisma.Decimal(0),
    },
    program: {
      programCode: '1024034',
      programName: 'CNTT',
      majorCode: '7480201',
    },
    coursesByCode: new Map(
      ['A', 'B', '3190111', '3190121'].map((code) => [code, course(code)]),
    ),
    existingItems: new Map(),
    groups: [],
    catalogEdges: [],
    catalogMinScores: new Map(),
  };
}
function row(
  rowNumber = 15,
  overrides: Partial<Record<CurriculumColumnKey, string>> = {},
): SheetRow<CurriculumColumnKey> {
  return {
    rowNumber,
    cells: {
      sequence: '',
      blockSymbol: '',
      courseCode: 'A',
      courseName: 'Tên A',
      credits: '3.00',
      plannedSemester: '2',
      isElective: '',
      htDa: '',
      tqDa: '',
      minStudiedScore: '',
      minTransferScore: '',
      registrable: '',
      priorCourses: '',
      corequisites: '',
      prerequisites: '',
      note: '',
      ...overrides,
    },
  };
}
function validate(rows: SheetRow<CurriculumColumnKey>[], loaded = context()) {
  return validateCurriculumRows({ header: {}, rows }, loaded);
}

describe('curriculum validator', () => {
  it('reports unknown columns without blocking the curriculum', () => {
    const result = validateCurriculumRows(
      { header: {}, rows: [row()], unknownColumns: ['Riêng'] },
      context(),
    );
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({
        rowNumber: null,
        code: IMPORT_ISSUE.UNKNOWN_COLUMN,
        severity: 'INFO',
        column: 'Riêng',
      }),
    );
    expect(result.errorRows).toBe(0);
  });
  it('names an unknown course on its real spreadsheet row', () => {
    const result = validate([row(15, { courseCode: 'UNKNOWN' })]);
    expect(result.errorRows).toBe(1);
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({
        rowNumber: 15,
        code: IMPORT_ISSUE.COURSE_UNKNOWN,
        column: 'Mã HP',
        message: expect.stringContaining('UNKNOWN'),
      }),
    );
  });
  it('refuses semester 9 of 8 and a non-integer semester', () => {
    expect(
      validate([row(15, { plannedSemester: '9' })]).report.issues,
    ).toContainEqual(
      expect.objectContaining({ code: IMPORT_ISSUE.SEMESTER_OUT_OF_RANGE }),
    );
    expect(
      validate([row(15, { plannedSemester: '2.5' })]).report.issues,
    ).toContainEqual(
      expect.objectContaining({ code: IMPORT_ISSUE.VALUE_INVALID }),
    );
  });
  it('marks only the repeated course and names its first row', () => {
    const result = validate([row(4), row(17)]);
    const duplicates = result.report.issues.filter(
      (issue) => issue.code === CURRICULUM_WARNING.DUPLICATE_COURSE,
    );
    expect(duplicates).toEqual([
      expect.objectContaining({
        rowNumber: 17,
        message: expect.stringContaining('4'),
      }),
    ]);
    expect(result.plan.rows).toHaveLength(1);
    expect(result.errorRows).toBe(1);
  });
  it('combines catalog and file edges into a blocking cycle with a course-code path', () => {
    const loaded = context();
    loaded.catalogEdges.push({ sourceCourseId: 'A', targetCourseId: 'B' });
    const result = validate(
      [
        row(4, { courseCode: 'B', courseName: 'Tên B' }),
        row(17, { priorCourses: 'B' }),
      ],
      loaded,
    );
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({
        rowNumber: 17,
        code: CURRICULUM_WARNING.REQUISITE_CYCLE,
        severity: 'ERROR',
        message: 'Vòng lặp điều kiện: A → B → A',
      }),
    );
  });
  it('parses multiple requisite tokens, copies catalog prerequisite scores, and warns about outside courses', () => {
    const loaded = context();
    loaded.catalogMinScores.set('B>A', new Prisma.Decimal('2.5'));
    const result = validate(
      [
        row(15, {
          priorCourses: '3190111 – Giải tích 1; 3190121',
          prerequisites: 'B',
        }),
      ],
      loaded,
    );
    expect(result.errorRows).toBe(0);
    expect(result.plan.rows[0].requisites).toEqual([
      {
        sourceCourseId: '3190111',
        relationType: CourseRelationType.PRIOR,
        minScore: null,
      },
      {
        sourceCourseId: '3190121',
        relationType: CourseRelationType.PRIOR,
        minScore: null,
      },
      {
        sourceCourseId: 'B',
        relationType: CourseRelationType.PREREQUISITE,
        minScore: new Prisma.Decimal('2.5'),
      },
    ]);
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({
        code: CURRICULUM_WARNING.REQUISITE_OUTSIDE,
        severity: 'HIGH',
      }),
    );
  });
  it.each(['X', '1', 'TRUE', 'Có'])('accepts true flag %s', (value) => {
    const result = validate([row(15, { htDa: value })]);
    expect(result.plan.rows[0].htDa).toBe(true);
  });
  it('rejects an unrecognized flag', () => {
    expect(validate([row(15, { htDa: 'không' })]).report.issues).toContainEqual(
      expect.objectContaining({
        code: IMPORT_ISSUE.VALUE_INVALID,
        column: 'HT ĐA',
      }),
    );
  });
  it('reports removed rows, preserves kept ids and drops the group when compulsory', () => {
    const loaded = context();
    loaded.existingItems.set('A', {
      id: 'keep',
      plannedSemester: 1,
      electiveGroupId: 'group',
      courseCode: 'A',
    });
    loaded.existingItems.set('B', {
      id: 'remove',
      plannedSemester: 3,
      electiveGroupId: null,
      courseCode: 'B',
    });
    const result = validate([row()], loaded);
    expect(result.plan.removedItemIds).toEqual(['remove']);
    expect(result.plan.rows[0]).toMatchObject({
      existingItemId: 'keep',
      electiveGroupId: null,
    });
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({
        code: IMPORT_ISSUE.ROW_REMOVED,
        rowNumber: null,
      }),
    );
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({
        code: IMPORT_ISSUE.GROUP_DROPPED,
        rowNumber: 15,
      }),
    );
  });
  it('a different program code fails every row; numeric header formatting is not a difference', () => {
    const loaded = context();
    const result = validateCurriculumRows(
      {
        header: { programCode: 'OTHER', totalCredits: '6.00' },
        rows: [row(4), row(5, { courseCode: 'B' })],
      },
      loaded,
    );
    expect(result.errorRows).toBe(2);
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({
        code: IMPORT_ISSUE.PROGRAM_MISMATCH,
        rowNumber: null,
        severity: 'ERROR',
      }),
    );
    expect(
      result.report.issues.some(
        (issue) => issue.code === IMPORT_ISSUE.HEADER_DIFFERS,
      ),
    ).toBe(false);
  });
  it('warns about catalog differences and preserves catalog credits for the total', () => {
    const result = validate([row(15, { courseName: 'Khác', credits: '5' })]);
    expect(result.errorRows).toBe(0);
    expect(
      result.report.issues.filter(
        (issue) => issue.code === IMPORT_ISSUE.CATALOG_DIFFERS,
      ),
    ).toHaveLength(2);
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({
        code: IMPORT_ISSUE.CREDIT_MISMATCH,
        message: expect.stringContaining('3'),
      }),
    );
  });
  it.each([
    ['priorCourses', 'UNKNOWN', IMPORT_ISSUE.REQUISITE_UNKNOWN],
    ['priorCourses', 'A', IMPORT_ISSUE.REQUISITE_SELF],
    ['priorCourses', 'B; B', IMPORT_ISSUE.REQUISITE_DUPLICATE],
    ['minStudiedScore', '4.01', IMPORT_ISSUE.VALUE_INVALID],
    ['minTransferScore', '-1', IMPORT_ISSUE.VALUE_INVALID],
    ['blockSymbol', 'A'.repeat(21), IMPORT_ISSUE.VALUE_INVALID],
    ['note', 'A'.repeat(501), IMPORT_ISSUE.VALUE_INVALID],
    ['courseName', 'A'.repeat(201), IMPORT_ISSUE.VALUE_INVALID],
    ['credits', 'not a number', IMPORT_ISSUE.VALUE_INVALID],
  ] as const)('refuses invalid %s', (key, value, code) => {
    const result = validate([row(15, { [key]: value })]);
    expect(result.errorRows).toBe(1);
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({
        code,
        column: CURRICULUM_SHEET.columns.find((column) => column.key === key)!
          .label,
      }),
    );
  });
  it('refuses discontinued courses and cancelled requisite courses', () => {
    const loaded = context();
    loaded.coursesByCode.get('A')!.status = CourseStatus.DISCONTINUED;
    loaded.coursesByCode.get('B')!.status = CourseStatus.CANCELLED;
    const result = validate([row(15, { priorCourses: 'B' })], loaded);
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({ code: IMPORT_ISSUE.COURSE_NOT_ACTIVE }),
    );
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({ code: IMPORT_ISSUE.REQUISITE_CANCELLED }),
    );
  });
  it('keeps elective membership, validates groups, assigns file order per semester and parses scores', () => {
    const loaded = context();
    loaded.existingItems.set('A', {
      id: 'keep',
      plannedSemester: 1,
      electiveGroupId: 'group',
      courseCode: 'A',
    });
    loaded.groups.push({
      id: 'group',
      groupCode: 'TC',
      minCredits: new Prisma.Decimal(3),
      minCourses: null,
    });
    const result = validate(
      [
        row(15, {
          isElective: 'x',
          minStudiedScore: '2.5',
          minTransferScore: '4.00',
        }),
        row(16, { courseCode: 'B' }),
        row(17, { courseCode: '3190111', plannedSemester: '1' }),
      ],
      loaded,
    );
    expect(result.errorRows).toBe(0);
    expect(result.plan.rows.map((item) => item.sortOrder)).toEqual([1, 2, 1]);
    expect(result.plan.rows[0]).toMatchObject({
      electiveGroupId: 'group',
      minStudiedScore: new Prisma.Decimal('2.5'),
      minTransferScore: new Prisma.Decimal(4),
    });
    loaded.groups[0].minCredits = new Prisma.Decimal(9);
    const unreachable = validate([row(15, { isElective: 'x' })], loaded);
    expect(unreachable.errorRows).toBe(1);
    expect(unreachable.report.issues).toContainEqual(
      expect.objectContaining({
        rowNumber: null,
        code: CURRICULUM_WARNING.GROUP_MINIMUM_UNREACHABLE,
        severity: 'ERROR',
      }),
    );
  });
  it('validates 1000 generated rows within the import unit budget', () => {
    const IMPORT_TEST_BUDGET_MS = 1000;
    const loaded = context();
    const rows = Array.from({ length: 1000 }, (_, index) => {
      const code = `C${index}`;
      loaded.coursesByCode.set(code, course(code));
      return row(index + 10, {
        courseCode: code,
        courseName: `Tên ${code}`,
        plannedSemester: String((index % 8) + 1),
      });
    });
    const started = performance.now();
    const result = validate(rows, loaded);
    expect(result.errorRows).toBe(0);
    expect(result.plan.rows).toHaveLength(1000);
    expect(performance.now() - started).toBeLessThan(IMPORT_TEST_BUDGET_MS);
  });
  it('loads actual version-owned header fields and catalog relations in fixed queries', async () => {
    const loaded = context();
    const version = vi.fn().mockResolvedValue({
      ...loaded.version,
      programName: 'Tên phiên bản',
      majorCode: '7480201',
      program: { programCode: '1024034' },
    });
    const courses = vi
      .fn()
      .mockResolvedValue([...loaded.coursesByCode.values()]);
    const items = vi.fn().mockResolvedValue([
      {
        id: 'item',
        courseId: 'A',
        plannedSemester: 2,
        electiveGroupId: null,
        course: { courseCode: 'A' },
      },
    ]);
    const groups = vi.fn().mockResolvedValue([]);
    const relations = vi.fn().mockResolvedValue([
      {
        sourceCourseId: 'B',
        targetCourseId: 'A',
        relationType: CourseRelationType.PREREQUISITE,
        minScore: new Prisma.Decimal('2.5'),
      },
    ]);
    const client = {
      programVersion: { findUniqueOrThrow: version },
      course: { findMany: courses },
      curriculumItem: { findMany: items },
      electiveGroup: { findMany: groups },
      courseRelation: { findMany: relations },
    } as unknown as Prisma.TransactionClient;
    const result = await loadCurriculumContext(client, 'version', ['A', 'B']);
    expect(result.program).toEqual({
      programCode: '1024034',
      programName: 'Tên phiên bản',
      majorCode: '7480201',
    });
    expect(result.existingItems.get('A')).toMatchObject({
      id: 'item',
      courseCode: 'A',
    });
    expect(result.catalogMinScores.get('B>A')?.equals('2.5')).toBe(true);
    expect(result.catalogEdges).toEqual([
      { sourceCourseId: 'B', targetCourseId: 'A' },
    ]);
    for (const query of [version, courses, items, groups, relations])
      expect(query).toHaveBeenCalledOnce();
    expect(relations.mock.calls[0][0].where.sourceCourse.status).toEqual({
      not: CourseStatus.CANCELLED,
    });
  });
});

describe('import report', () => {
  it('sorts file issues first and ERROR before HIGH before INFO within a row', () => {
    const collector = new IssueCollector();
    collector.add(4, 'INFO', 'info', 'Thông tin');
    collector.add(4, 'ERROR', 'error', 'Lỗi');
    collector.add(null, 'HIGH', 'file', 'Tệp');
    collector.add(4, 'HIGH', 'high', 'Cảnh báo');
    const result = collector.result(2, [4, 17], {});
    expect(result.errorRows).toBe(1);
    expect(sortIssues(result.report.issues).map((issue) => issue.code)).toEqual(
      ['file', 'error', 'high', 'info'],
    );
    collector.add(null, 'ERROR', 'blocked', 'Lỗi tệp');
    expect(collector.result(2, [4, 17], {}).errorRows).toBe(2);
  });
});
