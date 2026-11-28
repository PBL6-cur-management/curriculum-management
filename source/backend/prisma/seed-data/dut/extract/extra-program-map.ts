import {
  DegreeLevel,
  Prisma,
} from '../../../../src/generated/prisma/client.js';
import { HOME_FACULTY_CODE } from '../../../../src/shared/org-units/home-faculty.js';
import { LEGACY_FLAG_ON, legacyDecimal } from '../legacy-mapping.js';
import type {
  DutGroup,
  DutItem,
  DutRequisite,
  DutVersion,
} from './extract-frames.js';
import {
  degreeLevelFor,
  DOCTORATE_LEVEL,
  FRAME_CODE,
  MASTER_LEVEL,
  UNDERGRADUATE_LEVEL,
  type FrameMajor,
} from './program-map.js';

export const EXTRA_FACULTY_CODES = {
  DTVT: 'DUT-106',
  KTR: 'DUT-121',
  CNTT: HOME_FACULTY_CODE,
} as const;

export type ExtraFacultyCode =
  (typeof EXTRA_FACULTY_CODES)[keyof typeof EXTRA_FACULTY_CODES];

export interface ExtraFrameAssignment {
  frameCode: string;
  programCode: string;
  facultyUnitCode: ExtraFacultyCode;
  degreeLevel: DegreeLevel;
  startSemesterCode: string | null;
}

export interface ExtraProgramGroup {
  programCode: string;
  facultyUnitCode: ExtraFacultyCode;
  degreeLevel: DegreeLevel;
  frames: ExtraFrameAssignment[];
}

export interface TrackShowcaseTrack {
  trackCode: string;
  trackName: string;
  englishName: string;
  description: string;
  sortOrder: number;
  compulsoryCredits: string;
  electiveCredits: string;
  groups: DutGroup[];
  items: DutItem[];
  requisites: DutRequisite[];
}

export interface TrackShowcaseProgram {
  programCode: string;
  programName: string;
  facultyUnitCode: string;
  majorCode: string;
  majorName: string;
  degreeLevel: DegreeLevel;
  semesterCount: number;
  totalCredits: string;
  compulsoryCredits: string;
  electiveCredits: string;
  startSemesterCode: string;
  cohortCode: string;
  commonGroups: DutGroup[];
  commonItems: DutItem[];
  commonRequisites: DutRequisite[];
  tracks: TrackShowcaseTrack[];
}

const UNDERGRAD_MIN_START = 2010;
const NEW_ERA_FROM = 2610;
const GRADUATE_MIN_ROWS = 10;
const NOUSE_PATTERN = /nouse/i;

const normalized = (value: string) =>
  value
    .normalize('NFC')
    .replaceAll('Ð', 'Đ')
    .replaceAll('ð', 'đ')
    .toLowerCase();

const tokens = (value: string) =>
  value
    .normalize('NFC')
    .replaceAll('Ð', 'Đ')
    .replaceAll('ð', 'đ')
    .toUpperCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

// Infer a chronological semester code (YY10 or YY20) from a graduate cohort label like "(K44_NC)" -> "2210".
// Even cohorts map to term 10, odd cohorts map to term 20: K44->2210, K46->2310, K48->2410, K49->2420, K50->2510, K51->2520, K52->2610.
export function inferGraduateSemesterCode(frameName: string): string | null {
  const match = /(?:^|[^\p{L}\p{N}])K(\d{2})(?:$|[^\p{N}])/iu.exec(frameName);
  if (!match) return null;
  const cohortNum = Number(match[1]);
  if (!Number.isInteger(cohortNum) || cohortNum < 20 || cohortNum > 99)
    return null;
  const yy = String(Math.floor(cohortNum / 2)).padStart(2, '0');
  const term = cohortNum % 2 === 0 ? '10' : '20';
  return `${yy}${term}`;
}

function graduateTrackSuffix(frameName: string): 'NC' | 'UD' {
  const name = normalized(frameName);
  const toks = tokens(frameName);
  if (
    toks.includes('ƯD') ||
    toks.includes('UD') ||
    name.includes('ứng dụng')
  ) {
    return 'UD';
  }
  return 'NC';
}

