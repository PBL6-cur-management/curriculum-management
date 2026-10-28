import { Prisma } from '../../../generated/prisma/client.js';
import type { AcademicResultStatus } from '../../../generated/prisma/client.js';
import { WARNING_SEVERITY } from '../../../shared/curriculum/curriculum-warnings.js';
import { GRADE_POINT_PATTERN } from '../../../shared/decimal/decimal.js';
import {
  isValidStudentCode,
  normalizeStudentCode,
} from '../../../shared/students/student-identity.js';
import type {
  AcademicResultImportPlan,
  AcademicResultPlanRow,
} from '../../../shared/students/student-import.types.js';
import { STUDENT_LIMITS } from '../../../shared/students/student.constants.js';
import {
  ACADEMIC_RESULT_SHEET,
  RESULT_STATUS_TEXT,
  type ResultColumn,
} from '../sheets/academic-result.sheet.js';
import type { NonTextCells } from '../sheets/identity-cells.js';
import type { SheetRow } from '../sheets/sheet-reader.js';
import { normalizeLabel } from '../sheets/sheet-spec.js';
import {
  resultKey,
  type AcademicResultImportContext,
  type ExistingResultFact,
} from './academic-result-context.js';
import { IMPORT_ISSUE } from './import-issues.js';
import { IssueCollector, type ValidationResult } from './import-report.js';

// 0 to 10 with at most two decimals, dot separator only.
const SCORE10_PATTERN = /^(10(\.0{1,2})?|[0-9](\.\d{1,2})?)$/;
const STATUS_BY_LABEL = new Map<string, AcademicResultStatus>(
  Object.entries(RESULT_STATUS_TEXT).map(([text, status]) => [
    normalizeLabel(text),
    status,
  ]),
);
const label = (key: ResultColumn) =>
  ACADEMIC_RESULT_SHEET.columns.find((column) => column.key === key)!.label;

function sameDecimal(left: string | null, right: string | null): boolean {
  if (left === null || right === null) return left === right;
  return new Prisma.Decimal(left).equals(right);
}
function sameValue(
  existing: ExistingResultFact,
  value: { score10: string | null; score4: string | null; letterGrade: string | null; status: AcademicResultStatus },
): boolean {
  return (
    sameDecimal(existing.score10, value.score10) &&
    sameDecimal(existing.score4, value.score4) &&
    existing.letterGrade === value.letterGrade &&
    existing.status === value.status
  );
}

