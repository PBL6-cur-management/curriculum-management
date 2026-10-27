import {
  CourseRelationType,
  CourseStatus,
  Prisma,
} from '../../../generated/prisma/client.js';
import { CYCLE_CHECKED_TYPES } from '../../../shared/courses/requisite-graph.js';
import { curriculumCycles } from '../../../shared/curriculum/curriculum-cycles.js';
import {
  isCourseAddable,
  isSemesterInRange,
} from '../../../shared/curriculum/curriculum-row-rules.js';
import {
  curriculumWarnings,
  CURRICULUM_WARNING,
  WARNING_SEVERITY,
  type WarningItem,
} from '../../../shared/curriculum/curriculum-warnings.js';
import { programCredits } from '../../../shared/curriculum/program-credits.js';
import { COURSE_FIELD_LIMITS } from '../../../shared/courses/course-field-limits.js';
import {
  CREDITS_PATTERN,
  GRADE_POINT_PATTERN,
} from '../../../shared/decimal/decimal.js';
import { CURRICULUM_LIMITS } from '../../../shared/curriculum/curriculum-limits.js';
import {
  CURRICULUM_SHEET,
  REQUISITE_COLUMNS,
  REQUISITE_CODE_TOKEN,
  REQUISITE_ENTRY_SEPARATOR,
  SHEET_TRUE_VALUES,
  type CurriculumColumnKey,
  type ProgramHeaderKey,
} from '../sheets/curriculum.sheet.js';
import type { SheetRow } from '../sheets/sheet-reader.js';
import { normalizeLabel } from '../sheets/sheet-spec.js';
import type { CurriculumContext } from './curriculum-context.js';
import { IMPORT_ISSUE } from './import-issues.js';
import { IssueCollector, type ValidationResult } from './import-report.js';

export interface CurriculumPlanRow {
  courseId: string;
  existingItemId: string | null;
  plannedSemester: number;
  sortOrder: number;
  blockSymbol: string | null;
  isElective: boolean;
  electiveGroupId: string | null;
  htDa: boolean;
  tqDa: boolean;
  minStudiedScore: Prisma.Decimal | null;
  minTransferScore: Prisma.Decimal | null;
  note: string | null;
  requisites: {
    sourceCourseId: string;
    relationType: CourseRelationType;
    minScore: Prisma.Decimal | null;
  }[];
}
export interface CurriculumPlan {
  rows: CurriculumPlanRow[];
  removedItemIds: string[];
}

function compareHeader(
  header: Partial<Record<ProgramHeaderKey, string>>,
  context: CurriculumContext,
  issues: IssueCollector,
): void {
  const expected: Record<ProgramHeaderKey, string> = {
    ...context.program,
    semesterCount: String(context.version.semesterCount),
    totalCredits: context.version.totalCredits.toString(),
    compulsoryCredits: context.version.compulsoryCredits.toString(),
    electiveCredits: context.version.electiveCredits.toString(),
  };
  for (const field of CURRICULUM_SHEET.headerFields) {
    const actual = header[field.key]?.trim();
    if (!actual) continue;
    const numeric =
      field.key === 'semesterCount' || field.key.endsWith('Credits');
    const same =
      numeric && CREDITS_PATTERN.test(actual)
        ? new Prisma.Decimal(actual).equals(expected[field.key])
        : actual === expected[field.key];
    if (same) continue;
    const wrongProgram = field.key === 'programCode';
    issues.add(
      null,
      wrongProgram ? WARNING_SEVERITY.ERROR : WARNING_SEVERITY.HIGH,
      wrongProgram
        ? IMPORT_ISSUE.PROGRAM_MISMATCH
        : IMPORT_ISSUE.HEADER_DIFFERS,
      `${field.label} trong tệp (${actual}) khác chương trình đã chọn (${expected[field.key]}).`,
      field.label,
    );
  }
}

