import { fromIsoDay } from '../../../shared/time/today.js';
import type { SheetRow } from '../sheets/sheet-reader.js';
import type { StudentColumn } from '../sheets/student-list.sheet.js';
import { IMPORT_ISSUE } from './import-issues.js';
import {
  assignmentKey,
  type ExistingStudentFact,
  type SemesterFact,
  type StudentImportContext,
} from './student-context.js';
import { validateStudentRows } from './student-validator.js';

const S1 = { id: 's1', startDate: fromIsoDay('2025-09-01') };
const S2 = { id: 's2', startDate: fromIsoDay('2026-02-01') };
const NO_START = { id: 's-none', startDate: null };

const assignment = {
  id: 'a1',
  version: { id: 'v1' },
} as never;

function context(over: Partial<StudentImportContext> = {}): StudentImportContext {
  return {
    cohortsByCode: new Map([['SYN-COHORT-A', { id: 'c1' }]]),
    programsByCode: new Map([['SYN-PROG-A', { id: 'p1' }]]),
    semestersByCode: new Map<string, SemesterFact>([
      ['SYN-TERM-A', S1],
      ['SYN-TERM-B', S2],
      ['SYN-TERM-NONE', NO_START],
    ]),
    semestersById: new Map([
      ['s1', S1],
      ['s2', S2],
    ]),
    studentsByCode: new Map(),
    accountConflicts: new Set(),
    assignments: new Map([[assignmentKey('p1', 'c1', 's1'), assignment]]),
    majorByVersionId: new Map([['v1', '7480201']]),
    ...over,
  };
}

function row(
  rowNumber: number,
  over: Partial<Record<StudentColumn, string>> = {},
): SheetRow<StudentColumn> {
  return {
    rowNumber,
    cells: {
      studentCode: 'SYN-STU-0001',
      fullName: 'Sinh viên giả lập 001',
      cohortCode: 'SYN-COHORT-A',
      major: '7480201',
      programCode: 'SYN-PROG-A',
      admissionSemesterCode: 'SYN-TERM-A',
      statusSemesterCode: 'SYN-TERM-A',
      status: '',
      ...over,
    },
  };
}

function existing(over: Partial<ExistingStudentFact> = {}): ExistingStudentFact {
  return {
    id: 'st1',
    fullName: 'Sinh viên giả lập 001',
    cohortId: 'c1',
    major: '7480201',
    admissionSemesterId: 's1',
    statusSemesterId: 's1',
    status: 'STUDYING',
    dataSource: 'EXCEL',
    userId: null,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    primaryProgramId: 'p1',
    ...over,
  };
}

const codes = (result: ReturnType<typeof validateStudentRows>, row?: number) =>
  result.report.issues
    .filter((issue) => row === undefined || issue.rowNumber === row)
    .map((issue) => issue.code);

