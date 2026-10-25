import {
  Prisma,
  type CourseRelationType,
  type DegreeLevel,
} from '../../../../src/generated/prisma/client.js';
import {
  cohortFromLegacyCode,
  LEGACY_FLAG_ON,
  legacyDecimal,
  parseElectiveNote,
  requisiteTypeFor,
  semesterFromLegacyCode,
  sortOrders,
} from '../legacy-mapping.js';
import type { LegacyRow } from './legacy-tables.js';
import { DUT_PROGRAMS, LEGACY_MAJOR_HEADER } from './program-map.js';
export interface DutGroup {
  groupCode: string;
  groupName: string;
  minCourses: number | null;
  minCredits: string | null;
}
export interface DutItem {
  courseCode: string;
  plannedSemester: number;
  sortOrder: number;
  isElective: boolean;
  groupCode: string | null;
  htDa: boolean;
  tqDa: boolean;
  note: string | null;
}
export interface DutRequisite {
  targetCourseCode: string;
  sourceCourseCode: string;
  relationType: CourseRelationType;
}
export interface DutVersion {
  frameCode: string;
  programName: string;
  majorCode: string;
  majorName: string;
  semesterCount: number;
  totalCredits: string;
  compulsoryCredits: string;
  electiveCredits: string;
  startSemesterCode: string | null;
  cohortCode: string | null;
  groups: DutGroup[];
  items: DutItem[];
  requisites: DutRequisite[];
}
export interface DutProgram {
  programCode: string;
  degreeLevel: DegreeLevel;
  versions: DutVersion[];
}
export interface FrameReport {
  frameCode: string;
  rowsSkippedMissingCourse: number;
  requisitesSkippedTargetOutside: number;
  requisitesSourceOutside: number;
  electiveRowsWithoutGroup: number;
  groupsCountMismatch: number;
  declaredCompulsory: string;
  summedCompulsory: string;
}
export function extractFrames(input: {
  majors: Map<string, LegacyRow>;
  frameRows: Map<string, LegacyRow>;
  requisites: Map<string, LegacyRow>;
  catalogCodes: ReadonlySet<string>;
  courseCredits: ReadonlyMap<string, string>;
}): { programs: DutProgram[]; reports: FrameReport[] } {
  const header = input.majors.get(LEGACY_MAJOR_HEADER);
  if (!header) throw new Error(`Missing major header: ${LEGACY_MAJOR_HEADER}`);
  const reports: FrameReport[] = [];
  const programs = [...DUT_PROGRAMS]
    .sort((left, right) => left.programCode.localeCompare(right.programCode))
    .map((definition) => {
      const versions = definition.frames
        .map((frameCode) => {
          const major = input.majors.get(frameCode);
          if (!major) throw new Error(`Missing mapped frame: ${frameCode}`);
          const totalCredits = legacyDecimal(major.SoTinChi);
          const electiveCredits = legacyDecimal(major.Sotuchon);
          const compulsoryCredits = new Prisma.Decimal(totalCredits)
            .minus(electiveCredits)
            .toString();
          if (new Prisma.Decimal(compulsoryCredits).isNegative())
            throw new Error(`Negative compulsory credits: ${frameCode}`);
          const semesterCount = Number(major.SoHK);
          if (!Number.isInteger(semesterCount) || semesterCount < 1)
            throw new Error(`Invalid SoHK: ${frameCode}`);
          const version: DutVersion = {
            frameCode,
            programName: major.TenNganh,
            majorCode: major.Kyhieu,
            majorName: header.TenNganh,
            semesterCount,
            totalCredits,
            compulsoryCredits,
            electiveCredits,
            startSemesterCode: major.KyBDau
              ? semesterFromLegacyCode(major.KyBDau).semesterCode
              : null,
            cohortCode:
              major.KyBDau && major.InUse === LEGACY_FLAG_ON
                ? cohortFromLegacyCode(major.KyBDau).cohortCode
                : null,
            groups: [],
            items: [],
            requisites: [],
          };
          const report: FrameReport = {
            frameCode,
            rowsSkippedMissingCourse: 0,
            requisitesSkippedTargetOutside: 0,
            requisitesSourceOutside: 0,
            electiveRowsWithoutGroup: 0,
            groupsCountMismatch: 0,
            declaredCompulsory: compulsoryCredits,
            summedCompulsory: '0',
          };
          const allRows = [...input.frameRows.values()].filter(
            (row) => row.MaKhung === frameCode,
          );
          const stts = new Set<string>();
          for (const row of allRows) {
            const semester = Number(row.Hocky);
            if (
              !Number.isInteger(semester) ||
              semester < 1 ||
              semester > semesterCount
            )
              throw new Error(`Hocky outside SoHK: ${frameCode}`);
            const stt = String(Number(row.STT));
            if (stts.has(stt))
              throw new Error(`Duplicate STT in frame: ${frameCode}`);
            stts.add(stt);
          }
          const rows = allRows.filter((row) =>
            input.catalogCodes.has(row.MaHP),
          );
          report.rowsSkippedMissingCourse = allRows.length - rows.length;
          rows.sort(
            (left, right) =>
              Number(left.Hocky) - Number(right.Hocky) ||
              Number(left.STT) - Number(right.STT) ||
              left.MaHP.localeCompare(right.MaHP),
          );
          const groups = new Map<
            string,
            { group: DutGroup; rows: number; expected: number | null }
          >();
          for (let semester = 1; semester <= semesterCount; semester++) {
            const semesterRows = rows.filter(
              (row) => Number(row.Hocky) === semester,
            );
            const orders = sortOrders(semesterRows.map((row) => row.STT));
            let ordinal = 0;
            semesterRows.forEach((row, index) => {
              const note = row.Note.trim() || null;
              const isElective = row.Tuchon === LEGACY_FLAG_ON;
              let groupCode: string | null = null;
              if (isElective) {
                const minimum = parseElectiveNote(note ?? '');
                if (minimum) {
                  const key = `${semester}:${note!.toLowerCase()}`;
                  let entry = groups.get(key);
                  if (!entry) {
                    const group: DutGroup = {
                      groupCode: `HK${semester}-${++ordinal}`,
                      groupName: note!,
                      minCourses: minimum.minCourses ?? null,
                      minCredits: minimum.minCredits ?? null,
                    };
                    const match = /ch[oọ]n\s*\d+\s*trong\s*(\d+)/i.exec(note!);
                    entry = {
                      group,
                      rows: 0,
                      expected: match ? Number(match[1]) : null,
                    };
                    groups.set(key, entry);
                    version.groups.push(group);
                  }
                  entry.rows++;
                  groupCode = entry.group.groupCode;
                } else report.electiveRowsWithoutGroup++;
              }
              version.items.push({
                courseCode: row.MaHP,
                plannedSemester: semester,
                sortOrder: orders[index],
                isElective,
                groupCode,
                htDa: row.HTDA === LEGACY_FLAG_ON,
                tqDa: row.TQDA === LEGACY_FLAG_ON,
                note,
              });
            });
          }
          report.groupsCountMismatch = [...groups.values()].filter(
            (entry) => entry.expected !== null && entry.expected !== entry.rows,
          ).length;
          const targetCodes = new Set(
            version.items.map((item) => item.courseCode),
          );
          const seen = new Set<string>();
          for (const row of input.requisites.values()) {
            if (row.MaKhung !== frameCode) continue;
            if (!targetCodes.has(row.MaHP)) {
              report.requisitesSkippedTargetOutside++;
              continue;
            }
            if (!input.catalogCodes.has(row.MaHPdk)) continue;
            if (row.MaHP === row.MaHPdk)
              throw new Error(`Self requisite in frame: ${frameCode}`);
            const relationType = requisiteTypeFor(row.LoaiDK);
            const key = `${row.MaHP}:${row.MaHPdk}:${relationType}`;
            if (seen.has(key)) continue;
            seen.add(key);
            if (!targetCodes.has(row.MaHPdk)) report.requisitesSourceOutside++;
            version.requisites.push({
              targetCourseCode: row.MaHP,
              sourceCourseCode: row.MaHPdk,
              relationType,
            });
          }
          version.requisites.sort(
            (left, right) =>
              left.targetCourseCode.localeCompare(right.targetCourseCode) ||
              left.sourceCourseCode.localeCompare(right.sourceCourseCode) ||
              left.relationType.localeCompare(right.relationType),
          );
          report.summedCompulsory = version.items
            .filter((item) => !item.isElective)
            .reduce((sum, item) => {
              const credits = input.courseCredits.get(item.courseCode);
              if (credits === undefined)
                throw new Error(`Missing course credits: ${item.courseCode}`);
              return sum.plus(credits);
            }, new Prisma.Decimal(0))
            .toString();
          reports.push(report);
          return version;
        })
        .sort(
          (left, right) =>
            (left.startSemesterCode ?? '').localeCompare(
              right.startSemesterCode ?? '',
            ) || left.frameCode.localeCompare(right.frameCode),
        );
      const drafts = versions.filter((version) => !version.startSemesterCode);
      if (
        drafts.length > 1 ||
        (drafts.length && drafts.length !== versions.length)
      )
        throw new Error(
          `Invalid draft/released combination: ${definition.programCode}`,
        );
      return {
        programCode: definition.programCode,
        degreeLevel: definition.degreeLevel,
        versions,
      };
    });
  reports.sort((left, right) => left.frameCode.localeCompare(right.frameCode));
  return { programs, reports };
}
