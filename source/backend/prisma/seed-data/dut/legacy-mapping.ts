import {
  CourseRelationType,
  CourseType,
  Prisma,
} from '../../../src/generated/prisma/client.js';
export const LEGACY_REQUISITE_TYPES: Readonly<
  Record<string, CourseRelationType>
> = {
  '0': CourseRelationType.PRIOR,
  '1': CourseRelationType.PREREQUISITE,
  '2': CourseRelationType.COREQUISITE,
};
export const REQUISITE_TYPE_STRENGTH: Readonly<
  Record<CourseRelationType, number>
> = { PREREQUISITE: 3, PRIOR: 2, COREQUISITE: 1, REPLACEMENT: 0 };
export const LEGACY_FLAG_ON = '1';
export const HOME_FACULTY_LEGACY_CODE = '102';
export const LEGACY_UNIT_CODE_PREFIX = 'DUT-';
export const UNASSIGNED_UNIT = {
  unitCode: 'DUT-UNASSIGNED',
  unitName: 'Chưa xác định khoa phụ trách',
} as const;
export const LEGACY_TERM_SUFFIX: Readonly<Record<string, number>> = {
  '10': 1,
  '20': 2,
  '21': 3,
};
export const LEGACY_CENTURY = 2000;
export interface LegacyCourseFlags {
  loaiHp: string;
  datn: string;
  lyThuyet: string;
  thucTap: string;
  doAn: string;
}
export function legacyDecimal(value: string): string {
  const normalized = value.trim().replace(',', '.') || '0';
  if (!/^\d+(?:\.\d+)?$/.test(normalized))
    throw new Error('Invalid legacy decimal');
  return new Prisma.Decimal(normalized).toString();
}
export function courseTypeFor(flags: LegacyCourseFlags): CourseType {
  if (flags.loaiHp === '1') return CourseType.CONDITIONAL;
  if (flags.loaiHp === '3') return CourseType.LAB;
  if (flags.datn === LEGACY_FLAG_ON) return CourseType.CAPSTONE;
  if (new Prisma.Decimal(legacyDecimal(flags.lyThuyet)).isZero()) {
    if (new Prisma.Decimal(legacyDecimal(flags.thucTap)).greaterThan(0))
      return CourseType.INTERNSHIP;
    if (new Prisma.Decimal(legacyDecimal(flags.doAn)).greaterThan(0))
      return CourseType.PROJECT;
  }
  return CourseType.THEORY;
}
export function requisiteTypeFor(loaiDk: string): CourseRelationType {
  const type = LEGACY_REQUISITE_TYPES[loaiDk];
  if (!type) throw new Error(`Unknown LoaiDK code: ${loaiDk}`);
  return type;
}
export function semesterFromLegacyCode(code: string): {
  semesterCode: string;
  academicYear: string;
  termInYear: number;
} {
  if (!/^\d{4}$/.test(code) || !LEGACY_TERM_SUFFIX[code.slice(2)])
    throw new Error(`Invalid semester code: ${code}`);
  const year = LEGACY_CENTURY + Number(code.slice(0, 2));
  const academicYear = `${year}-${year + 1}`;
  const termInYear = LEGACY_TERM_SUFFIX[code.slice(2)];
  return {
    semesterCode: `${academicYear}-${termInYear}`,
    academicYear,
    termInYear,
  };
}
export function cohortFromLegacyCode(code: string): {
  cohortCode: string;
  intakeYear: number;
} {
  semesterFromLegacyCode(code);
  const intakeYear = LEGACY_CENTURY + Number(code.slice(0, 2));
  return { cohortCode: `K${intakeYear}`, intakeYear };
}
export interface ElectiveMinimum {
  minCourses?: number;
  minCredits?: string;
}
export function parseElectiveNote(note: string): ElectiveMinimum | null {
  const courses = /ch[oọ]n\s*(\d+)\s*trong\s*(\d+)/i.exec(note);
  if (courses) return { minCourses: Number(courses[1]) };
  const credits = /ch[oọ]n\s*(\d+(?:[.,]\d+)?)\s*tc/i.exec(note);
  return credits ? { minCredits: legacyDecimal(credits[1]) } : null;
}
export function sortOrders(stts: readonly string[]): number[] {
  const indices = stts.map((value, index) => ({ value: Number(value), index }));
  if (indices.some((entry) => !Number.isFinite(entry.value)))
    throw new Error('Invalid STT');
  const ranks: number[] = [];
  indices
    .sort((left, right) => left.value - right.value || left.index - right.index)
    .forEach((entry, index) => {
      ranks[entry.index] = index + 1;
    });
  return ranks;
}
export function pickRelationType(
  counts: ReadonlyMap<CourseRelationType, number>,
): CourseRelationType {
  const candidates = [...counts].sort(
    ([left, leftCount], [right, rightCount]) =>
      rightCount - leftCount ||
      REQUISITE_TYPE_STRENGTH[right] - REQUISITE_TYPE_STRENGTH[left],
  );
  if (!candidates.length) throw new Error('No relation types to choose');
  return candidates[0][0];
}
export type ReleasedStatus = 'ACTIVE' | 'HISTORICAL' | 'PENDING';
export function releasedStatuses(
  starts: readonly Date[],
  today: Date,
): ReleasedStatus[] {
  if (
    !Number.isFinite(today.getTime()) ||
    starts.some(
      (start, index) =>
        !Number.isFinite(start.getTime()) ||
        (index > 0 && start < starts[index - 1]),
    )
  )
    throw new Error('Release dates must be valid and ascending');
  const activeIndex = starts.findLastIndex((start) => start <= today);
  return starts.map((_, index) =>
    index < activeIndex
      ? 'HISTORICAL'
      : index === activeIndex
        ? 'ACTIVE'
        : 'PENDING',
  );
}
