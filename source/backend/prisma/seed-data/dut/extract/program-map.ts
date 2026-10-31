import { DegreeLevel } from '../../../../src/generated/prisma/client.js';
import { HOME_FACULTY_LEGACY_CODE } from '../legacy-mapping.js';

// A frame (tmNganh.MaNganh, the same code as tmKhungCT.MaKhung) is one cohort's curriculum. The school has no
// program code above it, so frames are grouped into programs by rule; data/report.json lists the mapping for the
// Khoa to confirm.
export const FRAME_CODE = /^\d{7}$/;
// tmNganh.CapDT: CD01 = đại học. CD02 (thạc sĩ) and CD03 (tiến sĩ) are outside the SRS degree levels.
export const UNDERGRADUATE_LEVEL = 'CD01';
// Every frame in this range is seeded, with or without students (the faculty's current frames).
export const CURRENT_FRAME_PREFIX = `${HOME_FACULTY_LEGACY_CODE}4`;
export const PROGRAM_CODE_PREFIX = 'CNTT';

export interface FrameMajor {
  MaNganh: string;
  TenNganh: string;
  Kyhieu: string;
  SoHK: string;
  CapDT: string;
  LoaiCTDT: string;
  KyBDau: string;
}

export interface FrameScope {
  frameCodes: string[];
  excluded: { frameCode: string; level: string; students: number }[];
}

// Khoa CNTT scope: every 1024xxx frame plus every other 102xxxx frame a student still studies under.
export function selectFrameScope(
  majors: readonly FrameMajor[],
  studentsByFrame: ReadonlyMap<string, number>,
): FrameScope {
  const scope: FrameScope = { frameCodes: [], excluded: [] };
  for (const major of majors) {
    const code = major.MaNganh;
    if (!FRAME_CODE.test(code) || !code.startsWith(HOME_FACULTY_LEGACY_CODE))
      continue;
    const students = studentsByFrame.get(code) ?? 0;
    if (!code.startsWith(CURRENT_FRAME_PREFIX) && students === 0) continue;
    if (major.CapDT !== UNDERGRADUATE_LEVEL) {
      if (students > 0)
        scope.excluded.push({ frameCode: code, level: major.CapDT, students });
      continue;
    }
    scope.frameCodes.push(code);
  }
  scope.frameCodes.sort();
  scope.excluded.sort((left, right) =>
    left.frameCode.localeCompare(right.frameCode),
  );
  return scope;
}

const ENGINEER_MIN_SEMESTERS = 9;
const normalized = (name: string) => name.normalize('NFC').toLowerCase();
const tokens = (name: string) =>
  name
    .normalize('NFC')
    .toUpperCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

// LoaiCTDT is KS (kỹ sư) or CN (cử nhân) on recent frames; older ones say "Kỹ sư" in the name or run 9+ semesters.
export function degreeLevelFor(major: FrameMajor): DegreeLevel {
  if (major.LoaiCTDT === 'KS') return DegreeLevel.ENGINEER;
  if (major.LoaiCTDT === 'CN') return DegreeLevel.BACHELOR;
  if (/kỹ\s*sư/.test(normalized(major.TenNganh))) return DegreeLevel.ENGINEER;
  return Number(major.SoHK) >= ENGINEER_MIN_SEMESTERS
    ? DegreeLevel.ENGINEER
    : DegreeLevel.BACHELOR;
}

const SPECIALIZATIONS: Readonly<Record<string, string>> = {
  CNPM: 'CNPM',
  ATTT: 'ATTT',
  ANTT: 'ATTT',
  HTTT: 'HTTT',
  KTMT: 'KTMT',
  HTN: 'HTN',
  MẠNG: 'MANG',
  MANG: 'MANG',
};
// Frames before 2020 run the old (pre-reform) curricula; frames from 2026 the new one.
const OLD_ERA_BEFORE = 2010;
const NEW_ERA_FROM = 2610;

function trackFor(major: FrameMajor): string | null {
  const name = normalized(major.TenNganh);
  const symbol = major.Kyhieu.toUpperCase();
  if (symbol.endsWith('TN') || name.includes('tài năng')) return 'KSTN';
  if (symbol.endsWith('A') || name.includes('nhật')) return 'NHAT';
  if (
    symbol.endsWith('B') ||
    name.includes('khdl') ||
    name.includes('khoa học dữ liệu')
  )
    return 'KHDL';
  if (symbol.endsWith('C') || name.includes('không gian số')) return 'ATKGS';
  if (/clc\s*-?\s*anh/.test(name)) return 'ANH';
  return null;
}

// CNTT-{CN|KS}[-CU|-K26][-CLC][-track][-specialization]; "DT" (đặc thù) only when nothing else names the frame.
export function programCodeFor(major: FrameMajor): string {
  const parts = [
    PROGRAM_CODE_PREFIX,
    degreeLevelFor(major) === DegreeLevel.ENGINEER ? 'KS' : 'CN',
  ];
  const start = Number(major.KyBDau);
  if (major.KyBDau && start < OLD_ERA_BEFORE) parts.push('CU');
  if (major.KyBDau && start >= NEW_ERA_FROM) parts.push('K26');
  const name = normalized(major.TenNganh);
  if (name.includes('clc')) parts.push('CLC');
  const track = trackFor(major);
  if (track) parts.push(track);
  const specialization = tokens(major.TenNganh)
    .map((token) => SPECIALIZATIONS[token])
    .find(Boolean);
  if (specialization) parts.push(specialization);
  else if (
    !track &&
    (name.includes('đặc thù') || tokens(major.TenNganh).includes('ĐT'))
  )
    parts.push('DT');
  return parts.join('-');
}

export interface ProgramFrames {
  programCode: string;
  degreeLevel: DegreeLevel;
  frames: string[];
}

export function groupFramesIntoPrograms(
  majors: readonly FrameMajor[],
): ProgramFrames[] {
  const programs = new Map<string, ProgramFrames>();
  for (const major of majors) {
    const programCode = programCodeFor(major);
    const degreeLevel = degreeLevelFor(major);
    const program = programs.get(programCode) ?? {
      programCode,
      degreeLevel,
      frames: [],
    };
    if (program.degreeLevel !== degreeLevel)
      throw new Error(`Mixed degree levels in ${programCode}`);
    program.frames.push(major.MaNganh);
    programs.set(programCode, program);
  }
  return [...programs.values()]
    .map((program) => ({ ...program, frames: program.frames.sort() }))
    .sort((left, right) => left.programCode.localeCompare(right.programCode));
}