describe('validateStudentRows', () => {
  it('plans a new student with the admission assignment and defaults the status', () => {
    const result = validateStudentRows([row(2)], context());
    expect(result.errorRows).toBe(0);
    expect(result.plan.rows[0]).toMatchObject({
      action: 'CREATE',
      programId: 'p1',
      admissionAssignment: assignment,
      profile: { studentCode: 'SYN-STU-0001', status: 'STUDYING' },
    });
  });

  it('flags a missing mapping as HIGH and still plans the profile without an assignment', () => {
    const result = validateStudentRows([row(2)], context({ assignments: new Map() }));
    expect(result.errorRows).toBe(0);
    expect(result.report.issues[0]).toMatchObject({
      severity: 'HIGH',
      code: IMPORT_ISSUE.PROGRAM_UNRESOLVED,
      message: 'Chưa xác định được chương trình; sinh viên sẽ được tạo nhưng chưa có ghi danh.',
    });
    expect(result.plan.rows[0]!.admissionAssignment).toBeNull();
  });

  it('upper-cases the student code and keeps leading zeroes', () => {
    const result = validateStudentRows([row(2, { studentCode: ' 0012abc ' })], context());
    expect(result.plan.rows[0]!.profile.studentCode).toBe('0012ABC');
  });

  it('names every occurrence of a duplicate code, including a row with another error', () => {
    const result = validateStudentRows(
      [row(2), row(3, { fullName: '' }), row(4, { studentCode: 'syn-stu-0001' })],
      context(),
    );
    const duplicates = result.report.issues.filter(
      (issue) => issue.code === IMPORT_ISSUE.DUPLICATE_CODE_IN_FILE,
    );
    expect(duplicates.map((issue) => issue.rowNumber)).toEqual([2, 3, 4]);
    expect(duplicates[0]!.message).toContain('3, 4');
    expect(result.errorRows).toBe(3);
  });

  it('rejects an identity cell that was a number or a formula', () => {
    const result = validateStudentRows(
      [row(2)],
      context(),
      new Map([[2, ['studentCode' as const]]]),
    );
    expect(codes(result)).toContain(IMPORT_ISSUE.IDENTITY_CELL_NOT_TEXT);
    expect(result.errorRows).toBe(1);
  });

  it('reports unknown references and a semester without a start date as errors', () => {
    const result = validateStudentRows(
      [row(2, { cohortCode: 'X', programCode: 'Y', admissionSemesterCode: 'SYN-TERM-NONE' })],
      context(),
    );
    expect(codes(result)).toEqual(
      expect.arrayContaining([IMPORT_ISSUE.REFERENCE_UNKNOWN, IMPORT_ISSUE.SEMESTER_START_UNKNOWN]),
    );
    expect(result.errorRows).toBe(1);
  });

  it('rejects an unknown status token and a status semester before admission', () => {
    const result = validateStudentRows(
      [
        row(2, { status: 'Nghỉ' }),
        row(3, { admissionSemesterCode: 'SYN-TERM-B', statusSemesterCode: 'SYN-TERM-A' }),
      ],
      context(),
    );
    expect(codes(result, 2)).toContain(IMPORT_ISSUE.VALUE_INVALID);
    expect(codes(result, 3)).toContain(IMPORT_ISSUE.STATUS_CHRONOLOGY_INVALID);
  });

  it('accepts the Vietnamese status labels', () => {
    const result = validateStudentRows([row(2, { status: 'bảo lưu' })], context());
    expect(result.plan.rows[0]!.profile.status).toBe('ON_LEAVE');
  });

  it('treats an identical re-import as unchanged and does not re-pin an enrolled student', () => {
    const result = validateStudentRows(
      [row(2)],
      context({ studentsByCode: new Map([['SYN-STU-0001', existing()]]) }),
    );
    expect(result.plan.rows[0]).toMatchObject({
      action: 'UNCHANGED',
      existingId: 'st1',
      admissionAssignment: null,
    });
    expect(codes(result)).toEqual([IMPORT_ISSUE.UNCHANGED]);
  });

  it('plans an update for a changed name', () => {
    const result = validateStudentRows(
      [row(2, { fullName: 'Tên khác' })],
      context({ studentsByCode: new Map([['SYN-STU-0001', existing()]]) }),
    );
    expect(result.plan.rows[0]!.action).toBe('UPDATE');
    expect(codes(result)).toContain(IMPORT_ISSUE.WILL_UPDATE);
  });

  it('blocks an implicit transfer of an enrolled student', () => {
    const result = validateStudentRows(
      [row(2)],
      context({
        studentsByCode: new Map([['SYN-STU-0001', existing({ primaryProgramId: 'other' })]]),
      }),
    );
    expect(codes(result)).toContain(IMPORT_ISSUE.ENROLLMENT_CHANGE_REQUIRES_DECISION);
    expect(result.errorRows).toBe(1);
  });

  it('rejects terminal reactivation but allows a same-semester nonterminal correction', () => {
    const terminal = validateStudentRows(
      [row(2)],
      context({ studentsByCode: new Map([['SYN-STU-0001', existing({ status: 'WITHDRAWN' })]]) }),
    );
    expect(codes(terminal)).toContain(IMPORT_ISSUE.STATUS_CHRONOLOGY_INVALID);
    const leave = validateStudentRows(
      [row(2, { status: 'Bảo lưu' })],
      context({ studentsByCode: new Map([['SYN-STU-0001', existing()]]) }),
    );
    expect(leave.errorRows).toBe(0);
    expect(leave.plan.rows[0]!.action).toBe('UPDATE');
  });

  it('rejects a status semester earlier than the stored one', () => {
    const result = validateStudentRows(
      [row(2, { statusSemesterCode: 'SYN-TERM-A' })],
      context({
        studentsByCode: new Map([['SYN-STU-0001', existing({ statusSemesterId: 's2' })]]),
      }),
    );
    expect(codes(result)).toContain(IMPORT_ISSUE.STATUS_CHRONOLOGY_INVALID);
  });

  it('flags an account that belongs to someone else without linking it', () => {
    const result = validateStudentRows(
      [row(2)],
      context({ accountConflicts: new Set(['SYN-STU-0001']) }),
    );
    expect(codes(result)).toContain(IMPORT_ISSUE.ACCOUNT_IDENTITY_CONFLICT);
  });

  it('preserves a school-database student instead of overwriting it', () => {
    const result = validateStudentRows(
      [row(2, { fullName: 'Tên khác' })],
      context({
        studentsByCode: new Map([['SYN-STU-0001', existing({ dataSource: 'SCHOOL_DB' })]]),
        accountConflicts: new Set(['SYN-STU-0001']),
      }),
    );
    expect(result.plan.rows[0]!.action).toBe('PRESERVE_SOURCE');
    expect(result.report.issues[0]).toMatchObject({
      severity: 'HIGH',
      code: IMPORT_ISSUE.SCHOOL_DB_PRESERVED,
    });
    expect(result.errorRows).toBe(0);
  });

  it('warns when the major differs from the applied version and never echoes names', () => {
    const result = validateStudentRows([row(2, { major: 'OTHER' })], context());
    expect(codes(result)).toContain(IMPORT_ISSUE.MAJOR_MISMATCH);
    for (const issue of result.report.issues) {
      expect(issue.message).not.toContain('Sinh viên giả lập');
    }
  });
});
