import { StudentStatus } from '../../../generated/prisma/client.js';
import { WARNING_SEVERITY } from '../../../shared/curriculum/curriculum-warnings.js';
import {
  isValidStudentCode,
  normalizeStudentCode,
} from '../../../shared/students/student-identity.js';
import type {
  StudentImportPlan,
  StudentImportPlanRow,
  StudentProfileValue,
} from '../../../shared/students/student-import.types.js';
import { STUDENT_LIMITS } from '../../../shared/students/student.constants.js';
import type { NonTextCells } from '../sheets/identity-cells.js';
import type { SheetRow } from '../sheets/sheet-reader.js';
import { normalizeLabel } from '../sheets/sheet-spec.js';
import {
  STUDENT_LIST_SHEET,
  STUDENT_STATUS_TEXT,
  type StudentColumn,
} from '../sheets/student-list.sheet.js';
import { IMPORT_ISSUE } from './import-issues.js';
import { IssueCollector, type ValidationResult } from './import-report.js';
import {
  assignmentKey,
  type ExistingStudentFact,
  type StudentImportContext,
} from './student-context.js';

const STATUS_BY_LABEL = new Map<string, StudentStatus>(
  Object.entries(STUDENT_STATUS_TEXT).map(([label, status]) => [
    normalizeLabel(label),
    status,
  ]),
);
const TERMINAL: readonly StudentStatus[] = [
  StudentStatus.WITHDRAWN,
  StudentStatus.GRADUATED,
];
const MESSAGE = {
  REQUIRED: 'Ô bắt buộc chưa có dữ liệu.',
  NOT_TEXT:
    'Mã sinh viên phải là văn bản thuần, không phải số hoặc công thức; định dạng cột là Text.',
  CODE: 'Mã sinh viên không hợp lệ (chữ, số, "-" hoặc "_", từ 3 đến 32 ký tự).',
  UNKNOWN: 'Không tìm thấy giá trị này trong hệ thống.',
  NO_START: 'Học kỳ chưa có ngày bắt đầu.',
  UNRESOLVED:
    'Chưa xác định được chương trình; sinh viên sẽ được tạo nhưng chưa có ghi danh.',
} as const;

const label = (key: StudentColumn) =>
  STUDENT_LIST_SHEET.columns.find((column) => column.key === key)!.label;
const normalizeName = (value: string) =>
  value.normalize('NFC').replace(/\s+/g, ' ').trim();

function samePerson(
  existing: ExistingStudentFact,
  profile: StudentProfileValue,
): boolean {
  return (
    existing.fullName === profile.fullName &&
    existing.cohortId === profile.cohortId &&
    existing.major === profile.major &&
    existing.admissionSemesterId === profile.admissionSemesterId &&
    existing.statusSemesterId === profile.statusSemesterId &&
    existing.status === profile.status
  );
}

