import {
  CourseStatus,
  CourseType,
  Prisma,
} from '../../../generated/prisma/client.js';
import {
  ownerProblem,
  OWNER_PROBLEM,
} from '../../../shared/courses/course-owners.js';
import { WARNING_SEVERITY } from '../../../shared/curriculum/curriculum-warnings.js';
import { CREDITS_PATTERN } from '../../../shared/decimal/decimal.js';
import { COURSE_FIELD_LIMITS } from '../../../shared/courses/course-field-limits.js';
import {
  COURSE_CATALOG_SHEET,
  COURSE_TYPE_SHEET_LABELS,
  type CatalogColumnKey,
} from '../sheets/course-catalog.sheet.js';
import type { SheetRow } from '../sheets/sheet-reader.js';
import { normalizeLabel } from '../sheets/sheet-spec.js';
import type { CatalogContext } from './catalog-context.js';
import { IMPORT_ISSUE } from './import-issues.js';
import { IssueCollector, type ValidationResult } from './import-report.js';

export interface CatalogPlan {
  creates: Prisma.CourseCreateManyInput[];
  updates: { id: string; data: Prisma.CourseUpdateInput }[];
}
const TYPE_BY_LABEL = new Map(
  Object.entries(COURSE_TYPE_SHEET_LABELS).map(([type, label]) => [
    normalizeLabel(label),
    type as CourseType,
  ]),
);

