export interface TrackDefinition {
  readonly trackCode: string;
  readonly trackName: string;
  readonly englishName: string;
  readonly sortOrder: number;
  readonly description: string;
}

export interface TrackAssignment {
  readonly trackCode: string;
  readonly isElective: boolean;
}

export const TARGET_PROGRAM_CODES = [
  'CNTT-CN-DT',
  'CNTT-KS-DT',
  'DTVT-KS',
  'DTVT-KS-CLC',
  'KTMT-KS',
  'CNTT-THS-NC',
] as const;

export type TargetProgramCode = (typeof TARGET_PROGRAM_CODES)[number];

const CNTT_DT_TRACKS: readonly TrackDefinition[] = [
  {
    trackCode: 'CNPM',
    trackName: 'Công nghệ phần mềm',
    englishName: 'Software Engineering',
    sortOrder: 1,
    description: 'Chuyên ngành Công nghệ phần mềm',
  },
  {
    trackCode: 'HTTT',
    trackName: 'Hệ thống thông tin',
    englishName: 'Information Systems',
    sortOrder: 2,
    description: 'Chuyên ngành Hệ thống thông tin',
  },
  {
    trackCode: 'ATTT',
    trackName: 'An toàn thông tin',
    englishName: 'Information Security',
    sortOrder: 3,
    description: 'Chuyên ngành An toàn thông tin',
  },
  {
    trackCode: 'MANG',
    trackName: 'Mạng máy tính và Truyền thông',
    englishName: 'Computer Networks & Communications',
    sortOrder: 4,
    description: 'Chuyên ngành Mạng máy tính và Truyền thông',
  },
  {
    trackCode: 'KTMT',
    trackName: 'Kỹ thuật máy tính',
    englishName: 'Computer Engineering',
    sortOrder: 5,
    description: 'Chuyên ngành Kỹ thuật máy tính',
  },
];

const DTVT_TRACKS: readonly TrackDefinition[] = [
  {
    trackCode: 'KTDT',
    trackName: 'Định hướng Kỹ thuật Điện tử',
    englishName: 'Electronics Engineering',
    sortOrder: 1,
    description: 'Định hướng chuyên sâu Kỹ thuật Điện tử',
  },
  {
    trackCode: 'KTVT',
    trackName: 'Định hướng Kỹ thuật Viễn thông',
    englishName: 'Telecommunications Engineering',
    sortOrder: 2,
    description: 'Định hướng chuyên sâu Kỹ thuật Viễn thông',
  },
  {
    trackCode: 'HTMT',
    trackName: 'Định hướng Hệ thống máy tính (KTMT)',
    englishName: 'Computer Systems Engineering',
    sortOrder: 3,
    description: 'Định hướng chuyên sâu Hệ thống máy tính (KTMT)',
  },
];

const KTMT_KS_TRACKS: readonly TrackDefinition[] = [
  {
    trackCode: 'IOT',
    trackName: 'Mô-đun Hệ thống nhúng và IoT',
    englishName: 'Embedded Systems & IoT',
    sortOrder: 1,
    description: 'Mô-đun chuyên sâu Hệ thống nhúng và IoT',
  },
  {
    trackCode: 'AI',
    trackName: 'Mô-đun Trí tuệ nhân tạo',
    englishName: 'Artificial Intelligence',
    sortOrder: 2,
    description: 'Mô-đun chuyên sâu Trí tuệ nhân tạo',
  },
];

const CNTT_THS_NC_TRACKS: readonly TrackDefinition[] = [
  {
    trackCode: 'CNPM',
    trackName: 'Chuyên đề Công nghệ phần mềm',
    englishName: 'Software Engineering',
    sortOrder: 1,
    description: 'Chuyên đề chuyên sâu Công nghệ phần mềm',
  },
  {
    trackCode: 'MATTT',
    trackName: 'Mạng và An toàn thông tin',
    englishName: 'Networks & Information Security',
    sortOrder: 2,
    description: 'Chuyên đề chuyên sâu Mạng và An toàn thông tin',
  },
  {
    trackCode: 'KHDL',
    trackName: 'Khoa học dữ liệu',
    englishName: 'Data Science',
    sortOrder: 3,
    description: 'Chuyên đề chuyên sâu Khoa học dữ liệu',
  },
];