export function validateCurriculumRows(
  parsed: {
    header: Partial<Record<ProgramHeaderKey, string>>;
    rows: readonly SheetRow<CurriculumColumnKey>[];
    unknownColumns?: readonly string[];
  },
  context: CurriculumContext,
): ValidationResult<CurriculumPlan> {
  const issues = new IssueCollector();
  for (const column of parsed.unknownColumns ?? [])
    issues.add(
      null,
      WARNING_SEVERITY.INFO,
      IMPORT_ISSUE.UNKNOWN_COLUMN,
      `Bỏ qua cột ngoài mẫu: ${column}.`,
      column,
    );
  compareHeader(parsed.header, context, issues);
  const plan: CurriculumPlan = { rows: [], removedItemIds: [] };
  const firstRows = new Map<string, number>();
  const semesterOrders = new Map<number, number>();
  const candidates: {
    rowNumber: number;
    row: CurriculumPlanRow;
    warning: WarningItem;
  }[] = [];
  const coursesById = new Map(
    [...context.coursesByCode.values()].map((course) => [course.id, course]),
  );
  for (const { rowNumber, cells } of parsed.rows) {
    const error = (key: CurriculumColumnKey, code: string, message: string) =>
      issues.add(
        rowNumber,
        WARNING_SEVERITY.ERROR,
        code,
        message,
        CURRICULUM_SHEET.columns.find((column) => column.key === key)!.label,
      );
    const courseCode = cells.courseCode.trim().toUpperCase();
    for (const [key, max] of [
      ['courseCode', COURSE_FIELD_LIMITS.CODE_MAX],
      ['courseName', COURSE_FIELD_LIMITS.NAME_MAX],
    ] as const) {
      if (cells[key].trim().length > max)
        error(
          key,
          IMPORT_ISSUE.VALUE_INVALID,
          `Nội dung vượt quá ${max} ký tự.`,
        );
    }
    for (const key of ['courseCode', 'plannedSemester'] as const)
      if (!cells[key].trim())
        error(key, IMPORT_ISSUE.REQUIRED_EMPTY, 'Ô bắt buộc chưa có dữ liệu.');
    const course = context.coursesByCode.get(courseCode);
    if (!course) {
      error(
        'courseCode',
        IMPORT_ISSUE.COURSE_UNKNOWN,
        `Mã HP ${courseCode} không tồn tại trong danh mục.`,
      );
      continue;
    }
    const first = firstRows.get(course.id);
    if (first !== undefined) {
      error(
        'courseCode',
        CURRICULUM_WARNING.DUPLICATE_COURSE,
        `Mã HP ${courseCode} đã có ở dòng ${first}.`,
      );
      continue;
    }
    firstRows.set(course.id, rowNumber);
    if (!isCourseAddable(course.status))
      error(
        'courseCode',
        IMPORT_ISSUE.COURSE_NOT_ACTIVE,
        `Học phần ${courseCode} không còn hoạt động.`,
      );
    const semesterText = cells.plannedSemester.trim();
    const plannedSemester = Number(semesterText);
    if (!/^\d+$/.test(semesterText) || !Number.isSafeInteger(plannedSemester))
      error(
        'plannedSemester',
        IMPORT_ISSUE.VALUE_INVALID,
        'Học kỳ phải là số nguyên.',
      );
    if (!isSemesterInRange(context.version.semesterCount, plannedSemester))
      error(
        'plannedSemester',
        IMPORT_ISSUE.SEMESTER_OUT_OF_RANGE,
        `Học kỳ phải từ 1 đến ${context.version.semesterCount}.`,
      );
    const flag = (key: 'isElective' | 'htDa' | 'tqDa') => {
      const value = normalizeLabel(cells[key]);
      if (value && !SHEET_TRUE_VALUES.includes(value))
        error(
          key,
          IMPORT_ISSUE.VALUE_INVALID,
          'Chỉ nhận x, 1, true, có hoặc để trống.',
        );
      return SHEET_TRUE_VALUES.includes(value);
    };
    const score = (key: 'minStudiedScore' | 'minTransferScore') => {
      const value = cells[key].trim();
      if (!value) return null;
      if (!GRADE_POINT_PATTERN.test(value)) {
        error(
          key,
          IMPORT_ISSUE.VALUE_INVALID,
          'Điểm phải từ 0 đến 4, tối đa hai chữ số thập phân.',
        );
        return null;
      }
      return new Prisma.Decimal(value);
    };
    for (const [key, max] of [
      ['blockSymbol', CURRICULUM_LIMITS.BLOCK_SYMBOL_MAX],
      ['note', CURRICULUM_LIMITS.NOTE_MAX],
    ] as const)
      if (cells[key].trim().length > max)
        error(
          key,
          IMPORT_ISSUE.VALUE_INVALID,
          `Nội dung vượt quá ${max} ký tự.`,
        );
    if (
      cells.courseName.trim() &&
      cells.courseName.trim() !== course.courseName
    )
      issues.add(
        rowNumber,
        WARNING_SEVERITY.HIGH,
        IMPORT_ISSUE.CATALOG_DIFFERS,
        `Tên học phần khác danh mục; giữ tên ${course.courseName}.`,
        'Tên học phần',
      );
    if (cells.credits.trim()) {
      if (!CREDITS_PATTERN.test(cells.credits.trim()))
        error(
          'credits',
          IMPORT_ISSUE.VALUE_INVALID,
          'Số tín chỉ không hợp lệ.',
        );
      else if (!course.credits.equals(cells.credits.trim()))
        issues.add(
          rowNumber,
          WARNING_SEVERITY.HIGH,
          IMPORT_ISSUE.CATALOG_DIFFERS,
          `Số tín chỉ khác danh mục; giữ ${course.credits.toString()} tín chỉ.`,
          'Số tín chỉ',
        );
    }
    const isElective = flag('isElective');
    const existing = context.existingItems.get(course.id);
    const electiveGroupId = isElective
      ? (existing?.electiveGroupId ?? null)
      : null;
    if (!isElective && existing?.electiveGroupId)
      issues.add(
        rowNumber,
        WARNING_SEVERITY.HIGH,
        IMPORT_ISSUE.GROUP_DROPPED,
        `Học phần ${courseCode} sẽ rời nhóm tự chọn.`,
        'Tự chọn',
      );
    const sortOrder = (semesterOrders.get(plannedSemester) ?? 0) + 1;
    semesterOrders.set(plannedSemester, sortOrder);
    const row: CurriculumPlanRow = {
      courseId: course.id,
      existingItemId: existing?.id ?? null,
      plannedSemester,
      sortOrder,
      blockSymbol: cells.blockSymbol.trim() || null,
      isElective,
      electiveGroupId,
      htDa: flag('htDa'),
      tqDa: flag('tqDa'),
      minStudiedScore: score('minStudiedScore'),
      minTransferScore: score('minTransferScore'),
      note: cells.note.trim() || null,
      requisites: [],
    };
    for (const column of REQUISITE_COLUMNS) {
      const seen = new Set<string>();
      for (const entry of cells[column.key]
        .split(REQUISITE_ENTRY_SEPARATOR)
        .filter((value) => value.trim())) {
        const code = REQUISITE_CODE_TOKEN.exec(entry)?.[1]?.toUpperCase() ?? '';
        const source = context.coursesByCode.get(code);
        if (!source) {
          error(
            column.key,
            IMPORT_ISSUE.REQUISITE_UNKNOWN,
            `Mã HP điều kiện ${code} không tồn tại.`,
          );
          continue;
        }
        if (source.status === CourseStatus.CANCELLED) {
          error(
            column.key,
            IMPORT_ISSUE.REQUISITE_CANCELLED,
            `Học phần điều kiện ${code} đã bị hủy.`,
          );
          continue;
        }
        if (source.id === course.id) {
          error(
            column.key,
            IMPORT_ISSUE.REQUISITE_SELF,
            'Học phần không thể là điều kiện của chính nó.',
          );
          continue;
        }
        if (seen.has(source.id)) {
          error(
            column.key,
            IMPORT_ISSUE.REQUISITE_DUPLICATE,
            `Học phần điều kiện ${code} bị lặp.`,
          );
          continue;
        }
        seen.add(source.id);
        row.requisites.push({
          sourceCourseId: source.id,
          relationType: column.relationType,
          minScore:
            column.relationType === CourseRelationType.PREREQUISITE
              ? (context.catalogMinScores.get(`${source.id}>${course.id}`) ??
                null)
              : null,
        });
      }
    }
    candidates.push({
      rowNumber,
      row,
      warning: {
        id: String(rowNumber),
        courseId: course.id,
        courseCode,
        credits: course.credits,
        plannedSemester,
        isElective,
        electiveGroupId,
        requisites: row.requisites.map((requisite) => ({
          ...requisite,
          sourceCourseCode: coursesById.get(requisite.sourceCourseId)!
            .courseCode,
        })),
      },
    });
  }
  const fileEdges = candidates.flatMap(({ row }) =>
    row.requisites
      .filter((requisite) =>
        CYCLE_CHECKED_TYPES.includes(requisite.relationType),
      )
      .map((requisite) => ({
        sourceCourseId: requisite.sourceCourseId,
        targetCourseId: row.courseId,
      })),
  );
  for (const path of curriculumCycles(context.catalogEdges, fileEdges)) {
    issues.add(
      firstRows.get(path[0]) ?? null,
      WARNING_SEVERITY.ERROR,
      CURRICULUM_WARNING.REQUISITE_CYCLE,
      `Vòng lặp điều kiện: ${path.map((id) => coursesById.get(id)?.courseCode ?? id).join(' → ')}`,
      'HP cần học trước / Cần HP tiên quyết',
    );
  }
  const warningItems = candidates.map((candidate) => candidate.warning);
  for (const warning of curriculumWarnings({
    semesterCount: context.version.semesterCount,
    items: warningItems,
    groups: context.groups,
  })) {
    const column =
      warning.code === CURRICULUM_WARNING.ELECTIVE_WITHOUT_GROUP
        ? 'Tự chọn'
        : warning.code === CURRICULUM_WARNING.REQUISITE_OUTSIDE ||
            warning.code === CURRICULUM_WARNING.REQUISITE_NOT_EARLIER
          ? 'HP cần học trước / HP song hành / Cần HP tiên quyết'
          : null;
    issues.add(
      warning.itemId === null ? null : Number(warning.itemId),
      warning.severity,
      warning.code,
      warning.message,
      column,
    );
  }
  const credits = programCredits(warningItems, context.groups);
  if (
    !credits.compulsory.equals(context.version.compulsoryCredits) ||
    !credits.elective.equals(context.version.electiveCredits) ||
    !credits.total.equals(context.version.totalCredits)
  ) {
    issues.add(
      null,
      WARNING_SEVERITY.HIGH,
      IMPORT_ISSUE.CREDIT_MISMATCH,
      `Tín chỉ tính từ khung: ${credits.total.toString()} (bắt buộc ${credits.compulsory.toString()}, tự chọn ${credits.elective.toString()}); khác tín chỉ khai báo.`,
    );
  }
  for (const [courseId, existing] of context.existingItems) {
    if (firstRows.has(courseId)) continue;
    issues.add(
      null,
      WARNING_SEVERITY.HIGH,
      IMPORT_ISSUE.ROW_REMOVED,
      `Học phần ${existing.courseCode} (học kỳ ${existing.plannedSemester}) sẽ bị xóa khỏi khung.`,
    );
    plan.removedItemIds.push(existing.id);
  }
  plan.rows = candidates
    .filter(({ rowNumber }) => !issues.hasError(rowNumber))
    .map(({ row }) => row);
  return issues.result(
    parsed.rows.length,
    parsed.rows.map((row) => row.rowNumber),
    plan,
  );
}