export function validateAcademicResultRows(
  rows: readonly SheetRow<ResultColumn>[],
  context: AcademicResultImportContext,
  nonText: NonTextCells<ResultColumn> = new Map(),
): ValidationResult<AcademicResultImportPlan> {
  const issues = new IssueCollector();
  const plan: AcademicResultImportPlan = { rows: [] };
  const keyOf = (cells: SheetRow<ResultColumn>['cells']) =>
    [
      normalizeStudentCode(cells.studentCode),
      cells.courseCode.trim().toUpperCase(),
      cells.semesterCode.trim(),
    ].join('|');
  const occurrences = new Map<string, number[]>();
  for (const row of rows) {
    const key = keyOf(row.cells);
    occurrences.set(key, [...(occurrences.get(key) ?? []), row.rowNumber]);
  }

  for (const { rowNumber, cells } of rows) {
    const fail = (key: ResultColumn, code: string, message: string) =>
      issues.add(rowNumber, WARNING_SEVERITY.ERROR, code, message, label(key));
    const required = (key: ResultColumn, found: unknown) => {
      if (!cells[key].trim()) {
        fail(key, IMPORT_ISSUE.REQUIRED_EMPTY, 'Ô bắt buộc chưa có dữ liệu.');
      } else if (!found) {
        fail(key, IMPORT_ISSUE.REFERENCE_UNKNOWN, 'Không tìm thấy giá trị này trong hệ thống.');
      }
    };

    const studentCode = normalizeStudentCode(cells.studentCode);
    const student = context.studentsByCode.get(studentCode);
    if (nonText.get(rowNumber)?.includes('studentCode')) {
      fail('studentCode', IMPORT_ISSUE.IDENTITY_CELL_NOT_TEXT, 'Mã sinh viên phải là văn bản thuần, không phải số hoặc công thức; định dạng cột là Text.');
    } else if (studentCode && !isValidStudentCode(studentCode)) {
      fail('studentCode', IMPORT_ISSUE.VALUE_INVALID, 'Mã sinh viên không hợp lệ.');
    } else {
      required('studentCode', student);
    }
    const course = context.coursesByCode.get(cells.courseCode.trim().toUpperCase());
    required('courseCode', course);
    const semester = context.semestersByCode.get(cells.semesterCode.trim());
    required('semesterCode', semester);
    if (semester && !semester.startDate) {
      fail('semesterCode', IMPORT_ISSUE.SEMESTER_START_UNKNOWN, 'Học kỳ chưa có ngày bắt đầu.');
    }

    const peers = (occurrences.get(keyOf(cells)) ?? []).filter((number) => number !== rowNumber);
    if (peers.length > 0) {
      fail('studentCode', IMPORT_ISSUE.DUPLICATE_CODE_IN_FILE, `Cùng sinh viên, học phần và học kỳ với dòng ${peers.join(', ')}.`);
    }

    const statusText = cells.status.trim();
    const status = STATUS_BY_LABEL.get(normalizeLabel(statusText));
    if (!statusText) fail('status', IMPORT_ISSUE.REQUIRED_EMPTY, 'Ô bắt buộc chưa có dữ liệu.');
    else if (!status) fail('status', IMPORT_ISSUE.VALUE_INVALID, 'Trạng thái không thuộc các giá trị của mẫu.');

    const score = (key: 'score10' | 'score4', pattern: RegExp, range: string) => {
      const text = cells[key].trim();
      if (!text) return null;
      if (!pattern.test(text)) {
        fail(key, IMPORT_ISSUE.VALUE_INVALID, `Điểm phải trong khoảng ${range}, tối đa 2 chữ số thập phân, dùng dấu chấm.`);
        return null;
      }
      return new Prisma.Decimal(text).toString();
    };
    const score10 = score('score10', SCORE10_PATTERN, '0 đến 10');
    const score4 = score('score4', GRADE_POINT_PATTERN, '0 đến 4');
    const letterGrade = cells.letterGrade.trim() || null;
    if (letterGrade && letterGrade.length > STUDENT_LIMITS.LETTER_MAX) {
      fail('letterGrade', IMPORT_ISSUE.VALUE_INVALID, `Nội dung vượt quá ${STUDENT_LIMITS.LETTER_MAX} ký tự.`);
    }
    if (status) {
      const supplied = [cells.score10.trim(), cells.score4.trim(), cells.letterGrade.trim()].filter(Boolean).length;
      const rule: Record<AcademicResultStatus, boolean> = {
        PASSED: supplied === 3,
        FAILED: supplied === 3,
        IN_PROGRESS: supplied === 0,
        EXEMPT: supplied === 0 || supplied === 3,
      };
      if (!rule[status]) {
        fail('status', IMPORT_ISSUE.VALUE_INVALID, 'Điểm hai thang và điểm chữ không khớp với trạng thái đã chọn.');
      }
    }

    if (!student || !course || !semester?.startDate || !status || issues.hasError(rowNumber)) {
      continue;
    }
    const value = { score10, score4, letterGrade, status };
    const existing = context.existing.get(resultKey(student.id, course.id, semester.id));
    const planRow: AcademicResultPlanRow = {
      rowNumber,
      action: 'CREATE',
      existingId: existing?.id ?? null,
      expectedRevision: existing?.revision ?? null,
      value: { studentId: student.id, courseId: course.id, semesterId: semester.id, ...value },
    };
    if (existing) {
      const identical = sameValue(existing, value);
      if (existing.dataSource === 'SCHOOL_DB') {
        planRow.action = identical ? 'UNCHANGED' : 'PRESERVE_SOURCE';
        if (identical) {
          issues.add(rowNumber, WARNING_SEVERITY.INFO, IMPORT_ISSUE.UNCHANGED, 'Không thay đổi so với dữ liệu hiện có.');
        } else {
          issues.add(rowNumber, WARNING_SEVERITY.HIGH, IMPORT_ISSUE.SCHOOL_DB_PRESERVED, 'Kết quả đã có từ dữ liệu của Trường; giữ nguyên, không ghi đè bằng tệp Excel.');
        }
      } else if (identical) {
        planRow.action = 'UNCHANGED';
        issues.add(rowNumber, WARNING_SEVERITY.INFO, IMPORT_ISSUE.UNCHANGED, 'Không thay đổi so với dữ liệu hiện có.');
      } else {
        planRow.action = 'UPDATE';
        issues.add(rowNumber, WARNING_SEVERITY.INFO, IMPORT_ISSUE.WILL_UPDATE, 'Kết quả sẽ được cập nhật.');
      }
    }
    plan.rows.push(planRow);
  }
  return issues.result(rows.length, rows.map((row) => row.rowNumber), plan);
}