export function validateCatalogRows(
  rows: readonly SheetRow<CatalogColumnKey>[],
  context: CatalogContext,
  unknownColumns: readonly string[] = [],
): ValidationResult<CatalogPlan> {
  const issues = new IssueCollector();
  for (const column of unknownColumns)
    issues.add(
      null,
      WARNING_SEVERITY.INFO,
      IMPORT_ISSUE.UNKNOWN_COLUMN,
      `Bỏ qua cột ngoài mẫu: ${column}.`,
      column,
    );
  const plan: CatalogPlan = { creates: [], updates: [] };
  const occurrences = new Map<string, number[]>();
  for (const row of rows) {
    const code = row.cells.courseCode.trim().toUpperCase();
    const numbers = occurrences.get(code) ?? [];
    numbers.push(row.rowNumber);
    occurrences.set(code, numbers);
  }
  for (const { rowNumber, cells } of rows) {
    const error = (key: CatalogColumnKey, code: string, message: string) =>
      issues.add(
        rowNumber,
        WARNING_SEVERITY.ERROR,
        code,
        message,
        COURSE_CATALOG_SHEET.columns.find((column) => column.key === key)!
          .label,
      );
    for (const key of [
      'courseCode',
      'courseName',
      'credits',
      'courseType',
    ] as const)
      if (!cells[key].trim())
        error(key, IMPORT_ISSUE.REQUIRED_EMPTY, 'Ô bắt buộc chưa có dữ liệu.');
    const courseCode = cells.courseCode.trim().toUpperCase();
    const courseName = cells.courseName.trim();
    const englishName = cells.englishName.trim() || null;
    for (const [key, max] of [
      ['courseCode', COURSE_FIELD_LIMITS.CODE_MAX],
      ['courseName', COURSE_FIELD_LIMITS.NAME_MAX],
      ['englishName', COURSE_FIELD_LIMITS.NAME_MAX],
    ] as const) {
      if (cells[key].trim().length > max)
        error(
          key,
          IMPORT_ISSUE.VALUE_INVALID,
          `Nội dung vượt quá ${max} ký tự.`,
        );
    }
    const creditsText = cells.credits.trim();
    if (!CREDITS_PATTERN.test(creditsText))
      error(
        'credits',
        IMPORT_ISSUE.VALUE_INVALID,
        'Số tín chỉ không hợp lệ (0 đến 999.99, tối đa hai chữ số thập phân).',
      );
    const credits = CREDITS_PATTERN.test(creditsText)
      ? new Prisma.Decimal(creditsText)
      : null;
    const courseType =
      TYPE_BY_LABEL.get(normalizeLabel(cells.courseType)) ??
      Object.values(CourseType).find(
        (value) => value === cells.courseType.trim(),
      );
    if (!courseType)
      error(
        'courseType',
        IMPORT_ISSUE.VALUE_INVALID,
        'Loại học phần không hợp lệ.',
      );
    const faculty =
      context.facultiesByCode.get(
        cells.ownerFacultyCode.trim().toUpperCase() || context.homeFacultyCode,
      ) ?? null;
    const groupCode = cells.ownerGroupCode.trim().toUpperCase();
    const group = context.groupsByCode.get(groupCode) ?? null;
    const problem = ownerProblem(faculty, group, !!groupCode);
    if (problem === OWNER_PROBLEM.FACULTY_INVALID)
      error(
        'ownerFacultyCode',
        IMPORT_ISSUE.OWNER_FACULTY_INVALID,
        'Khoa phụ trách không tồn tại hoặc không phải khoa đang hoạt động.',
      );
    if (problem === OWNER_PROBLEM.GROUP_INVALID)
      error(
        'ownerGroupCode',
        IMPORT_ISSUE.OWNER_GROUP_INVALID,
        'Nhóm chuyên môn không hoạt động hoặc không thuộc khoa phụ trách.',
      );
    const duplicates = occurrences.get(courseCode)!;
    if (courseCode && duplicates.length > 1)
      error(
        'courseCode',
        IMPORT_ISSUE.DUPLICATE_CODE_IN_FILE,
        `Mã HP ${courseCode} lặp lại ở các dòng ${duplicates.join(', ')}.`,
      );
    const existing = context.coursesByCode.get(courseCode);
    if (existing?.status === CourseStatus.CANCELLED)
      error(
        'courseCode',
        IMPORT_ISSUE.COURSE_CANCELLED,
        `Học phần ${courseCode} đã bị hủy.`,
      );
    if (credits?.isZero())
      issues.add(
        rowNumber,
        WARNING_SEVERITY.HIGH,
        IMPORT_ISSUE.ZERO_CREDITS,
        'Học phần có 0 tín chỉ.',
        'Số tín chỉ',
      );
    if (issues.hasError(rowNumber) || !faculty || !credits || !courseType)
      continue;
    const data: Prisma.CourseCreateManyInput = {
      courseCode,
      courseName,
      englishName,
      credits,
      courseType,
      ownerFacultyId: faculty.id,
      ownerGroupId: groupCode ? group!.id : null,
    };
    if (!existing) {
      plan.creates.push(data);
      continue;
    }
    const changed = [
      [existing.courseName !== courseName, 'tên học phần'],
      [existing.englishName !== englishName, 'tên tiếng Anh'],
      [!existing.credits.equals(credits), 'số tín chỉ'],
      [existing.courseType !== courseType, 'loại học phần'],
      [existing.ownerFacultyId !== data.ownerFacultyId, 'khoa phụ trách'],
      [existing.ownerGroupId !== data.ownerGroupId, 'nhóm chuyên môn'],
    ]
      .filter(([different]) => different)
      .map(([, label]) => label);
    if (!changed.length) {
      issues.add(
        rowNumber,
        WARNING_SEVERITY.INFO,
        IMPORT_ISSUE.UNCHANGED,
        `Học phần ${courseCode} không thay đổi.`,
        'Mã HP',
      );
      continue;
    }
    if (context.releasedCourseIds.has(existing.id)) {
      error(
        'courseCode',
        IMPORT_ISSUE.COURSE_RELEASED,
        `Học phần ${courseCode} đã ban hành, sửa qua đề xuất thay đổi.`,
      );
      continue;
    }
    issues.add(
      rowNumber,
      WARNING_SEVERITY.HIGH,
      IMPORT_ISSUE.WILL_UPDATE,
      `Sẽ cập nhật ${changed.join(', ')} của ${courseCode}.`,
      'Mã HP',
    );
    plan.updates.push({
      id: existing.id,
      data: {
        courseName,
        englishName,
        credits,
        courseType,
        ownerFaculty: { connect: { id: faculty.id } },
        ownerGroup: groupCode
          ? { connect: { id: group!.id } }
          : { disconnect: true },
      },
    });
  }
  return issues.result(
    rows.length,
    rows.map((row) => row.rowNumber),
    plan,
  );
}
