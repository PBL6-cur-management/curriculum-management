import { CourseRelationType } from '../../../generated/prisma/client.js';
import type { SheetSpec } from './sheet-spec.js';

export const CURRICULUM_SHEET = {
  sheetName: 'Khung chương trình',
  headerFields: [
    { key: 'programCode', label: 'Mã chương trình' },
    { key: 'programName', label: 'Tên CTĐT' },
    { key: 'semesterCount', label: 'Số học kỳ' },
    { key: 'totalCredits', label: 'Tổng TC' },
    { key: 'compulsoryCredits', label: 'TC bắt buộc' },
    { key: 'electiveCredits', label: 'TC tự chọn' },
    { key: 'majorCode', label: 'Mã ngành' },
  ],
  columns: [
    {
      key: 'sequence',
      label: 'TT',
      required: false,
      ignoredOnRead: true,
      width: 6,
    },
    { key: 'blockSymbol', label: 'Ký hiệu', required: false, width: 10 },
    { key: 'courseCode', label: 'Mã HP', required: true, width: 12 },
    { key: 'courseName', label: 'Tên học phần', required: true, width: 40 },
    { key: 'credits', label: 'Số tín chỉ', required: true, width: 10 },
    { key: 'plannedSemester', label: 'Học kỳ', required: true, width: 8 },
    { key: 'isElective', label: 'Tự chọn', required: true, width: 9 },
    { key: 'htDa', label: 'HT ĐA', required: true, width: 8 },
    { key: 'tqDa', label: 'TQ ĐA', required: true, width: 8 },
    { key: 'minStudiedScore', label: 'Điểm học', required: true, width: 9 },
    {
      key: 'minTransferScore',
      label: 'Điểm chuyển',
      required: true,
      width: 11,
    },
    {
      key: 'registrable',
      label: 'Đăng ký được?',
      required: false,
      ignoredOnRead: true,
      width: 12,
    },
    {
      key: 'priorCourses',
      label: 'HP cần học trước',
      required: true,
      width: 30,
    },
    { key: 'corequisites', label: 'HP song hành', required: true, width: 30 },
    {
      key: 'prerequisites',
      label: 'Cần HP tiên quyết',
      required: true,
      width: 30,
    },
    { key: 'note', label: 'Ghi chú', required: true, width: 30 },
  ],
} as const satisfies SheetSpec;
export type CurriculumColumnKey =
  (typeof CURRICULUM_SHEET.columns)[number]['key'];
export type ProgramHeaderKey =
  (typeof CURRICULUM_SHEET.headerFields)[number]['key'];
export const REQUISITE_COLUMNS = [
  { key: 'priorCourses', relationType: CourseRelationType.PRIOR },
  { key: 'corequisites', relationType: CourseRelationType.COREQUISITE },
  { key: 'prerequisites', relationType: CourseRelationType.PREREQUISITE },
] as const satisfies readonly {
  key: CurriculumColumnKey;
  relationType: CourseRelationType;
}[];
export const SHEET_TRUE_VALUES: readonly string[] = ['x', '1', 'true', 'có'];
export const SHEET_TRUE_MARK = 'x';
export const REQUISITE_ENTRY_SEPARATOR = /[\n;,]+/;
export const REQUISITE_CODE_TOKEN = /^\s*([^\s–-]+)/;
export const REQUISITE_EXPORT_SEPARATOR = '\n';
export const REQUISITE_EXPORT_NAME_SEPARATOR = ' – ';