export function classifyExtraFrame(
  major: FrameMajor & { InUse: string },
  rowCount: number,
): ExtraFrameAssignment | null {
  const code = major.MaNganh;
  if (!FRAME_CODE.test(code)) return null;
  if (rowCount === 0 || NOUSE_PATTERN.test(major.TenNganh)) return null;

  const startNum = major.KyBDau ? Number(major.KyBDau) : 0;
  const name = normalized(major.TenNganh);
  const toks = tokens(major.TenNganh);
  const symbol = major.Kyhieu.toUpperCase();
  const degree = degreeLevelFor(major);

  // 1a. Điện tử Viễn thông đại học: 1064xxx (CD01, KyBDau >= 2010)
  if (code.startsWith('1064')) {
    if (major.CapDT !== UNDERGRADUATE_LEVEL || startNum < UNDERGRAD_MIN_START)
      return null;
    let programCode: string;
    if (symbol.endsWith('TN') || name.includes('tài năng')) {
      programCode = 'DTVT-KS-KSTN';
    } else if (symbol.endsWith('A') || name.includes('vi mạch')) {
      programCode = 'DTVT-KS-VIMACH';
    } else if (startNum >= NEW_ERA_FROM) {
      programCode = `DTVT-${degree === DegreeLevel.ENGINEER ? 'KS' : 'CN'}-K26`;
    } else {
      const parts = ['DTVT', degree === DegreeLevel.ENGINEER ? 'KS' : 'CN'];
      if (name.includes('clc')) parts.push('CLC');
      const spec = (['KTDT', 'KTVT', 'HTMT'] as const).find((s) =>
        toks.includes(s),
      );
      if (spec) parts.push(spec);
      programCode = parts.join('-');
    }
    return {
      frameCode: code,
      programCode,
      facultyUnitCode: EXTRA_FACULTY_CODES.DTVT,
      degreeLevel: degree,
      startSemesterCode: major.KyBDau,
    };
  }

  // 1b. CTTT Điện tử - Viễn thông: 1231xxx (CD01, KyBDau >= 2010)
  if (code.startsWith('1231')) {
    if (major.CapDT !== UNDERGRADUATE_LEVEL || startNum < UNDERGRAD_MIN_START)
      return null;
    const parts = [
      'DTVT',
      'CTTT',
      degree === DegreeLevel.ENGINEER ? 'KS' : 'CN',
    ];
    const lastToken = toks[toks.length - 1];
    if (lastToken === 'ĐT' || lastToken === 'DT') parts.push('DT');
    else if (lastToken === 'VT') parts.push('VT');
    return {
      frameCode: code,
      programCode: parts.join('-'),
      facultyUnitCode: EXTRA_FACULTY_CODES.DTVT,
      degreeLevel: degree,
      startSemesterCode: major.KyBDau,
    };
  }

  // 1c. Thạc sĩ Kỹ thuật điện tử: 1063xxx (CD02, InUse=1, rows >= 10)
  if (code.startsWith('1063')) {
    if (
      major.CapDT !== MASTER_LEVEL ||
      major.InUse !== LEGACY_FLAG_ON ||
      rowCount < GRADUATE_MIN_ROWS
    )
      return null;
    const startSemesterCode =
      major.KyBDau || inferGraduateSemesterCode(major.TenNganh);
    return {
      frameCode: code,
      programCode: `DTVT-THS-${graduateTrackSuffix(major.TenNganh)}`,
      facultyUnitCode: EXTRA_FACULTY_CODES.DTVT,
      degreeLevel: DegreeLevel.MASTER,
      startSemesterCode,
    };
  }

  // 2. Kỹ thuật Máy tính: 1065xxx (CD01, KyBDau >= 2010)
  if (code.startsWith('1065')) {
    if (major.CapDT !== UNDERGRADUATE_LEVEL || startNum < UNDERGRAD_MIN_START)
      return null;
    const degToken = degree === DegreeLevel.ENGINEER ? 'KS' : 'CN';
    const programCode =
      startNum >= NEW_ERA_FROM ? `KTMT-${degToken}-K26` : `KTMT-${degToken}`;
    return {
      frameCode: code,
      programCode,
      facultyUnitCode: EXTRA_FACULTY_CODES.DTVT,
      degreeLevel: degree,
      startSemesterCode: major.KyBDau,
    };
  }

  // 3a. Kiến trúc đại học: 1211xxx (CD01, KyBDau >= 2010)
  if (code.startsWith('1211')) {
    if (major.CapDT !== UNDERGRADUATE_LEVEL || startNum < UNDERGRAD_MIN_START)
      return null;
    const parts = ['KTR', degree === DegreeLevel.ENGINEER ? 'KS' : 'CN'];
    if (startNum >= NEW_ERA_FROM) parts.push('K26');
    else if (name.includes('clc')) parts.push('CLC');
    return {
      frameCode: code,
      programCode: parts.join('-'),
      facultyUnitCode: EXTRA_FACULTY_CODES.KTR,
      degreeLevel: degree,
      startSemesterCode: major.KyBDau,
    };
  }

  // 3b. Thạc sĩ Kiến trúc: 1212xxx (CD02, InUse=1, rows >= 10)
  if (code.startsWith('1212')) {
    if (
      major.CapDT !== MASTER_LEVEL ||
      major.InUse !== LEGACY_FLAG_ON ||
      rowCount < GRADUATE_MIN_ROWS
    )
      return null;
    const startSemesterCode =
      major.KyBDau || inferGraduateSemesterCode(major.TenNganh);
    return {
      frameCode: code,
      programCode: `KTR-THS-${graduateTrackSuffix(major.TenNganh)}`,
      facultyUnitCode: EXTRA_FACULTY_CODES.KTR,
      degreeLevel: DegreeLevel.MASTER,
      startSemesterCode,
    };
  }

  // 4a. Thạc sĩ Khoa học máy tính (Khoa CNTT): 1022xxx (CD02, InUse=1, rows >= 10)
  if (code.startsWith('1022')) {
    if (
      major.CapDT !== MASTER_LEVEL ||
      major.InUse !== LEGACY_FLAG_ON ||
      rowCount < GRADUATE_MIN_ROWS
    )
      return null;
    const startSemesterCode =
      major.KyBDau || inferGraduateSemesterCode(major.TenNganh);
    return {
      frameCode: code,
      programCode: `CNTT-THS-${graduateTrackSuffix(major.TenNganh)}`,
      facultyUnitCode: EXTRA_FACULTY_CODES.CNTT,
      degreeLevel: DegreeLevel.MASTER,
      startSemesterCode,
    };
  }

  // 4b. Tiến sĩ Khoa học máy tính (Khoa CNTT): 1023xxx (CD03, rows > 0)
  if (code.startsWith('1023')) {
    if (major.CapDT !== DOCTORATE_LEVEL) return null;
    const startSemesterCode =
      major.KyBDau || inferGraduateSemesterCode(major.TenNganh);
    return {
      frameCode: code,
      programCode: 'CNTT-TS',
      facultyUnitCode: EXTRA_FACULTY_CODES.CNTT,
      degreeLevel: DegreeLevel.DOCTORATE,
      startSemesterCode,
    };
  }

  return null;
}