export const TRACK_DEFINITIONS_BY_PROGRAM: Readonly<
  Record<TargetProgramCode, readonly TrackDefinition[]>
> = {
  'CNTT-CN-DT': CNTT_DT_TRACKS,
  'CNTT-KS-DT': CNTT_DT_TRACKS,
  'DTVT-KS': DTVT_TRACKS,
  'DTVT-KS-CLC': DTVT_TRACKS,
  'KTMT-KS': KTMT_KS_TRACKS,
  'CNTT-THS-NC': CNTT_THS_NC_TRACKS,
};

export function getTrackDefinition(
  programCode: string,
  trackCode: string,
): TrackDefinition | undefined {
  const definitions =
    TRACK_DEFINITIONS_BY_PROGRAM[programCode as TargetProgramCode];
  return definitions?.find((def) => def.trackCode === trackCode);
}

interface PatternSpec {
  readonly trackCode: string;
  readonly pattern: RegExp;
}

const CNTT_DT_PATTERNS: readonly PatternSpec[] = [
  {
    trackCode: 'CNPM',
    pattern: /\b(?:cong\s+nghe\s+(?:pm|phan\s+mem)|cnpm)\b/g,
  },
  {
    trackCode: 'HTTT',
    pattern: /\b(?:httt|he\s+thong\s+thong\s+tin)\b/g,
  },
  {
    trackCode: 'ATTT',
    pattern: /\b(?:attt|an\s+toan\s+thong\s+tin)\b/g,
  },
  {
    trackCode: 'MANG',
    pattern: /\bmang\b/g,
  },
  {
    trackCode: 'KTMT',
    pattern: /\b(?:ktmt|ky\s+thuat\s+may\s+tinh)\b/g,
  },
];

const DTVT_PATTERNS: readonly PatternSpec[] = [
  { trackCode: 'KTDT', pattern: /\bktdt\b/g },
  { trackCode: 'KTVT', pattern: /\bktvt?\b/g },
  { trackCode: 'HTMT', pattern: /\b[hk]tmt\b/g },
];

const KTMT_KS_PATTERNS: readonly PatternSpec[] = [
  { trackCode: 'IOT', pattern: /(?<![a-z0-9])(?:he\s+thong\s+nhung|iot)(?![a-z0-9])/g },
  { trackCode: 'AI', pattern: /(?<![a-z0-9])(?:tri\s+tue\s+nhan\s+tao|ai)(?![a-z0-9])/g },
];

const CNTT_THS_NC_PATTERNS: readonly PatternSpec[] = [
  {
    trackCode: 'CNPM',
    pattern: /\b(?:cnpm|cong\s+nghe\s+(?:pm|phan\s+mem))\b/g,
  },
  {
    trackCode: 'MATTT',
    pattern: /\b(?:mattt|mang\s+va\s+an\s+toan\s+thong\s+tin)\b/g,
  },
  {
    trackCode: 'KHDL',
    pattern: /\b(?:khdl|khoa\s+hoc\s+du\s+lieu)\b/g,
  },
];

const COMPULSORY_RE = /\bbat\s+buoc\b/;
const ELECTIVE_RE = /\btu\s+chon\b/;
const CHOOSE_COUNT_RE = /(?<![a-z0-9])chon\s+\d+\s*(?:tc|hp)(?![a-z0-9])/;

