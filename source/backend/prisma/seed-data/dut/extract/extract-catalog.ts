import type { CourseType } from '../../../../src/generated/prisma/client.js';
import { HOME_FACULTY_CODE } from '../../../../src/shared/org-units/home-faculty.js';
import { fromIsoDay, toIsoDay } from '../../../../src/shared/time/today.js';
import {
  cohortFromLegacyCode,
  courseTypeFor,
  HOME_FACULTY_LEGACY_CODE,
  legacyDecimal,
  LEGACY_UNIT_CODE_PREFIX,
  semesterFromLegacyCode,
  UNASSIGNED_UNIT,
} from '../legacy-mapping.js';
import type { LegacyRow } from './legacy-tables.js';
export interface DutUnit {
  unitCode: string;
  unitName: string;
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
  snapshotConflicts: Record<
    'TenHP' | 'TenHP1' | 'SoTC' | 'KhoaPC' | 'LoaiHP',
    number
  >;
}
export function extractCatalog(input: {
  courses: Map<string, LegacyRow>;
  units: Map<string, LegacyRow>;
  terms: Map<string, LegacyRow>;
  usedCourseCodes: ReadonlySet<string>;
  startTermCodes: ReadonlySet<string>;
}): CatalogExtract {
  const result: CatalogExtract = {
    units: [],
    courses: [],
    semesters: [],
    cohorts: [],
    missingCourseCodes: [],
    snapshotConflicts: { TenHP: 0, TenHP1: 0, SoTC: 0, KhoaPC: 0, LoaiHP: 0 },
  };
  const units = new Map<string, DutUnit>();
  for (const code of [...input.usedCourseCodes].sort()) {
    const row = input.courses.get(code);
    if (!row) {
      result.missingCourseCodes.push(code);
      continue;
    }
    const owner = row.KhoaPC;
    let ownerUnitCode: string;
    if (owner === HOME_FACULTY_LEGACY_CODE) ownerUnitCode = HOME_FACULTY_CODE;
    else if (!owner) {
      ownerUnitCode = UNASSIGNED_UNIT.unitCode;
      units.set(ownerUnitCode, { ...UNASSIGNED_UNIT });
    } else {
      const unit = input.units.get(owner);
      if (!unit) throw new Error(`Unknown KhoaPC code: ${owner}`);
      ownerUnitCode = `${LEGACY_UNIT_CODE_PREFIX}${owner}`;
      units.set(ownerUnitCode, {
        unitCode: ownerUnitCode,
        unitName: unit.TenDV,
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
  const cohorts = new Map<string, DutCohort>();
  for (const code of [...input.startTermCodes].sort()) {
    const row = input.terms.get(code);
    if (!row?.NgayDau)
      throw new Error(`Missing start date for term code: ${code}`);
    const day = row.NgayDau.slice(0, 10);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !Number.isFinite(fromIsoDay(day).getTime()) ||
      toIsoDay(fromIsoDay(day)) !== day
    )
      throw new Error(`Invalid start date for term code: ${code}`);
    result.semesters.push({ ...semesterFromLegacyCode(code), startDate: day });
    const cohort = cohortFromLegacyCode(code);
    cohorts.set(cohort.cohortCode, cohort);
  }
  result.semesters.sort((left, right) =>
    left.semesterCode.localeCompare(right.semesterCode),
  );
  result.cohorts = [...cohorts.values()].sort((left, right) =>
    left.cohortCode.localeCompare(right.cohortCode),
  );
  return result;
}