export function groupExtraFrames(
  majors: readonly (FrameMajor & { InUse: string })[],
  rowCounts: ReadonlyMap<string, number>,
): { programs: ExtraProgramGroup[]; deduplicatedFrames: string[] } {
  const byProgram = new Map<string, ExtraProgramGroup>();
  const deduplicatedFrames: string[] = [];

  for (const major of majors) {
    const assignment = classifyExtraFrame(
      major,
      rowCounts.get(major.MaNganh) ?? 0,
    );
    if (!assignment) continue;
    const group = byProgram.get(assignment.programCode) ?? {
      programCode: assignment.programCode,
      facultyUnitCode: assignment.facultyUnitCode,
      degreeLevel: assignment.degreeLevel,
      frames: [],
    };
    if (group.degreeLevel !== assignment.degreeLevel) {
      throw new Error(
        `Mixed degree levels in ${assignment.programCode}: ${group.degreeLevel} vs ${assignment.degreeLevel}`,
      );
    }
    if (group.facultyUnitCode !== assignment.facultyUnitCode) {
      throw new Error(
        `Mixed faculties in ${assignment.programCode}: ${group.facultyUnitCode} vs ${assignment.facultyUnitCode}`,
      );
    }
    group.frames.push(assignment);
    byProgram.set(assignment.programCode, group);
  }

  const programs: ExtraProgramGroup[] = [];
  for (const group of byProgram.values()) {
    // Deduplicate frames that share the exact same startSemesterCode within a program
    // (e.g. 1231008 and 1231029 are duplicate rows for CTTT K2023 at 2310).
    // Keep the one with the higher rowCount, breaking ties by higher frameCode.
    const bySemester = new Map<string, ExtraFrameAssignment>();
    const kept: ExtraFrameAssignment[] = [];
    for (const frame of group.frames.sort((a, b) =>
      a.frameCode.localeCompare(b.frameCode),
    )) {
      if (!frame.startSemesterCode) {
        kept.push(frame);
        continue;
      }
      const existing = bySemester.get(frame.startSemesterCode);
      if (!existing) {
        bySemester.set(frame.startSemesterCode, frame);
      } else {
        const existingRows = rowCounts.get(existing.frameCode) ?? 0;
        const candidateRows = rowCounts.get(frame.frameCode) ?? 0;
        if (
          candidateRows > existingRows ||
          (candidateRows === existingRows &&
            frame.frameCode > existing.frameCode)
        ) {
          deduplicatedFrames.push(existing.frameCode);
          bySemester.set(frame.startSemesterCode, frame);
        } else {
          deduplicatedFrames.push(frame.frameCode);
        }
      }
    }
    const finalFrames = [...kept, ...bySemester.values()].sort(
      (a, b) =>
        (a.startSemesterCode ?? '').localeCompare(b.startSemesterCode ?? '') ||
        a.frameCode.localeCompare(b.frameCode),
    );
    programs.push({ ...group, frames: finalFrames });
  }

  programs.sort((a, b) => a.programCode.localeCompare(b.programCode));
  deduplicatedFrames.sort();
  return { programs, deduplicatedFrames };
}