function normalizeVietnamese(input: string): string {
  return input
    .replaceAll(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function findTrackCodesInOrder(
  normalizedText: string,
  patterns: readonly PatternSpec[],
): string[] {
  const hits: Array<{ trackCode: string; index: number }> = [];
  for (const spec of patterns) {
    for (const match of normalizedText.matchAll(spec.pattern)) {
      if (match.index !== undefined) {
        hits.push({ trackCode: spec.trackCode, index: match.index });
      }
    }
  }
  hits.sort((a, b) => a.index - b.index);

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const hit of hits) {
    if (!seen.has(hit.trackCode)) {
      seen.add(hit.trackCode);
      ordered.push(hit.trackCode);
    }
  }
  return ordered;
}

function deduplicateAssignments(
  assignments: readonly TrackAssignment[],
): TrackAssignment[] {
  const seen = new Set<string>();
  const result: TrackAssignment[] = [];
  for (const item of assignments) {
    if (!seen.has(item.trackCode)) {
      seen.add(item.trackCode);
      result.push(item);
    }
  }
  return result;
}

function parseCnttDtNote(
  normalized: string,
  defaultIsElective: boolean,
): TrackAssignment[] {
  const segments = normalized
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const parsedSegments = segments
    .map((segment) => ({
      trackCodes: findTrackCodesInOrder(segment, CNTT_DT_PATTERNS),
      hasElective: ELECTIVE_RE.test(segment),
      hasCompulsory: COMPULSORY_RE.test(segment),
    }))
    .filter((seg) => seg.trackCodes.length > 0);

  if (parsedSegments.length === 0) {
    return [];
  }

  // Notes like "Công nghệ PM, tự chọn HTTT" or "Mạng, Tự chọn ATTT" mean the
  // unmarked track is compulsory while the explicitly marked one is elective.
  const hasMixedPrimaryAndElective =
    parsedSegments.length > 1 &&
    parsedSegments.some((seg) => seg.hasElective) &&
    parsedSegments.some((seg) => !seg.hasElective && !seg.hasCompulsory);

  const assignments: TrackAssignment[] = [];
  for (const seg of parsedSegments) {
    const isElective = seg.hasCompulsory
      ? false
      : seg.hasElective
        ? true
        : hasMixedPrimaryAndElective
          ? false
          : defaultIsElective;
    for (const trackCode of seg.trackCodes) {
      assignments.push({ trackCode, isElective });
    }
  }

  return deduplicateAssignments(assignments);
}

function parseUniformElectiveNote(
  normalized: string,
  patterns: readonly PatternSpec[],
  defaultIsElective: boolean,
  treatChooseCountAsElective: boolean,
): TrackAssignment[] {
  const trackCodes = findTrackCodesInOrder(normalized, patterns);
  if (trackCodes.length === 0) {
    return [];
  }

  const isElective = COMPULSORY_RE.test(normalized)
    ? false
    : ELECTIVE_RE.test(normalized) ||
        (treatChooseCountAsElective && CHOOSE_COUNT_RE.test(normalized))
      ? true
      : defaultIsElective;

  return trackCodes.map((trackCode) => ({ trackCode, isElective }));
}

export function parseTrackAssignments(
  programCode: string,
  note: string | null | undefined,
  defaultIsElective: boolean,
): TrackAssignment[] {
  if (!note) {
    return [];
  }
  const normalized = normalizeVietnamese(note);
  if (normalized.length === 0) {
    return [];
  }

  switch (programCode) {
    case 'CNTT-CN-DT':
    case 'CNTT-KS-DT':
      return parseCnttDtNote(normalized, defaultIsElective);
    case 'DTVT-KS':
    case 'DTVT-KS-CLC':
      return parseUniformElectiveNote(
        normalized,
        DTVT_PATTERNS,
        defaultIsElective,
        false,
      );
    case 'KTMT-KS':
      return parseUniformElectiveNote(
        normalized,
        KTMT_KS_PATTERNS,
        defaultIsElective,
        true,
      );
    case 'CNTT-THS-NC':
      return parseUniformElectiveNote(
        normalized,
        CNTT_THS_NC_PATTERNS,
        defaultIsElective,
        false,
      );
    default:
      return [];
  }
}
