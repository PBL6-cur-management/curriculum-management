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
// tmDonVi.MaBP = 100 marks an office (phòng/ban); other units teach (khoa, trung tâm, viện).
export const LEGACY_OFFICE_GROUP = '100';
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
// "Chọn 2 trong 4" / "Chọn 1/3" → choose k of n courses; "Chọn 6 TC" / "chọn 3 tín chỉ" → at least that many credits.
export const ELECTIVE_COUNT_NOTE = /ch[oọ]n\s*(\d+)\s*(?:trong|\/)\s*(\d+)/i;
export const ELECTIVE_CREDIT_NOTE = /ch[oọ]n\s*(\d+(?:[.,]\d+)?)\s*t[cí]/i;
export interface ElectiveNote extends ElectiveMinimum {
  // Size of the k-of-n list, when the note states it.
  listSize?: number;
}
export function parseElectiveNote(note: string): ElectiveNote | null {
  const courses = ELECTIVE_COUNT_NOTE.exec(note);
  if (courses)
    return { minCourses: Number(courses[1]), listSize: Number(courses[2]) };
  const credits = ELECTIVE_CREDIT_NOTE.exec(note);
  return credits ? { minCredits: legacyDecimal(credits[1]) } : null;
}

// The course's owning unit: tmHocPhan.KhoaPC, else the unit prefix of its code (the first three digits are a
// tmDonVi.MaDV for every course the school numbers).
export function ownerUnitLegacyCode(course: { MaHP: string; KhoaPC: string }): {
  code: string;
  inferred: boolean;
} {
  if (course.KhoaPC) return { code: course.KhoaPC, inferred: false };
  return { code: course.MaHP.slice(0, 3), inferred: true };
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
function mondayOnOrAfter(year: number, month: number, day: number): Date {
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + ((8 - date.getUTCDay()) % 7));
  return date;
}
// A term the school calendar gives no date for gets a convention date, flagged as an estimate:
// term 1 → first Monday on/after 1 August; term 2 → first Monday on/after 1 January of the next year;
// summer → second Monday of June of the next year (every official summer 2014–2020 started on it).
export function estimateSemesterStart(code: string): string {
  const { termInYear } = semesterFromLegacyCode(code);
  const year = LEGACY_CENTURY + Number(code.slice(0, 2));
  if (termInYear === 1) return isoDay(mondayOnOrAfter(year, 8, 1));
  if (termInYear === 2) return isoDay(mondayOnOrAfter(year + 1, 1, 1));
  const secondMonday = mondayOnOrAfter(year + 1, 6, 1);
  secondMonday.setUTCDate(secondMonday.getUTCDate() + 7);
  return isoDay(secondMonday);
}

const TERM_ORDER = ['10', '20', '21'] as const;
// The term after a legacy code: 10 → 20 → 21 → next year's 10.
export function nextTermCode(code: string): string {
  semesterFromLegacyCode(code);
  const year = code.slice(0, 2);
  const at = TERM_ORDER.indexOf(code.slice(2) as (typeof TERM_ORDER)[number]);
  if (at < TERM_ORDER.length - 1) return `${year}${TERM_ORDER[at + 1]}`;
  return `${String(Number(year) + 1).padStart(2, '0')}${TERM_ORDER[0]}`;
}

// The newest intake has no IDCodeVao yet: digits 4–5 of the student code are the intake year.
export const admissionTermFromStudentCode = (studentCode: string) =>
  `${studentCode.slice(3, 5)}10`;
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
