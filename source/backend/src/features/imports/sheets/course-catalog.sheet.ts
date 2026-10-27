import { CourseType } from '../../../generated/prisma/client.js';
import type { SheetSpec } from './sheet-spec.js';

export const COURSE_CATALOG_SHEET = {
  sheetName: 'Danh mục học phần',
  headerFields: [],
  columns: [
    { key: 'courseCode', label: 'Mã HP', required: true, width: 12 },
    { key: 'courseName', label: 'Tên học phần', required: true, width: 40 },
    { key: 'englishName', label: 'Tên tiếng Anh', required: true, width: 40 },
    { key: 'credits', label: 'Số tín chỉ', required: true, width: 10 },
    { key: 'courseType', label: 'Loại học phần', required: true, width: 18 },
    {
      key: 'ownerFacultyCode',
      label: 'Mã khoa phụ trách',
      required: true,
      width: 18,
    },
    {
      key: 'ownerGroupCode',
      label: 'Mã nhóm chuyên môn',
      required: true,
      width: 20,
    },
  ],
} as const satisfies SheetSpec;
export type CatalogColumnKey =
  (typeof COURSE_CATALOG_SHEET.columns)[number]['key'];
export const COURSE_TYPE_SHEET_LABELS: Record<CourseType, string> = {
  THEORY: 'Lý thuyết',
  PRACTICE: 'Thực hành',
  LAB: 'Thí nghiệm',
  PROJECT: 'Đồ án',
  CAPSTONE: 'Đồ án tốt nghiệp',
  INTERNSHIP: 'Thực tập',
  CONDITIONAL: 'Học phần điều kiện',
};
