import { CourseRelationType, Prisma } from '../../generated/prisma/client.js';
import type { CreditGroup, CreditItem } from './program-credits.js';
import { rowCredits } from './row-course.js';

export const CURRICULUM_WARNING = {
  EMPTY_SEMESTER: 'EMPTY_SEMESTER',
  REQUISITE_NOT_EARLIER: 'REQUISITE_NOT_EARLIER',
  REQUISITE_OUTSIDE: 'REQUISITE_OUTSIDE',
  ELECTIVE_WITHOUT_GROUP: 'ELECTIVE_WITHOUT_GROUP',
  DUPLICATE_COURSE: 'DUPLICATE_COURSE',
  GROUP_MINIMUM_UNREACHABLE: 'GROUP_MINIMUM_UNREACHABLE',
  REQUISITE_CYCLE: 'REQUISITE_CYCLE',
  CREDIT_MISMATCH: 'CREDIT_MISMATCH',
  CREDIT_MISMATCH_ACCEPTED: 'CREDIT_MISMATCH_ACCEPTED',
  // Raised by the checker only: a course of the frame has no syllabus revision to release with.
  MISSING_SYLLABUS: 'MISSING_SYLLABUS',
} as const;
export type CurriculumWarningCode =
  (typeof CURRICULUM_WARNING)[keyof typeof CURRICULUM_WARNING];

// ERROR blocks submit and release; HIGH and INFO only show.
export const WARNING_SEVERITY = {
  ERROR: 'ERROR',
  HIGH: 'HIGH',
  INFO: 'INFO',
} as const;
export type WarningSeverity =
  (typeof WARNING_SEVERITY)[keyof typeof WARNING_SEVERITY];
const SEVERITY_RANK: Record<WarningSeverity, number> = {
  ERROR: 0,
  HIGH: 1,
  INFO: 2,
};

export interface WarningItem extends CreditItem {
  id: string;
  courseId: string;
  courseCode: string;
  plannedSemester: number;
  trackId?: string | null;
  requisites: readonly {
    sourceCourseId: string;
    sourceCourseCode: string;
    relationType: CourseRelationType;
  }[];
}

export interface WarningGroup extends CreditGroup {
  groupCode: string;
}

export interface CurriculumWarning {
  code: CurriculumWarningCode;
  severity: WarningSeverity;
  message: string;
  semester: number | null;
  itemId: string | null;
  groupId: string | null;
}

export interface WarningInput {
  semesterCount: number;
  items: readonly WarningItem[];
  groups: readonly WarningGroup[];
}

// Structural rows from the curriculum read and from the checker's select both satisfy this.
export interface WarningItemRow {
  id: string;
  courseId: string;
  plannedSemester: number;
  isElective: boolean;
  electiveGroupId: string | null;
  trackId?: string | null;
  creditsSnapshot: Prisma.Decimal | null;
  course: { courseCode: string; credits: Prisma.Decimal };
  requisites: readonly {
    sourceCourseId: string;
    relationType: CourseRelationType;
    sourceCourse: { courseCode: string };
  }[];
}

export function toWarningItem(row: WarningItemRow): WarningItem {
  return {
    id: row.id,
    courseId: row.courseId,
    courseCode: row.course.courseCode,
    plannedSemester: row.plannedSemester,
    credits: rowCredits(row),
    isElective: row.isElective,
    electiveGroupId: row.electiveGroupId,
    trackId: row.trackId ?? null,
    requisites: row.requisites.map((requisite) => ({
      sourceCourseId: requisite.sourceCourseId,
      sourceCourseCode: requisite.sourceCourse.courseCode,
      relationType: requisite.relationType,
    })),
  };
}

export function sortWarnings(
  warnings: CurriculumWarning[],
): CurriculumWarning[] {
  return warnings.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      (a.semester ?? Number.MAX_SAFE_INTEGER) -
        (b.semester ?? Number.MAX_SAFE_INTEGER) ||
      a.message.localeCompare(b.message, 'vi'),
  );
}

// Only prior-study and prerequisite edges order courses in time; a corequisite may sit in the same or either semester.
const ORDER_SENSITIVE_TYPES: readonly CourseRelationType[] = [
  CourseRelationType.PRIOR,
  CourseRelationType.PREREQUISITE,
];

const REQUISITE_TYPE_LABEL: Record<CourseRelationType, string> = {
  PRIOR: 'học trước',
  PREREQUISITE: 'tiên quyết',
  COREQUISITE: 'song hành',
  REPLACEMENT: 'thay thế',
};

function warning(
  code: CurriculumWarningCode,
  severity: WarningSeverity,
  message: string,
  where: Partial<
    Pick<CurriculumWarning, 'semester' | 'itemId' | 'groupId'>
  > = {},
): CurriculumWarning {
  return {
    code,
    severity,
    message,
    semester: where.semester ?? null,
    itemId: where.itemId ?? null,
    groupId: where.groupId ?? null,
  };
}

function emptySemesters(
  semesterCount: number,
  items: readonly WarningItem[],
): CurriculumWarning[] {
  const found: CurriculumWarning[] = [];
  for (let semester = 1; semester <= semesterCount; semester += 1) {
    if (!items.some((item) => item.plannedSemester === semester)) {
      found.push(
        warning(
          CURRICULUM_WARNING.EMPTY_SEMESTER,
          WARNING_SEVERITY.INFO,
          `Học kỳ ${semester} chưa có học phần nào.`,
          { semester },
        ),
      );
    }
  }
  return found;
}

