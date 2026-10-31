import {
  Prisma,
  type CourseRelationType,
  type DegreeLevel,
} from '../../../../src/generated/prisma/client.js';
import {
  cohortFromLegacyCode,
  LEGACY_FLAG_ON,
  legacyDecimal,
  requisiteTypeFor,
  semesterFromLegacyCode,
  sortOrders,
} from '../legacy-mapping.js';
import { buildElectiveLayout, isElectiveFlag } from './elective-groups.js';
import type { MIRROR_TABLES, MirrorRow } from './mirror-tables.js';
import { groupFramesIntoPrograms } from './program-map.js';

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
  programCode: string;
  programName: string;
  students: number;
  rowsSkippedMissingCourse: number;
  requisitesSkippedTargetOutside: number;
  requisitesSourceOutside: number;
  // tmHocphanDK.Hoac = 1: an "either" requisite; the SRS has no OR branch, so it is kept as a plain requisite.
  requisitesMarkedEither: number;
  requisitesSelfSkipped: number;
  electiveRowsWithoutGroup: number;
  groupsCountMismatch: number;
  directionRowsMadeElective: number;
  declaredCompulsory: string;
  declaredElective: string;
  seededCompulsory: string;
  requiredCredits: string;
  totalCredits: string;
  balanced: boolean;
}

type MajorRow = MirrorRow<typeof MIRROR_TABLES.MAJORS>;
type FrameRow = MirrorRow<typeof MIRROR_TABLES.FRAME_ROWS>;
type BudgetRow = MirrorRow<typeof MIRROR_TABLES.FRAME_SEMESTER_CREDITS>;
type RequisiteRow = MirrorRow<typeof MIRROR_TABLES.REQUISITES>;

const groupBy = <Row>(rows: readonly Row[], key: (row: Row) => string) => {
  const map = new Map<string, Row[]>();
  for (const row of rows) {
    const list = map.get(key(row)) ?? [];
    list.push(row);
    map.set(key(row), list);
  }
  return map;
};

