import {
  EnrollmentType,
  StudentStatus,
} from '../../../generated/prisma/client.js';
import { WARNING_SEVERITY } from '../../../shared/curriculum/curriculum-warnings.js';
import {
  isValidStudentCode,
  normalizeStudentCode,
} from '../../../shared/students/student-identity.js';
import type { ProgramTransferImportPlan } from '../../../shared/students/student-import.types.js';
import { STUDENT_LIMITS } from '../../../shared/students/student.constants.js';
import type { NonTextCells } from '../sheets/identity-cells.js';
import {
  PROGRAM_TRANSFER_SHEET,
  type ProgramTransferColumn,
} from '../sheets/program-transfer.sheet.js';
import type { SheetRow } from '../sheets/sheet-reader.js';
import { IMPORT_ISSUE } from './import-issues.js';
import { IssueCollector, type ValidationResult } from './import-report.js';
import type {
  ProgramTransferContext,
  TransferVersionFact,
} from './program-transfer-context.js';

const label = (key: ProgramTransferColumn) =>
  PROGRAM_TRANSFER_SHEET.columns.find((column) => column.key === key)!.label;
const TERMINAL: readonly StudentStatus[] = [
  StudentStatus.WITHDRAWN,
  StudentStatus.GRADUATED,
];

function latestVersion(
  versions: readonly TransferVersionFact[],
): TransferVersionFact | undefined {
  return [...versions].sort(
    (a, b) =>
      b.publishedAt.getTime() - a.publishedAt.getTime() ||
      (a.id < b.id ? -1 : 1),
  )[0];
}