// A requisite in the same or a later semester is saved (EC-10) but flagged; one outside the curriculum is flagged too.
function requisiteWarnings(items: readonly WarningItem[]): CurriculumWarning[] {
  const found: CurriculumWarning[] = [];
  const byCourse = new Map(items.map((item) => [item.courseId, item]));
  for (const item of items) {
    for (const requisite of item.requisites) {
      const source = byCourse.get(requisite.sourceCourseId);
      const where = { semester: item.plannedSemester, itemId: item.id };
      if (!source) {
        found.push(
          warning(
            CURRICULUM_WARNING.REQUISITE_OUTSIDE,
            WARNING_SEVERITY.HIGH,
            `${item.courseCode} cần ${requisite.sourceCourseCode} (${REQUISITE_TYPE_LABEL[requisite.relationType]}), nhưng ${requisite.sourceCourseCode} không có trong khung.`,
            where,
          ),
        );
      } else if (
        ORDER_SENSITIVE_TYPES.includes(requisite.relationType) &&
        source.plannedSemester >= item.plannedSemester
      ) {
        found.push(
          warning(
            CURRICULUM_WARNING.REQUISITE_NOT_EARLIER,
            WARNING_SEVERITY.HIGH,
            `${item.courseCode} (học kỳ ${item.plannedSemester}) cần ${source.courseCode} trước, nhưng ${source.courseCode} xếp ở học kỳ ${source.plannedSemester}.`,
            where,
          ),
        );
      }
    }
  }
  return found;
}

// Same course may legitimately appear in two DIFFERENT tracks (e.g. compulsory in CNPM, elective in HTTT),
// but never twice inside the same track (or common core) nor in both common core and a track.
function duplicateCourses(items: readonly WarningItem[]): CurriculumWarning[] {
  const byCourse = new Map<string, WarningItem[]>();
  for (const item of items) {
    byCourse.set(item.courseId, [...(byCourse.get(item.courseId) ?? []), item]);
  }
  const found: CurriculumWarning[] = [];
  for (const allRows of byCourse.values()) {
    if (allRows.length < 2) continue;
    const byTrack = new Map<string | null, WarningItem[]>();
    for (const row of allRows) {
      const key = row.trackId ?? null;
      byTrack.set(key, [...(byTrack.get(key) ?? []), row]);
    }
    const commonRows = byTrack.get(null) ?? [];
    for (const [trackKey, rows] of byTrack) {
      if (rows.length >= 2) {
        const semesters = rows.map((row) => row.plannedSemester);
        found.push(
          warning(
            CURRICULUM_WARNING.DUPLICATE_COURSE,
            WARNING_SEVERITY.ERROR,
            `${rows[0].courseCode} xuất hiện ${rows.length} lần trong khung (học kỳ ${semesters.join(', ')}).`,
            { itemId: rows[1].id, semester: rows[1].plannedSemester },
          ),
        );
      } else if (trackKey !== null && commonRows.length > 0) {
        const semesters = [commonRows[0].plannedSemester, rows[0].plannedSemester];
        found.push(
          warning(
            CURRICULUM_WARNING.DUPLICATE_COURSE,
            WARNING_SEVERITY.ERROR,
            `${rows[0].courseCode} xuất hiện ở cả khung chung và định hướng (học kỳ ${semesters.join(', ')}).`,
            { itemId: rows[0].id, semester: rows[0].plannedSemester },
          ),
        );
      }
    }
  }
  return found;
}

function groupWarnings(
  items: readonly WarningItem[],
  groups: readonly WarningGroup[],
): CurriculumWarning[] {
  const found: CurriculumWarning[] = [];
  for (const item of items) {
    if (item.isElective && item.electiveGroupId === null) {
      found.push(
        warning(
          CURRICULUM_WARNING.ELECTIVE_WITHOUT_GROUP,
          WARNING_SEVERITY.HIGH,
          `${item.courseCode} là học phần tự chọn nhưng chưa thuộc nhóm nào nên không được tính vào tổng tín chỉ.`,
          { itemId: item.id, semester: item.plannedSemester },
        ),
      );
    }
  }
  for (const group of groups) {
    const members = items.filter((item) => item.electiveGroupId === group.id);
    const offered = members.reduce(
      (total, member) => total.plus(member.credits),
      new Prisma.Decimal(0),
    );
    const short =
      (group.minCredits !== null && offered.lessThan(group.minCredits)) ||
      (group.minCourses !== null && members.length < group.minCourses);
    if (!short) continue;
    const minimum = [
      group.minCredits !== null ? `${group.minCredits.toString()} tín chỉ` : '',
      group.minCourses !== null ? `${group.minCourses} học phần` : '',
    ]
      .filter(Boolean)
      .join(' và ');
    found.push(
      warning(
        CURRICULUM_WARNING.GROUP_MINIMUM_UNREACHABLE,
        WARNING_SEVERITY.ERROR,
        `Nhóm ${group.groupCode} yêu cầu tối thiểu ${minimum}, nhưng các học phần trong nhóm chỉ có ${offered.toString()} tín chỉ (${members.length} học phần).`,
        { groupId: group.id },
      ),
    );
  }
  return found;
}

export function curriculumWarnings({
  semesterCount,
  items,
  groups,
}: WarningInput): CurriculumWarning[] {
  return sortWarnings([
    ...emptySemesters(semesterCount, items),
    ...requisiteWarnings(items),
    ...duplicateCourses(items),
    ...groupWarnings(items, groups),
  ]);
}
