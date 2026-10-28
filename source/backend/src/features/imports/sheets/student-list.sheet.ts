import type { StudentStatus } from '../../../generated/prisma/client.js';
import type { SheetSpec } from './sheet-spec.js';

export const STUDENT_SHEET_WIDTHS = {
  CODE: 16,
  NAME: 32,
  COHORT: 16,
  MAJOR: 16,
  PROGRAM: 18,
  SEMESTER: 18,
  STATUS: 16,
} as const;

export const STUDENT_LIST_SHEET = {
  sheetName: 'Sinh viên',
  headerFields: [],
  columns: [
    { key: 'studentCode', label: 'Mã sinh viên', required: true, width: STUDENT_SHEET_WIDTHS.CODE },
    { key: 'fullName', label: 'Họ tên', required: true, width: STUDENT_SHEET_WIDTHS.NAME },
    { key: 'cohortCode', label: 'Khóa tuyển sinh', required: true, width: STUDENT_SHEET_WIDTHS.COHORT },
    { key: 'major', label: 'Mã ngành', required: true, width: STUDENT_SHEET_WIDTHS.MAJOR },
    { key: 'programCode', label: 'Mã chương trình', required: true, width: STUDENT_SHEET_WIDTHS.PROGRAM },
    { key: 'admissionSemesterCode', label: 'Học kỳ nhập học', required: true, width: STUDENT_SHEET_WIDTHS.SEMESTER },
    { key: 'statusSemesterCode', label: 'Học kỳ trạng thái', required: true, width: STUDENT_SHEET_WIDTHS.SEMESTER },
    { key: 'status', label: 'Trạng thái', required: true, width: STUDENT_SHEET_WIDTHS.STATUS },
  ],
} as const satisfies SheetSpec;

export type StudentColumn = (typeof STUDENT_LIST_SHEET.columns)[number]['key'];

// Columns whose cells must be literal text: a numeric or formula cell has already lost leading zeros or been recomputed.
export const STUDENT_IDENTITY_COLUMNS = ['studentCode'] as const satisfies readonly StudentColumn[];

export const STUDENT_STATUS_TEXT = {
  'Đang học': 'STUDYING',
  'Bảo lưu': 'ON_LEAVE',
  'Thôi học': 'WITHDRAWN',
  'Đã tốt nghiệp': 'GRADUATED',
} as const satisfies Record<string, StudentStatus>;