export function validateProgramTransferRows(
  rows: readonly SheetRow<ProgramTransferColumn>[],
  context: ProgramTransferContext,
  nonText: NonTextCells<ProgramTransferColumn> = new Map(),
): ValidationResult<ProgramTransferImportPlan> {
  const issues = new IssueCollector();
  const plan: ProgramTransferImportPlan = { rows: [] };
  const occurrences = new Map<string, number[]>();
  for (const row of rows) {
    const code = normalizeStudentCode(row.cells.studentCode);
    occurrences.set(code, [...(occurrences.get(code) ?? []), row.rowNumber]);
  }

  for (const { rowNumber, cells } of rows) {
    const fail = (key: ProgramTransferColumn, code: string, message: string) =>
      issues.add(rowNumber, WARNING_SEVERITY.ERROR, code, message, label(key));
    const required = (key: ProgramTransferColumn, found: unknown) => {
      if (!cells[key].trim())
        fail(key, IMPORT_ISSUE.REQUIRED_EMPTY, 'Ô bắt buộc chưa có dữ liệu.');
      else if (!found)
        fail(
          key,
          IMPORT_ISSUE.REFERENCE_UNKNOWN,
          'Không tìm thấy giá trị này trong hệ thống.',
        );
    };

    const studentCode = normalizeStudentCode(cells.studentCode);
    const student = context.studentsByCode.get(studentCode);
    if (nonText.get(rowNumber)?.includes('studentCode')) {
      fail(
        'studentCode',
        IMPORT_ISSUE.IDENTITY_CELL_NOT_TEXT,
        'Mã SV phải là văn bản thuần, không phải số hoặc công thức; định dạng cột là Text.',
      );
    } else if (studentCode && !isValidStudentCode(studentCode)) {
      fail('studentCode', IMPORT_ISSUE.VALUE_INVALID, 'Mã SV không hợp lệ.');
    } else {
      required('studentCode', student);
    }
    const peers = (occurrences.get(studentCode) ?? []).filter(
      (n) => n !== rowNumber,
    );
    if (studentCode && peers.length > 0)
      fail(
        'studentCode',
        IMPORT_ISSUE.DUPLICATE_CODE_IN_FILE,
        `Sinh viên cũng xuất hiện ở dòng ${peers.join(', ')}.`,
      );

    const program = context.programsByCode.get(cells.programCode.trim());
    required('programCode', program);
    const versions = program
      ? (context.versionsByProgram.get(program.id) ?? [])
      : [];
    const versionText = cells.versionNumber.trim();
    let version: TransferVersionFact | undefined;
    if (program) {
      version = versionText
        ? versions.find((entry) => entry.versionNumber === versionText)
        : latestVersion(versions);
      if (!version)
        fail(
          'versionNumber',
          versionText
            ? IMPORT_ISSUE.REFERENCE_UNKNOWN
            : IMPORT_ISSUE.PROGRAM_UNRESOLVED,
          versionText
            ? 'Không tìm thấy phiên bản đã ban hành này của chương trình đích.'
            : 'Chương trình đích chưa có phiên bản nào đã ban hành.',
        );
    }
    const trackText = cells.trackCode.trim();
    let trackId: string | null = null;
    if (trackText && version) {
      trackId = version.tracks.get(trackText) ?? null;
      if (!trackId)
        fail(
          'trackCode',
          IMPORT_ISSUE.REFERENCE_UNKNOWN,
          'Mã định hướng không thuộc phiên bản đích.',
        );
    }
    const semester = context.semestersByCode.get(cells.semesterCode.trim());
    required('semesterCode', semester);
    if (semester && !semester.startDate)
      fail(
        'semesterCode',
        IMPORT_ISSUE.SEMESTER_START_UNKNOWN,
        'Học kỳ chưa có ngày bắt đầu.',
      );
    const basis = cells.basisDecision.trim();
    if (!basis)
      fail(
        'basisDecision',
        IMPORT_ISSUE.REQUIRED_EMPTY,
        'Ô bắt buộc chưa có dữ liệu.',
      );
    else if (basis.length > STUDENT_LIMITS.BASIS_MAX)
      fail(
        'basisDecision',
        IMPORT_ISSUE.VALUE_INVALID,
        `Nội dung vượt quá ${STUDENT_LIMITS.BASIS_MAX} ký tự.`,
      );

    if (!student || !program || !version || !semester?.startDate) continue;
    if (issues.hasError(rowNumber)) continue;
    if (TERMINAL.includes(student.status)) {
      fail(
        'studentCode',
        IMPORT_ISSUE.TRANSFER_INVALID,
        'Sinh viên đã thôi học hoặc đã tốt nghiệp, không thể chuyển chương trình.',
      );
      continue;
    }
    const source = student.activeEnrollments.find(
      (row) => row.enrollmentType === EnrollmentType.PRIMARY,
    );
    if (!source) {
      fail(
        'studentCode',
        IMPORT_ISSUE.TRANSFER_INVALID,
        'Sinh viên chưa có quá trình theo học chính đang hiệu lực.',
      );
      continue;
    }
    if (source.appliedVersionId === version.id && source.trackId === trackId) {
      issues.add(
        rowNumber,
        WARNING_SEVERITY.INFO,
        IMPORT_ISSUE.UNCHANGED,
        'Sinh viên đã ở phiên bản và định hướng này; bỏ qua.',
      );
      continue;
    }
    if (
      !version.effectiveStart ||
      version.effectiveStart.getTime() > semester.startDate.getTime()
    ) {
      fail(
        'semesterCode',
        IMPORT_ISSUE.TRANSFER_INVALID,
        'Học kỳ áp dụng trước học kỳ có hiệu lực của phiên bản đích.',
      );
      continue;
    }
    if (
      !source.fromSemesterStart ||
      source.fromSemesterStart.getTime() > semester.startDate.getTime()
    ) {
      fail(
        'semesterCode',
        IMPORT_ISSUE.TRANSFER_INVALID,
        'Học kỳ áp dụng trước học kỳ bắt đầu của quá trình theo học hiện tại.',
      );
      continue;
    }
    if (
      student.activeEnrollments.some(
        (row) => row.programId === program.id && row.id !== source.id,
      )
    ) {
      fail(
        'programCode',
        IMPORT_ISSUE.TRANSFER_INVALID,
        'Sinh viên đang theo học chương trình đích ở một quá trình khác.',
      );
      continue;
    }
    plan.rows.push({
      rowNumber,
      studentId: student.id,
      studentCode: student.studentCode,
      studentUpdatedAt: student.updatedAt.toISOString(),
      sourceEnrollmentId: source.id,
      sourceUpdatedAt: source.updatedAt.toISOString(),
      targetVersionId: version.id,
      trackId,
      fromSemesterId: semester.id,
      basisDecision: basis,
    });
    issues.add(
      rowNumber,
      WARNING_SEVERITY.INFO,
      IMPORT_ISSUE.WILL_UPDATE,
      `Sẽ chuyển sang phiên bản ${version.versionNumber}.`,
    );
  }
  return issues.result(
    rows.length,
    rows.map((row) => row.rowNumber),
    plan,
  );
}