function extractVersion(
  major: MajorRow,
  input: {
    frameRows: readonly FrameRow[];
    budgets: readonly BudgetRow[];
    requisites: readonly RequisiteRow[];
    catalogCodes: ReadonlySet<string>;
    courseCredits: ReadonlyMap<string, string>;
    majorName: string;
    programCode: string;
    students: number;
  },
): { version: DutVersion; report: FrameReport } {
  const frameCode = major.MaNganh;
  const totalCredits = legacyDecimal(major.SoTinChi);
  const declaredElective = legacyDecimal(major.Sotuchon);
  const declaredCompulsory = new Prisma.Decimal(totalCredits)
    .minus(declaredElective)
    .toString();
  if (new Prisma.Decimal(declaredCompulsory).isNegative())
    throw new Error(`Negative compulsory credits: ${frameCode}`);
  const semesterCount = Number(major.SoHK);
  if (!Number.isInteger(semesterCount) || semesterCount < 1)
    throw new Error(`Invalid SoHK: ${frameCode}`);
  // Older frames repeat STT values; sortOrders breaks ties by row order, so they are not an error.
  for (const row of input.frameRows) {
    const semester = Number(row.Hocky);
    if (!Number.isInteger(semester) || semester < 1 || semester > semesterCount)
      throw new Error(`Hocky outside SoHK: ${frameCode}`);
  }
  const rows = input.frameRows
    .filter((row) => input.catalogCodes.has(row.MaHP))
    .sort(
      (left, right) =>
        Number(left.Hocky) - Number(right.Hocky) ||
        Number(left.STT) - Number(right.STT) ||
        left.MaHP.localeCompare(right.MaHP),
    );
  const layout = buildElectiveLayout({
    rows: rows.map((row) => ({
      key: row.MaHP,
      semester: Number(row.Hocky),
      courseCode: row.MaHP,
      isElective: isElectiveFlag(row.Tuchon),
      note: row.Note,
    })),
    credits: input.courseCredits,
    semesterBudgets: new Map(
      input.budgets.map((row) => [Number(row.Hocky), legacyDecimal(row.SoTC)]),
    ),
    totalCredits,
    declaredElectiveCredits: declaredElective,
  });
  const version: DutVersion = {
    frameCode,
    programName: major.TenNganh,
    majorCode: major.Kyhieu,
    majorName: input.majorName,
    semesterCount,
    totalCredits,
    compulsoryCredits: layout.compulsoryCredits,
    electiveCredits: layout.electiveCredits,
    startSemesterCode: major.KyBDau
      ? semesterFromLegacyCode(major.KyBDau).semesterCode
      : null,
    cohortCode:
      major.KyBDau && major.InUse === LEGACY_FLAG_ON
        ? cohortFromLegacyCode(major.KyBDau).cohortCode
        : null,
    groups: layout.groups,
    items: [],
    requisites: [],
  };
  for (let semester = 1; semester <= semesterCount; semester++) {
    const semesterRows = rows.filter((row) => Number(row.Hocky) === semester);
    const orders = sortOrders(semesterRows.map((row) => row.STT));
    semesterRows.forEach((row, index) => {
      const groupCode = layout.groupOf.get(row.MaHP) ?? null;
      version.items.push({
        courseCode: row.MaHP,
        plannedSemester: semester,
        sortOrder: orders[index],
        isElective: groupCode !== null,
        groupCode,
        htDa: row.HTDA === LEGACY_FLAG_ON,
        tqDa: row.TQDA === LEGACY_FLAG_ON,
        note: row.Note || null,
      });
    });
  }
  const report: FrameReport = {
    frameCode,
    programCode: input.programCode,
    programName: major.TenNganh,
    students: input.students,
    rowsSkippedMissingCourse: input.frameRows.length - rows.length,
    requisitesSkippedTargetOutside: 0,
    requisitesSourceOutside: 0,
    requisitesMarkedEither: 0,
    requisitesSelfSkipped: 0,
    electiveRowsWithoutGroup: version.items.filter(
      (item) => item.isElective && !item.groupCode,
    ).length,
    groupsCountMismatch: layout.listSizeMismatches,
    directionRowsMadeElective: layout.reclassifiedRows,
    declaredCompulsory,
    declaredElective,
    seededCompulsory: layout.compulsoryCredits,
    requiredCredits: layout.requiredCredits,
    totalCredits,
    balanced: layout.balanced,
  };
  const targetCodes = new Set(version.items.map((item) => item.courseCode));
  const seen = new Set<string>();
  for (const row of input.requisites) {
    if (!targetCodes.has(row.MaHP)) {
      report.requisitesSkippedTargetOutside++;
      continue;
    }
    if (!input.catalogCodes.has(row.MaHPdk)) continue;
    // A few school rows name the course as its own requisite: meaningless, so skipped and counted.
    if (row.MaHP === row.MaHPdk) {
      report.requisitesSelfSkipped++;
      continue;
    }
    const relationType = requisiteTypeFor(row.LoaiDK);
    const key = `${row.MaHP}:${row.MaHPdk}:${relationType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (row.Hoac === LEGACY_FLAG_ON) report.requisitesMarkedEither++;
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
  return { version, report };
}

export function extractFrames(input: {
  majors: readonly MajorRow[];
  frameRows: readonly FrameRow[];
  budgets: readonly BudgetRow[];
  requisites: readonly RequisiteRow[];
  catalogCodes: ReadonlySet<string>;
  courseCredits: ReadonlyMap<string, string>;
  majorNames: ReadonlyMap<string, string>;
  studentsByFrame: ReadonlyMap<string, number>;
}): { programs: DutProgram[]; reports: FrameReport[] } {
  const majors = new Map(input.majors.map((row) => [row.MaNganh, row]));
  const frameRows = groupBy(input.frameRows, (row) => row.MaKhung);
  const budgets = groupBy(input.budgets, (row) => row.MaKhung);
  const requisites = groupBy(input.requisites, (row) => row.MaKhung);
  const reports: FrameReport[] = [];
  const programs = groupFramesIntoPrograms(input.majors).map((definition) => {
    const versions = definition.frames
      .map((frameCode) => {
        const major = majors.get(frameCode)!;
        const majorName = input.majorNames.get(major.Kyhieu.slice(0, 7));
        if (!majorName)
          throw new Error(`No national major name for ${major.Kyhieu}`);
        const { version, report } = extractVersion(major, {
          frameRows: frameRows.get(frameCode) ?? [],
          budgets: budgets.get(frameCode) ?? [],
          requisites: requisites.get(frameCode) ?? [],
          catalogCodes: input.catalogCodes,
          courseCredits: input.courseCredits,
          majorName,
          programCode: definition.programCode,
          students: input.studentsByFrame.get(frameCode) ?? 0,
        });
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