export interface TrackFrameInput {
  trackCode: string;
  trackName: string;
  englishName: string;
  description: string;
  sortOrder: number;
  version: DutVersion;
}

function groupRequiredCredits(
  group: DutGroup,
  memberItems: readonly DutItem[],
  courseCredits: ReadonlyMap<string, string>,
): Prisma.Decimal {
  if (group.minCredits) return new Prisma.Decimal(group.minCredits);
  if (group.minCourses && group.minCourses > 0) {
    const sorted = memberItems
      .map((item) => new Prisma.Decimal(courseCredits.get(item.courseCode) ?? '0'))
      .sort((a, b) => a.comparedTo(b));
    return sorted
      .slice(0, group.minCourses)
      .reduce((sum, c) => sum.plus(c), new Prisma.Decimal(0));
  }
  return new Prisma.Decimal(0);
}

function groupSignature(group: DutGroup, memberCodes: readonly string[]): string {
  return JSON.stringify({
    minCourses: group.minCourses,
    minCredits: group.minCredits,
    members: [...memberCodes].sort(),
  });
}

// Compute the exact course intersection (common core, trackId = null) and track-specific differences
// across the 4 real K2023 CNTT Đặc thù frames (CNPM, ATTT, HTTT, KTMT).
export function buildTrackShowcase(
  inputs: readonly TrackFrameInput[],
  courseCredits: ReadonlyMap<string, string>,
): TrackShowcaseProgram {
  if (inputs.length < 2) {
    throw new Error('Track showcase requires at least 2 track frames');
  }
  const base = inputs[0].version;

  // Map each track's items by courseCode and elective groups by groupCode.
  const trackMaps = inputs.map((t) => {
    const itemByCourse = new Map(
      t.version.items.map((item) => [item.courseCode, item]),
    );
    const groupByCode = new Map(
      t.version.groups.map((group) => [group.groupCode, group]),
    );
    const membersByGroup = new Map<string, string[]>();
    for (const item of t.version.items) {
      if (!item.groupCode) continue;
      const list = membersByGroup.get(item.groupCode) ?? [];
      list.push(item.courseCode);
      membersByGroup.set(item.groupCode, list);
    }
    return { ...t, itemByCourse, groupByCode, membersByGroup };
  });

  // 1. Common compulsory courses: present as non-elective in ALL tracks.
  const commonCourseCodes = new Set<string>();
  const commonGroupCodesInBase = new Set<string>();

  for (const item of base.items) {
    if (!item.isElective) {
      const inAllCompulsory = trackMaps.every((t) => {
        const match = t.itemByCourse.get(item.courseCode);
        return match !== undefined && !match.isElective;
      });
      if (inAllCompulsory) commonCourseCodes.add(item.courseCode);
    }
  }

  // 2. Common elective groups: an elective group in base whose exact member set & minimums
  // appear identically in every other track.
  const commonGroupSignatureSet = new Set<string>();
  for (const baseGroup of base.groups) {
    const baseMembers = trackMaps[0].membersByGroup.get(baseGroup.groupCode) ?? [];
    if (baseMembers.length === 0) continue;
    const sig = groupSignature(baseGroup, baseMembers);
    const inAllTracks = trackMaps.slice(1).every((t) =>
      t.version.groups.some((g) => {
        const members = t.membersByGroup.get(g.groupCode) ?? [];
        return groupSignature(g, members) === sig;
      }),
    );
    if (inAllTracks) {
      commonGroupCodesInBase.add(baseGroup.groupCode);
      commonGroupSignatureSet.add(sig);
      for (const code of baseMembers) commonCourseCodes.add(code);
    }
  }

  const commonGroups: DutGroup[] = base.groups.filter((g) =>
    commonGroupCodesInBase.has(g.groupCode),
  );
  const commonItems: DutItem[] = base.items.filter((item) =>
    commonCourseCodes.has(item.courseCode),
  );
  const commonRequisites: DutRequisite[] = base.requisites.filter(
    (req) =>
      commonCourseCodes.has(req.targetCourseCode) &&
      commonCourseCodes.has(req.sourceCourseCode),
  );

  // 3. Track-specific items & groups for each track.
  const tracks: TrackShowcaseTrack[] = trackMaps.map((t) => {
    const trackItemsRaw = t.version.items.filter(
      (item) => !commonCourseCodes.has(item.courseCode),
    );
    const usedGroupCodes = new Set(
      trackItemsRaw
        .map((item) => item.groupCode)
        .filter((code): code is string => code !== null),
    );
    // Prefix groupCode with trackCode so ElectiveGroup (versionId, groupCode) stays globally unique.
    const renamedGroupCode = (original: string) => `${t.trackCode}-${original}`;

    const trackGroups: DutGroup[] = t.version.groups
      .filter((g) => usedGroupCodes.has(g.groupCode))
      .map((g) => ({
        ...g,
        groupCode: renamedGroupCode(g.groupCode),
        groupName: `${g.groupName} (${t.trackCode})`,
      }));

    const trackItems: DutItem[] = trackItemsRaw.map((item) => ({
      ...item,
      groupCode: item.groupCode ? renamedGroupCode(item.groupCode) : null,
    }));

    const trackCourseCodes = new Set(trackItems.map((i) => i.courseCode));
    const trackRequisites: DutRequisite[] = t.version.requisites.filter(
      (req) =>
        trackCourseCodes.has(req.targetCourseCode) &&
        (commonCourseCodes.has(req.sourceCourseCode) ||
          trackCourseCodes.has(req.sourceCourseCode)),
    );

    const compulsoryCredits = trackItems
      .filter((item) => !item.isElective)
      .reduce(
        (sum, item) =>
          sum.plus(
            new Prisma.Decimal(
              legacyDecimal(courseCredits.get(item.courseCode) ?? '0'),
            ),
          ),
        new Prisma.Decimal(0),
      );

    const electiveCredits = trackGroups.reduce((sum, group) => {
      const members = trackItems.filter((i) => i.groupCode === group.groupCode);
      return sum.plus(groupRequiredCredits(group, members, courseCredits));
    }, new Prisma.Decimal(0));

    return {
      trackCode: t.trackCode,
      trackName: t.trackName,
      englishName: t.englishName,
      description: t.description,
      sortOrder: t.sortOrder,
      compulsoryCredits: compulsoryCredits.toString(),
      electiveCredits: electiveCredits.toString(),
      groups: trackGroups,
      items: trackItems,
      requisites: trackRequisites,
    };
  });

  return {
    programCode: 'CNTT-CN-DH',
    programName:
      'Công nghệ Thông tin — Mô hình 4 Định hướng chuyên sâu (K2023)',
    facultyUnitCode: EXTRA_FACULTY_CODES.CNTT,
    majorCode: base.majorCode,
    majorName: base.majorName,
    degreeLevel: DegreeLevel.BACHELOR,
    semesterCount: base.semesterCount,
    totalCredits: base.totalCredits,
    compulsoryCredits: base.compulsoryCredits,
    electiveCredits: base.electiveCredits,
    startSemesterCode: base.startSemesterCode ?? '2310',
    cohortCode: base.cohortCode ?? 'K2023',
    commonGroups,
    commonItems,
    commonRequisites,
    tracks,
  };
}
