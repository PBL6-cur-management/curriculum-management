import type {
  Curriculum,
  CurriculumItem,
  ElectiveGroup,
  ProgramTrack,
} from './api/curriculum';

// Shared by the curriculum page and dialog tests: a small 4-semester curriculum shaped like the server's answer.
export const course = (
  code: string,
  name: string,
  credits = '3',
  status: 'ACTIVE' | 'DISCONTINUED' | 'CANCELLED' = 'ACTIVE',
) => ({ id: `c-${code}`, courseCode: code, courseName: name, credits, status });

export function item(
  code: string,
  name: string,
  patch: Partial<CurriculumItem> = {},
): CurriculumItem {
  return {
    id: `i-${code}`,
    displayOrder: 1,
    plannedSemester: 1,
    sortOrder: 1,
    course: course(code, name),
    hasSyllabus: true,
    blockSymbol: null,
    blockName: null,
    isElective: false,
    electiveGroup: null,
    track: null,
    htDa: false,
    tqDa: false,
    minStudiedScore: null,
    minTransferScore: null,
    note: null,
    requisites: [],
    canEdit: true,
    ...patch,
  };
}

export function group(patch: Partial<ElectiveGroup> = {}): ElectiveGroup {
  return {
    id: 'g1',
    groupCode: 'TC1',
    groupName: 'Tự chọn chuyên ngành',
    trackId: null,
    minCredits: '6',
    minCourses: null,
    itemIds: [],
    listedCredits: '0',
    itemCount: 0,
    ...patch,
  };
}

export function trackFixture(
  patch: Partial<ProgramTrack> = {},
): ProgramTrack {
  return {
    id: 't-cnpm',
    trackCode: 'CNPM',
    trackName: 'Công nghệ phần mềm',
    englishName: 'Software Engineering',
    description: null,
    sortOrder: 1,
    compulsoryCredits: '8',
    electiveCredits: '6',
    itemCount: 0,
    ...patch,
  };
}

const semester = (
  number: number,
  total: string,
  compulsory: string,
  elective: string,
  count: number,
) => ({
  semester: number,
  totalCredits: total,
  compulsoryCredits: compulsory,
  electiveCredits: elective,
  itemCount: count,
});

export const ITEMS: CurriculumItem[] = [
  item('MAT101', 'Giải tích 1', {
    displayOrder: 1,
    blockSymbol: 'DC',
    blockName: 'Đại cương',
  }),
  item('PHY101', 'Vật lý 1', {
    displayOrder: 2,
    sortOrder: 2,
    course: course('PHY101', 'Vật lý 1', '2.5'),
    blockSymbol: 'DC',
  }),
  item('IT301', 'Mạng máy tính', {
    displayOrder: 3,
    plannedSemester: 3,
    isElective: true,
    electiveGroup: { id: 'g1', groupCode: 'TC1' },
    blockSymbol: 'CN',
  }),
];

export function curriculum(patch: Partial<Curriculum> = {}): Curriculum {
  return {
    version: {
      id: 'v1',
      programId: 'p1',
      programCode: '1024034',
      programName: 'Kỹ thuật máy tính',
      versionNumber: null,
      status: 'DRAFT',
      semesterCount: 4,
      sourceRequest: null,
    },
    editPath: 'DIRECT',
    canEditStructure: true,
    canAddItems: true,
    items: ITEMS,
    semesters: [
      semester(1, '5.5', '5.5', '0', 2),
      semester(2, '0', '0', '0', 0),
      semester(3, '3', '0', '3', 1),
      semester(4, '0', '0', '0', 0),
    ],
    blocks: [
      { symbol: 'CN', blockName: null, totalCredits: '3', itemCount: 1 },
      {
        symbol: 'DC',
        blockName: 'Đại cương',
        totalCredits: '5.5',
        itemCount: 2,
      },
    ],
    knowledgeBlocks: [
      { blockCode: 'DC', blockName: 'Đại cương', requiredCredits: null },
    ],
    electiveGroups: [
      group({ itemIds: ['i-IT301'], listedCredits: '3', itemCount: 1 }),
    ],
    tracks: [],
    programCredits: {
      computed: { compulsory: '5.5', elective: '6', total: '11.5' },
      declared: { compulsory: '100', elective: '50', total: '150' },
      mismatch: true,
    },
    warnings: [],
    ...patch,
  };
}
