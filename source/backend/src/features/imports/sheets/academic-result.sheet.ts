import type { AcademicResultStatus } from '../../../generated/prisma/client.js';
import type { SheetSpec } from './sheet-spec.js';

export const RESULT_SHEET_WIDTHS = {
  CODE: 16,
  SEMESTER: 18,
  SCORE: 14,
  LETTER: 12,
  STATUS: 16,
} as const;

export const ACADEMIC_RESULT_SHEET = {
  sheetName: 'Kết quả học tập',
  headerFields: [],
  columns: [
    { key: 'studentCode', label: 'Mã sinh viên', required: true, width: RESULT_SHEET_WIDTHS.CODE },
    { key: 'courseCode', label: 'Mã học phần', required: true, width: RESULT_SHEET_WIDTHS.CODE },
    { key: 'semesterCode', label: 'Học kỳ', required: true, width: RESULT_SHEET_WIDTHS.SEMESTER },
    { key: 'score10', label: 'Điểm thang 10', required: true, width: RESULT_SHEET_WIDTHS.SCORE },
    { key: 'score4', label: 'Điểm thang 4', required: true, width: RESULT_SHEET_WIDTHS.SCORE },
    { key: 'letterGrade', label: 'Điểm chữ', required: true, width: RESULT_SHEET_WIDTHS.LETTER },
    { key: 'status', label: 'Trạng thái', required: true, width: RESULT_SHEET_WIDTHS.STATUS },
  ],
} as const satisfies SheetSpec;

export type ResultColumn =
  (typeof ACADEMIC_RESULT_SHEET.columns)[number]['key'];

export const RESULT_IDENTITY_COLUMNS = ['studentCode'] as const satisfies readonly ResultColumn[];

export const RESULT_STATUS_TEXT = {
  'Đạt': 'PASSED',
  'Không đạt': 'FAILED',
  'Đang học': 'IN_PROGRESS',
  'Miễn': 'EXEMPT',
} as const satisfies Record<string, AcademicResultStatus>;
