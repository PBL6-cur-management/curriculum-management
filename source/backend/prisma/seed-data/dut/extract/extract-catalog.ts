import {
  OrgUnitType,
  type CourseType,
} from '../../../../src/generated/prisma/client.js';
import { HOME_FACULTY_CODE } from '../../../../src/shared/org-units/home-faculty.js';
import { fromIsoDay, toIsoDay } from '../../../../src/shared/time/today.js';
import {
  cohortFromLegacyCode,
  courseTypeFor,
  estimateSemesterStart,
  HOME_FACULTY_LEGACY_CODE,
  LEGACY_OFFICE_GROUP,
  LEGACY_UNIT_CODE_PREFIX,
  legacyDecimal,
  ownerUnitLegacyCode,
  semesterFromLegacyCode,
} from '../legacy-mapping.js';
import type { MIRROR_TABLES, MirrorRow } from './mirror-tables.js';

export interface DutUnit {
  unitCode: string;
  unitName: string;
  unitType: OrgUnitType;
}
export interface DutCourse {
  courseCode: string;
  courseName: string;
  englishName: string | null;
  credits: string;
  courseType: CourseType;
  ownerUnitCode: string;
}
export interface DutSemester {
  semesterCode: string;
  academicYear: string;
  termInYear: number;
  startDate: string;
  // No official date in the school calendar: the date follows the convention in estimateSemesterStart.
  startDateEstimated: boolean;
  legacyCode: string;
}
export interface DutCohort {
  cohortCode: string;
  intakeYear: number;
}
export interface CatalogExtract {
  units: DutUnit[];
  courses: DutCourse[];
  semesters: DutSemester[];
  cohorts: DutCohort[];
  missingCourseCodes: string[];
  ownersInferredFromCode: number;
  estimatedSemesters: string[];
}

type CourseRow = MirrorRow<typeof MIRROR_TABLES.COURSES>;
type UnitRow = MirrorRow<typeof MIRROR_TABLES.UNITS>;
type TermRow = MirrorRow<typeof MIRROR_TABLES.TERMS>;

// tmKehoach.NgayDau is a calendar day ("2026-08-10", or an ISO timestamp at midnight).
export function officialStartDates(
  terms: readonly TermRow[],
): Map<string, string> {
  const dates = new Map<string, string>();
  for (const row of terms) {
    if (!row.NgayDau) continue;
    const day = row.NgayDau.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || toIsoDay(fromIsoDay(day)) !== day)
      throw new Error(`Invalid start date for term code: ${row.IDCode}`);
    dates.set(row.IDCode, day);
  }
  return dates;
}

export function extractCatalog(input: {
  courses: readonly CourseRow[];
  units: readonly UnitRow[];
  terms: readonly TermRow[];
  usedCourseCodes: ReadonlySet<string>;
  termCodes: ReadonlySet<string>;
  cohortTermCodes: ReadonlySet<string>;
}): CatalogExtract {
  const result: CatalogExtract = {
    units: [],
    courses: [],
    semesters: [],
    cohorts: [],
    missingCourseCodes: [],
    ownersInferredFromCode: 0,
    estimatedSemesters: [],
  };
  const courses = new Map(input.courses.map((row) => [row.MaHP, row]));
  const unitRows = new Map(input.units.map((row) => [row.MaDV, row]));
  const units = new Map<string, DutUnit>();
  for (const code of [...input.usedCourseCodes].sort()) {
    const row = courses.get(code);
    if (!row) {
      result.missingCourseCodes.push(code);
      continue;
    }
    const owner = ownerUnitLegacyCode(row);
    if (owner.inferred) result.ownersInferredFromCode++;
    let ownerUnitCode: string = HOME_FACULTY_CODE;
    if (owner.code !== HOME_FACULTY_LEGACY_CODE) {
      const unit = unitRows.get(owner.code);
      if (!unit)
        throw new Error(`Unknown owning unit ${owner.code} for course ${code}`);
      ownerUnitCode = `${LEGACY_UNIT_CODE_PREFIX}${owner.code}`;
      units.set(ownerUnitCode, {
        unitCode: ownerUnitCode,
        unitName: unit.TenDV,
        unitType:
          unit.MaBP === LEGACY_OFFICE_GROUP
            ? OrgUnitType.OFFICE
            : OrgUnitType.FACULTY,
      });
    }
    result.courses.push({
      courseCode: code,
      courseName: row.TenHP,
      englishName: row.TenHP1 || null,
      credits: legacyDecimal(row.SoTC),
      courseType: courseTypeFor({
        loaiHp: row.LoaiHP,
        datn: row.DATN,
        lyThuyet: row.LyThuyet,
        thucTap: row.ThucTap,
        doAn: row.DoAn,
      }),
      ownerUnitCode,
    });
  }
  result.units = [...units.values()].sort((left, right) =>
    left.unitCode.localeCompare(right.unitCode),
  );

  const official = officialStartDates(input.terms);
  for (const code of [...input.termCodes].sort()) {
    const day = official.get(code);
    result.semesters.push({
      ...semesterFromLegacyCode(code),
      startDate: day ?? estimateSemesterStart(code),
      startDateEstimated: !day,
      legacyCode: code,
    });
    if (!day) result.estimatedSemesters.push(code);
  }
  result.semesters.sort((left, right) =>
    left.semesterCode.localeCompare(right.semesterCode),
  );
  const cohorts = new Map<string, DutCohort>();
  for (const code of input.cohortTermCodes) {
    const cohort = cohortFromLegacyCode(code);
    cohorts.set(cohort.cohortCode, cohort);
  }
  result.cohorts = [...cohorts.values()].sort((left, right) =>
    left.cohortCode.localeCompare(right.cohortCode),
  );
  return result;
}
