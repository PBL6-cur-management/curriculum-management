import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { WARNING_SEVERITY } from '../../shared/curriculum/curriculum-warnings.js';
import { AppliedProgramVersionReader } from '../../shared/releases/applied-program-version.reader.js';
import { writeAcademicResultSource } from '../../shared/students/academic-result.writer.js';
import type { SourceWriteContext } from '../../shared/students/student-import.types.js';
import { writeStudentSource } from '../../shared/students/student-source.writer.js';
import {
  loadAcademicResultContext,
  resultKey,
} from '../imports/validation/academic-result-context.js';
import { validateAcademicResultRows } from '../imports/validation/academic-result-validator.js';
import type { ImportIssue } from '../imports/validation/import-report.js';
import { loadStudentContext } from '../imports/validation/student-context.js';
import { validateStudentRows } from '../imports/validation/student-validator.js';
import { SCHOOL_SYNC_LIMITS } from './school-sync.constants.js';
import { SyncFailure } from './school-sync.errors.js';
import {
  CodeTranslator,
  toResultRows,
  toStudentRows,
  type ReferenceMapping,
} from './school-snapshot.translator.js';
import type { SchoolSnapshot } from './school-source.reader.js';

const SCHOOL: SourceWriteContext = { source: 'SCHOOL_DB', actorId: null };

export interface ConflictRecord {
  entityType: 'STUDENT' | 'ACADEMIC_RESULT';
  recordKey: string;
  fields: string[];
  before: { field: string; value: string | null }[];
  after: { field: string; value: string | null }[];
}

export interface ApplyOutcome {
  studentCount: number;
  resultCount: number;
  classCount: number;
  changedCount: number;
  conflicts: ConflictRecord[];
}

type Values = Record<string, string | null>;

function conflictOf(
  entityType: ConflictRecord['entityType'],
  recordKey: string,
  before: Values,
  after: Values,
): ConflictRecord | null {
  const fields = Object.keys(after)
    .filter((field) => before[field] !== after[field])
    .sort();
  if (fields.length === 0) return null;
  const pick = (values: Values) =>
    fields.map((field) => ({ field, value: values[field] ?? null }));
  return { entityType, recordKey, fields, before: pick(before), after: pick(after) };
}

const decimalText = (value: string | null) =>
  value === null ? null : new Prisma.Decimal(value).toFixed(2);

// A row error names the row and the column, never the value, so the run history holds no personal data.
function failOn(sheet: string, issues: readonly ImportIssue[]): void {
  const errors = issues.filter((issue) => issue.severity === WARNING_SEVERITY.ERROR);
  if (errors.length === 0) return;
  const quoted = errors
    .slice(0, SCHOOL_SYNC_LIMITS.ISSUES_QUOTED)
    .map((issue) =>
      `dòng ${issue.rowNumber ?? '-'}${issue.column ? ` (${issue.column})` : ''}: ${issue.message}`,
    );
  const more = errors.length - quoted.length;
  throw new SyncFailure(
    'SOURCE_DATA_INVALID',
    `${sheet}: ${quoted.join('; ')}${more > 0 ? `; và ${more} lỗi khác` : ''}.`,
  );
}

@Injectable()
export class SchoolSnapshotApplier {
  constructor(private readonly appliedVersions: AppliedProgramVersionReader) {}