export function validateStudentRows(
  rows: readonly SheetRow<StudentColumn>[],
  context: StudentImportContext,
  nonText: NonTextCells<StudentColumn> = new Map(),
): ValidationResult<StudentImportPlan> {
  const issues = new IssueCollector();
  const plan: StudentImportPlan = { rows: [] };
  const occurrences = new Map<string, number[]>();
  for (const row of rows) {
    const code = normalizeStudentCode(row.cells.studentCode);
    occurrences.set(code, [...(occurrences.get(code) ?? []), row.rowNumber]);
  }

  for (const { rowNumber, cells } of rows) {
    const fail = (key: StudentColumn, code: string, message: string) =>
      issues.add(rowNumber, WARNING_SEVERITY.ERROR, code, message, label(key));

    const studentCode = normalizeStudentCode(cells.studentCode);
    if (nonText.get(rowNumber)?.includes('studentCode')) {
      fail('studentCode', IMPORT_ISSUE.IDENTITY_CELL_NOT_TEXT, MESSAGE.NOT_TEXT);
    } else if (!studentCode) {
      fail('studentCode', IMPORT_ISSUE.REQUIRED_EMPTY, MESSAGE.REQUIRED);
    } else if (!isValidStudentCode(studentCode)) {
      fail('studentCode', IMPORT_ISSUE.VALUE_INVALID, MESSAGE.CODE);
    }
    const peers = (occurrences.get(studentCode) ?? []).filter(
      (number) => number !== rowNumber,
    );
    if (studentCode && peers.length > 0) {
      fail(
        'studentCode',
        IMPORT_ISSUE.DUPLICATE_CODE_IN_FILE,
        `Mã sinh viên trùng với dòng ${peers.join(', ')}.`,
      );
    }

    const fullName = normalizeName(cells.fullName);
    if (!fullName) fail('fullName', IMPORT_ISSUE.REQUIRED_EMPTY, MESSAGE.REQUIRED);
    else if (fullName.length > STUDENT_LIMITS.NAME_MAX) {
      fail('fullName', IMPORT_ISSUE.VALUE_INVALID, `Nội dung vượt quá ${STUDENT_LIMITS.NAME_MAX} ký tự.`);
    }
    const major = cells.major.trim();
    if (!major) fail('major', IMPORT_ISSUE.REQUIRED_EMPTY, MESSAGE.REQUIRED);
    else if (major.length > STUDENT_LIMITS.MAJOR_MAX) {
      fail('major', IMPORT_ISSUE.VALUE_INVALID, `Nội dung vượt quá ${STUDENT_LIMITS.MAJOR_MAX} ký tự.`);
    }

    const reference = <T>(
      key: StudentColumn,
      found: T | undefined,
    ): T | undefined => {
      const text = cells[key].trim();
      if (!text) fail(key, IMPORT_ISSUE.REQUIRED_EMPTY, MESSAGE.REQUIRED);
      else if (!found) fail(key, IMPORT_ISSUE.REFERENCE_UNKNOWN, MESSAGE.UNKNOWN);
      return found;
    };
    const cohort = reference('cohortCode', context.cohortsByCode.get(cells.cohortCode.trim()));
    const program = reference('programCode', context.programsByCode.get(cells.programCode.trim()));
    const admission = reference(
      'admissionSemesterCode',
      context.semestersByCode.get(cells.admissionSemesterCode.trim()),
    );
    const statusSemester = reference(
      'statusSemesterCode',
      context.semestersByCode.get(cells.statusSemesterCode.trim()),
    );
    for (const [key, semester] of [
      ['admissionSemesterCode', admission],
      ['statusSemesterCode', statusSemester],
    ] as const) {
      if (semester && !semester.startDate) {
        fail(key, IMPORT_ISSUE.SEMESTER_START_UNKNOWN, MESSAGE.NO_START);
      }
    }

    const statusText = cells.status.trim();
    const status = statusText
      ? STATUS_BY_LABEL.get(normalizeLabel(statusText))
      : StudentStatus.STUDYING;
    if (!status) {
      fail('status', IMPORT_ISSUE.VALUE_INVALID, 'Trạng thái không thuộc các giá trị của mẫu.');
    }

    if (
      !cohort || !program || !admission?.startDate || !statusSemester?.startDate ||
      !status || !studentCode || !fullName || !major
    ) {
      continue;
    }
    if (statusSemester.startDate.getTime() < admission.startDate.getTime()) {
      fail('statusSemesterCode', IMPORT_ISSUE.STATUS_CHRONOLOGY_INVALID, 'Học kỳ trạng thái không được trước học kỳ nhập học.');
    }
    const profile: StudentProfileValue = {
      studentCode,
      fullName,
      cohortId: cohort.id,
      major,
      admissionSemesterId: admission.id,
      statusSemesterId: statusSemester.id,
      status,
    };
    const existing = context.studentsByCode.get(studentCode);
    const planRow: StudentImportPlanRow = {
      rowNumber,
      action: 'CREATE',
      existingId: existing?.id ?? null,
      expectedUpdatedAt: existing?.updatedAt.toISOString() ?? null,
      profile,
      programId: program.id,
      admissionAssignment: null,
    };

    if (existing?.dataSource === 'SCHOOL_DB') {
      if (samePerson(existing, profile)) {
        issues.add(rowNumber, WARNING_SEVERITY.INFO, IMPORT_ISSUE.UNCHANGED, 'Không thay đổi so với dữ liệu hiện có.');
        planRow.action = 'UNCHANGED';
      } else {
        issues.add(rowNumber, WARNING_SEVERITY.HIGH, IMPORT_ISSUE.SCHOOL_DB_PRESERVED, 'Hồ sơ đã có từ dữ liệu của Trường; giữ nguyên, không ghi đè bằng tệp Excel.');
        planRow.action = 'PRESERVE_SOURCE';
      }
      if (!issues.hasError(rowNumber)) plan.rows.push(planRow);
      continue;
    }

    if (context.accountConflicts.has(studentCode)) {
      fail('studentCode', IMPORT_ISSUE.ACCOUNT_IDENTITY_CONFLICT, 'Tài khoản trùng mã sinh viên thuộc một người dùng khác; không tự động liên kết.');
    }

    if (existing) {
      const stored = context.semestersById.get(existing.statusSemesterId);
      if (stored?.startDate && statusSemester.startDate.getTime() < stored.startDate.getTime()) {
        fail('statusSemesterCode', IMPORT_ISSUE.STATUS_CHRONOLOGY_INVALID, 'Học kỳ trạng thái không được trước học kỳ trạng thái đã lưu.');
      }
      if (TERMINAL.includes(existing.status) && existing.status !== status) {
        fail('status', IMPORT_ISSUE.STATUS_CHRONOLOGY_INVALID, 'Sinh viên đã thôi học hoặc tốt nghiệp; không đổi lại trạng thái bằng tệp Excel.');
      }
      const enrolled = existing.primaryProgramId !== null;
      if (
        enrolled &&
        (existing.cohortId !== profile.cohortId ||
          existing.admissionSemesterId !== profile.admissionSemesterId ||
          existing.primaryProgramId !== program.id)
      ) {
        fail('programCode', IMPORT_ISSUE.ENROLLMENT_CHANGE_REQUIRES_DECISION, 'Thay đổi khóa, học kỳ nhập học hoặc chương trình của sinh viên đã có ghi danh cần quyết định chuyển chương trình riêng.');
      }
      if (samePerson(existing, profile)) {
        planRow.action = 'UNCHANGED';
        issues.add(rowNumber, WARNING_SEVERITY.INFO, IMPORT_ISSUE.UNCHANGED, 'Không thay đổi so với dữ liệu hiện có.');
      } else {
        planRow.action = 'UPDATE';
        issues.add(rowNumber, WARNING_SEVERITY.INFO, IMPORT_ISSUE.WILL_UPDATE, 'Hồ sơ sinh viên sẽ được cập nhật.');
      }
    }

    // Only a student without any primary enrollment is admitted; an enrolled one keeps its pin.
    if (!existing || existing.primaryProgramId === null) {
      const assignment =
        context.assignments.get(assignmentKey(program.id, cohort.id, admission.id)) ?? null;
      if (!assignment) {
        issues.add(rowNumber, WARNING_SEVERITY.HIGH, IMPORT_ISSUE.PROGRAM_UNRESOLVED, MESSAGE.UNRESOLVED, label('programCode'));
      } else {
        planRow.admissionAssignment = assignment;
        const versionMajor = context.majorByVersionId.get(assignment.version.id);
        if (versionMajor && versionMajor.toUpperCase() !== major.toUpperCase()) {
          issues.add(rowNumber, WARNING_SEVERITY.HIGH, IMPORT_ISSUE.MAJOR_MISMATCH, 'Mã ngành khác mã ngành của phiên bản chương trình áp dụng.', label('major'));
        }
      }
    }
    if (!issues.hasError(rowNumber)) plan.rows.push(planRow);
  }
  return issues.result(rows.length, rows.map((row) => row.rowNumber), plan);
}
