import { fromIsoDay } from '../../../shared/time/today.js';
import type { ResultColumn } from '../sheets/academic-result.sheet.js';
import type { SheetRow } from '../sheets/sheet-reader.js';
import {
  resultKey,
  type AcademicResultImportContext,
  type ExistingResultFact,
} from './academic-result-context.js';
import { validateAcademicResultRows } from './academic-result-validator.js';
import { IMPORT_ISSUE } from './import-issues.js';

function context(
  existing: ExistingResultFact[] = [],
): AcademicResultImportContext {
  return {
    studentsByCode: new Map([['SYN-STU-0001', { id: 'st' }]]),
    coursesByCode: new Map([['SYN-COURSE-A', { id: 'co' }]]),
    semestersByCode: new Map([
      ['SYN-TERM-A', { id: 'se', startDate: fromIsoDay('2025-09-01') }],
      ['SYN-TERM-B', { id: 'se2', startDate: fromIsoDay('2026-02-01') }],
      ['SYN-TERM-NONE', { id: 'se3', startDate: null }],
    ]),
    existing: new Map(existing.map((item) => [resultKey('st', 'co', 'se'), item])),
  };
}

function row(
  rowNumber: number,
  over: Partial<Record<ResultColumn, string>> = {},
): SheetRow<ResultColumn> {
  return {
    rowNumber,
    cells: {
      studentCode: 'SYN-STU-0001',
      courseCode: 'SYN-COURSE-A',
      semesterCode: 'SYN-TERM-A',
      score10: '8.5',
      score4: '3.5',
      letterGrade: 'B+',
      status: 'Đạt',
      ...over,
    },
  };
}

const fact = (over: Partial<ExistingResultFact> = {}): ExistingResultFact => ({
  id: 'r1',
  score10: '8.5',
  score4: '3.5',
  letterGrade: 'B+',
  status: 'PASSED',
  dataSource: 'EXCEL',
  revision: 3,
  ...over,
});

const codes = (result: ReturnType<typeof validateAcademicResultRows>) =>
  result.report.issues.map((issue) => issue.code);

describe('validateAcademicResultRows', () => {
  it('plans a new result with exact decimal strings', () => {
    const result = validateAcademicResultRows([row(2)], context());
    expect(result.errorRows).toBe(0);
    expect(result.plan.rows[0]).toMatchObject({
      action: 'CREATE',
      existingId: null,
      value: { score10: '8.5', score4: '3.5', letterGrade: 'B+', status: 'PASSED' },
    });
  });

  it('flags every row of a duplicate triple', () => {
    const result = validateAcademicResultRows(
      [row(2), row(3, { studentCode: 'syn-stu-0001' })],
      context(),
    );
    expect(
      result.report.issues.filter((issue) => issue.code === IMPORT_ISSUE.DUPLICATE_CODE_IN_FILE),
    ).toHaveLength(2);
    expect(result.errorRows).toBe(2);
  });

  it('treats the same course in another semester as a separate attempt', () => {
    const result = validateAcademicResultRows([row(2), row(3, { semesterCode: 'SYN-TERM-B' })], context());
    expect(result.errorRows).toBe(0);
    expect(result.plan.rows).toHaveLength(2);
  });

  it('rejects unknown references, a semester without a start and a non-text student cell', () => {
    const result = validateAcademicResultRows(
      [row(2, { studentCode: 'NOPE', courseCode: 'NOPE' }), row(3, { semesterCode: 'SYN-TERM-NONE' })],
      context(),
      new Map([[3, ['studentCode' as const]]]),
    );
    expect(codes(result)).toEqual(
      expect.arrayContaining([
        IMPORT_ISSUE.REFERENCE_UNKNOWN,
        IMPORT_ISSUE.SEMESTER_START_UNKNOWN,
        IMPORT_ISSUE.IDENTITY_CELL_NOT_TEXT,
      ]),
    );
    expect(result.errorRows).toBe(2);
  });

  it('enforces ranges, precision and the dot separator', () => {
    for (const bad of [{ score10: '10.5' }, { score10: '8,5' }, { score4: '4.5' }, { score10: '8.555' }, { score10: '1e1' }]) {
      const result = validateAcademicResultRows([row(2, bad)], context());
      expect(result.errorRows, JSON.stringify(bad)).toBe(1);
    }
    const edge = validateAcademicResultRows([row(2, { score10: '10', score4: '4.00' })], context());
    expect(edge.errorRows).toBe(0);
  });

  it('applies the per-status scale rules', () => {
    const blank = { score10: '', score4: '', letterGrade: '' };
    const cases: [Partial<Record<ResultColumn, string>>, number][] = [
      [{ ...blank }, 1],
      [{ score10: '5', score4: '', letterGrade: '' }, 1],
      [{ ...blank, status: 'Đang học' }, 0],
      [{ status: 'Đang học' }, 1],
      [{ ...blank, status: 'Miễn' }, 0],
      [{ status: 'Miễn' }, 0],
      [{ ...blank, score10: '9', status: 'Miễn' }, 1],
      [{ status: 'Không đạt', score10: '3', score4: '1', letterGrade: 'F' }, 0],
      [{ status: 'Hoàn thành' }, 1],
    ];
    for (const [over, errors] of cases) {
      const result = validateAcademicResultRows([row(2, over)], context());
      expect(result.errorRows, JSON.stringify(over)).toBe(errors);
    }
  });

  it('reports an update, an unchanged row and keeps the existing id and revision', () => {
    const changed = validateAcademicResultRows([row(2, { score10: '9' })], context([fact()]));
    expect(changed.plan.rows[0]).toMatchObject({ action: 'UPDATE', existingId: 'r1', expectedRevision: 3 });
    expect(codes(changed)).toContain(IMPORT_ISSUE.WILL_UPDATE);
    const same = validateAcademicResultRows([row(2, { score10: '8.50' })], context([fact()]));
    expect(same.plan.rows[0]!.action).toBe('UNCHANGED');
  });

  it('preserves an official-source result that differs and stays quiet when identical', () => {
    const differs = validateAcademicResultRows(
      [row(2, { score10: '9' })],
      context([fact({ dataSource: 'SCHOOL_DB' })]),
    );
    expect(differs.plan.rows[0]!.action).toBe('PRESERVE_SOURCE');
    expect(differs.report.issues[0]).toMatchObject({ severity: 'HIGH', code: IMPORT_ISSUE.SCHOOL_DB_PRESERVED });
    expect(differs.errorRows).toBe(0);
    const same = validateAcademicResultRows([row(2)], context([fact({ dataSource: 'SCHOOL_DB' })]));
    expect(same.plan.rows[0]!.action).toBe('UNCHANGED');
    expect(same.report.issues[0]!.severity).toBe('INFO');
  });

  it('does not put scores or codes into messages', () => {
    const result = validateAcademicResultRows([row(2, { score10: '11.5' })], context());
    for (const issue of result.report.issues) {
      expect(issue.message).not.toContain('11.5');
      expect(issue.message).not.toContain('SYN-STU');
    }
  });
});