  // Everything runs on the caller's transaction: a throw anywhere leaves no local change (EC-49).
  async apply(
    tx: Prisma.TransactionClient,
    configurationId: string,
    snapshot: SchoolSnapshot,
    mappings: readonly ReferenceMapping[],
  ): Promise<ApplyOutcome> {
    const codes = new CodeTranslator(mappings);
    const conflicts: ConflictRecord[] = [];

    const studentRows = toStudentRows(snapshot.students, codes);
    const studentContext = await loadStudentContext(tx, studentRows, this.appliedVersions);
    // The sync never creates or links an account, so an account clash is an Excel-only concern.
    const students = validateStudentRows(studentRows, {
      ...studentContext,
      accountConflicts: new Set(),
    });
    failOn('Sinh viên', students.report.issues);

    const cohortCode = new Map(
      [...studentContext.cohortsByCode].map(([code, row]) => [row.id, code]),
    );
    const semesterCode = new Map(
      [...studentContext.semestersByCode].map(([code, row]) => [row.id, code]),
    );
    const studentValues = (value: {
      fullName: string;
      cohortId: string;
      major: string;
      admissionSemesterId: string;
      statusSemesterId: string;
      status: string;
    }): Values => ({
      fullName: value.fullName,
      cohort: cohortCode.get(value.cohortId) ?? value.cohortId,
      major: value.major,
      admissionSemester: semesterCode.get(value.admissionSemesterId) ?? value.admissionSemesterId,
      statusSemester: semesterCode.get(value.statusSemesterId) ?? value.statusSemesterId,
      status: value.status,
    });

    let changedCount = 0;
    for (const row of students.plan.rows) {
      const existing = studentContext.studentsByCode.get(row.profile.studentCode);
      // The school is the official source: a row the Excel validator would preserve is written here.
      if (row.action === 'PRESERVE_SOURCE') row.action = 'UPDATE';
      if (!existing) {
        changedCount++;
        continue;
      }
      if (existing.dataSource === 'EXCEL') {
        const conflict = conflictOf(
          'STUDENT',
          row.profile.studentCode,
          studentValues(existing),
          studentValues(row.profile),
        );
        if (conflict) conflicts.push(conflict);
        changedCount++;
      } else if (row.action !== 'UNCHANGED') {
        changedCount++;
      }
    }
    await writeStudentSource(tx, students.plan, SCHOOL, []);

    const resultRows = toResultRows(snapshot.results, codes);
    const resultContext = await loadAcademicResultContext(tx, resultRows);
    const results = validateAcademicResultRows(resultRows, resultContext);
    failOn('Kết quả học tập', results.report.issues);
    const resultCells = new Map(resultRows.map((row) => [row.rowNumber, row.cells]));
    for (const row of results.plan.rows) {
      if (row.action === 'PRESERVE_SOURCE') row.action = 'UPDATE';
      const { value } = row;
      const existing = resultContext.existing.get(
        resultKey(value.studentId, value.courseId, value.semesterId),
      );
      if (existing?.dataSource !== 'EXCEL') continue;
      const cells = resultCells.get(row.rowNumber)!;
      const conflict = conflictOf(
        'ACADEMIC_RESULT',
        `${cells.studentCode}|${cells.courseCode}|${cells.semesterCode}`,
        {
          score10: decimalText(existing.score10),
          score4: decimalText(existing.score4),
          letterGrade: existing.letterGrade,
          status: existing.status,
        },
        {
          score10: decimalText(value.score10),
          score4: decimalText(value.score4),
          letterGrade: value.letterGrade,
          status: value.status,
        },
      );
      if (conflict) conflicts.push(conflict);
    }
    const written = await writeAcademicResultSource(tx, results.plan, SCHOOL);
    changedCount += written.created + written.updated;

    changedCount += await this.mirrorClasses(tx, configurationId, snapshot, codes);

    return {
      studentCount: students.plan.rows.length,
      resultCount: results.plan.rows.length,
      classCount: snapshot.classes.length,
      changedCount,
      conflicts,
    };
  }

  // Classes are mirrored as they are; nothing else in the CMS reads them (D10).
  private async mirrorClasses(
    tx: Prisma.TransactionClient,
    configurationId: string,
    snapshot: SchoolSnapshot,
    codes: CodeTranslator,
  ): Promise<number> {
    if (snapshot.classes.length === 0) return 0;
    const courseCodes = [...new Set(snapshot.classes.map((row) => codes.local('COURSE', row.courseCode)))];
    const semesterCodes = [...new Set(snapshot.classes.map((row) => codes.local('SEMESTER', row.semesterCode)))];
    const [courses, semesters, mirrored] = await Promise.all([
      tx.course.findMany({ where: { courseCode: { in: courseCodes } }, select: { id: true, courseCode: true } }),
      tx.semester.findMany({ where: { semesterCode: { in: semesterCodes } }, select: { id: true, semesterCode: true } }),
      tx.schoolClassMirror.findMany({
        where: { configurationId },
        select: { sourceId: true, classCode: true, courseId: true, semesterId: true },
      }),
    ]);
    const courseId = new Map(courses.map((row) => [row.courseCode, row.id]));
    const semesterId = new Map(semesters.map((row) => [row.semesterCode, row.id]));
    const current = new Map(mirrored.map((row) => [row.sourceId, row]));

    const problems: ImportIssue[] = [];
    const seen = new Set<string>();
    const resolved = snapshot.classes.map((row, index) => {
      const course = courseId.get(codes.local('COURSE', row.courseCode));
      const semester = semesterId.get(codes.local('SEMESTER', row.semesterCode));
      const problem = (column: string, message: string) =>
        problems.push({ rowNumber: index + 1, severity: WARNING_SEVERITY.ERROR, code: 'CLASS', column, message });
      if (!row.sourceId || seen.has(row.sourceId)) problem('Mã nguồn', 'Mã nguồn trống hoặc trùng.');
      if (!row.classCode) problem('Mã lớp', 'Ô bắt buộc chưa có dữ liệu.');
      if (!course) problem('Mã học phần', 'Không tìm thấy giá trị này trong hệ thống.');
      if (!semester) problem('Học kỳ', 'Không tìm thấy giá trị này trong hệ thống.');
      seen.add(row.sourceId);
      return { ...row, courseId: course ?? '', semesterId: semester ?? '' };
    });
    failOn('Lớp học phần', problems);

    let changed = 0;
    for (const row of resolved) {
      const before = current.get(row.sourceId);
      const same =
        before?.classCode === row.classCode &&
        before.courseId === row.courseId &&
        before.semesterId === row.semesterId;
      if (!same) changed++;
      await tx.schoolClassMirror.upsert({
        where: { configurationId_sourceId: { configurationId, sourceId: row.sourceId } },
        create: {
          configurationId,
          sourceId: row.sourceId,
          classCode: row.classCode,
          courseId: row.courseId,
          semesterId: row.semesterId,
          lastSnapshotVersion: snapshot.version,
        },
        update: {
          classCode: row.classCode,
          courseId: row.courseId,
          semesterId: row.semesterId,
          lastSnapshotVersion: snapshot.version,
        },
      });
    }
    return changed;
  }
}
