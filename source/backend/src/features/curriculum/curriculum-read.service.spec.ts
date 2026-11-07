import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CourseRelationType,
  CourseStatus,
  Prisma,
  ProgramVersionStatus,
  ScopeSource,
  ScopeType,
  type PermissionMode,
} from '../../generated/prisma/client.js';
import {
  AccessContext,
  type ActiveAssignment,
} from '../../shared/authz/access-context.js';
import {
  PERMISSIONS,
  type PermissionCode,
} from '../../shared/authz/permission-codes.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { CurriculumReadService } from './curriculum-read.service.js';
import type { VersionRow } from './curriculum-access.js';

const VERSION: VersionRow = {
  id: 'v1',
  status: ProgramVersionStatus.DRAFT,
  semesterCount: 8,
  programId: 'p1',
  programName: 'Kỹ thuật máy tính',
  versionNumber: null,
  totalCredits: new Prisma.Decimal('150'),
  compulsoryCredits: new Prisma.Decimal('100'),
  electiveCredits: new Prisma.Decimal('50'),
  program: { id: 'p1', facultyId: 'home', programCode: '1024034' },
  sourceRequest: null,
  correctionOfId: null,
};

interface Cell {
  code: PermissionCode;
  mode: PermissionMode;
  all?: boolean;
}

function access(
  cells: Cell[],
  scope: { programIds?: string[]; subjectGroupIds?: string[] } = {},
): AccessContext {
  const assignment: ActiveAssignment = {
    assignmentId: null,
    roleId: 'r',
    roleCode: 'R',
    roleName: 'R',
    scopeSource: ScopeSource.NONE,
    scopeType: ScopeType.ASSIGNMENT,
    scopeUnit: null,
    scope: {
      all: false,
      orgUnitIds: new Set(),
      subjectGroupIds: new Set(scope.subjectGroupIds),
      programIds: new Set(scope.programIds),
      studentIds: new Set(),
    },
    permissions: new Map(
      cells.map((cell) => [
        cell.code,
        { mode: cell.mode, scope: cell.all ? 'ALL' : 'SCOPED' },
      ]),
    ),
  };
  return new AccessContext('user', [assignment]);
}

const VIEW_ALL: Cell = {
  code: PERMISSIONS.PROGRAM_VIEW,
  mode: 'DIRECT',
  all: true,
};
const R1 = access([
  VIEW_ALL,
  { code: PERMISSIONS.CURRICULUM_EDIT, mode: 'DIRECT', all: true },
]);
const R4 = access(
  [VIEW_ALL, { code: PERMISSIONS.CURRICULUM_EDIT, mode: 'VIA_REQUEST' }],
  { subjectGroupIds: ['G1'] },
);
const R6 = access([{ code: PERMISSIONS.PROGRAM_VIEW, mode: 'DIRECT' }]);

function course(code: string, credits: string, ownerGroupId: string | null) {
  return {
    id: `course-${code}`,
    courseCode: code,
    courseName: `Học phần ${code}`,
    credits: new Prisma.Decimal(credits),
    status: CourseStatus.ACTIVE,
    ownerGroupId,
    syllabi: [] as { id: string }[],
  };
}

function row(
  code: string,
  plannedSemester: number,
  sortOrder: number,
  patch: Record<string, unknown> = {},
) {
  return {
    id: `item-${code}`,
    versionId: 'v1',
    plannedSemester,
    sortOrder,
    courseId: `course-${code}`,
    course: course(code, '3', 'G1'),
    blockSymbol: null,
    isElective: false,
    electiveGroupId: null,
    electiveGroup: null,
    htDa: false,
    tqDa: false,
    minStudiedScore: null,
    minTransferScore: null,
    note: null,
    requisites: [],
    ...patch,
  };
}

describe('CurriculumReadService.read', () => {
  let programVersion: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  let curriculumItem: { findMany: ReturnType<typeof vi.fn> };
  let electiveGroup: { findMany: ReturnType<typeof vi.fn> };
  let service: CurriculumReadService;

  beforeEach(() => {
    programVersion = {
      findUnique: vi.fn().mockResolvedValue(VERSION),
      findFirst: vi.fn().mockResolvedValue(null),
    };
    curriculumItem = { findMany: vi.fn().mockResolvedValue([]) };
    electiveGroup = { findMany: vi.fn().mockResolvedValue([]) };
    const client = {
      programVersion,
      curriculumItem,
      electiveGroup,
      knowledgeBlock: {
        findMany: vi.fn().mockResolvedValue([
          {
            blockCode: 'A1',
            blockName: 'Toán',
            requiredCredits: new Prisma.Decimal('30'),
          },
        ]),
      },
    };
    service = new CurriculumReadService(client as unknown as PrismaService);
  });

  it('is out of scope for a caller whose program.view does not reach the program', async () => {
    await expect(service.read('v1', R6)).rejects.toMatchObject({
      code: 'OUT_OF_SCOPE',
    });
  });

  it('is not found for an unknown version', async () => {
    programVersion.findUnique.mockResolvedValue(null);
    await expect(service.read('v1', R1)).rejects.toMatchObject({
      code: 'PROGRAM_VERSION_NOT_FOUND',
    });
  });

  it('lists every semester and warns about the empty one (KB-016)', async () => {
    curriculumItem.findMany.mockResolvedValue(
      [1, 2, 3, 4, 5, 6, 7].map((semester) => row(`C${semester}`, semester, 1)),
    );

    const result = await service.read('v1', R1);

    expect(result.semesters).toHaveLength(8);
    expect(result.semesters[7]).toMatchObject({ semester: 8, itemCount: 0 });
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: 'EMPTY_SEMESTER', semester: 8 }),
    ]);
  });

  it('counts an elective group by its minimum, not its listed credits (KB-013)', async () => {
    curriculumItem.findMany.mockResolvedValue([
      row('A', 1, 1),
      ...['B', 'C', 'D'].map((code, index) =>
        row(code, 2, index + 1, {
          isElective: true,
          electiveGroupId: 'g1',
        }),
      ),
    ]);
    electiveGroup.findMany.mockResolvedValue([
      {
        id: 'g1',
        groupCode: 'TC1',
        groupName: 'Nhóm 1',
        minCredits: new Prisma.Decimal('6'),
        minCourses: null,
        items: [],
      },
    ]);
    const result = await service.read('v1', R1);
    expect(result.programCredits).toEqual({
      computed: { compulsory: '3', elective: '6', total: '9' },
      declared: { compulsory: '100', elective: '50', total: '150' },
      mismatch: true,
    });
  });

  it('flags a row whose course has any syllabus revision (EC-44)', async () => {
    curriculumItem.findMany.mockResolvedValue([
      row('C1', 1, 1, {
        course: { ...course('C1', '3', 'G1'), syllabi: [{ id: 's1' }] },
      }),
      row('C2', 1, 2),
    ]);

    const result = await service.read('v1', R1);

    expect(result.items.map((item) => item.hasSyllabus)).toEqual([true, false]);
  });

  it('numbers rows 1.. in the order the database returns them (semester, then order)', async () => {
    curriculumItem.findMany.mockResolvedValue([
      row('A', 1, 5),
      row('B', 2, 1),
      row('C', 2, 2),
    ]);
    const result = await service.read('v1', R1);
    expect(result.items.map((item) => item.displayOrder)).toEqual([1, 2, 3]);
    expect(curriculumItem.findMany.mock.calls[0][0].orderBy).toEqual([
      { plannedSemester: 'asc' },
      { sortOrder: 'asc' },
      { id: 'asc' },
    ]);
  });

  it('sums credits exactly and names the block from the knowledge block list', async () => {
    curriculumItem.findMany.mockResolvedValue([
      row('A', 1, 1, {
        course: course('A', '2.5', 'G1'),
        blockSymbol: 'A1',
      }),
      row('B', 1, 2, { course: course('B', '3.5', 'G1'), blockSymbol: 'A1' }),
    ]);
    const result = await service.read('v1', R1);
    expect(result.semesters[0].totalCredits).toBe('6');
    expect(result.blocks).toEqual([
      { symbol: 'A1', blockName: 'Toán', totalCredits: '6', itemCount: 2 },
    ]);
    expect(result.items[0].blockName).toBe('Toán');
    expect(result.knowledgeBlocks).toEqual([
      { blockCode: 'A1', blockName: 'Toán', requiredCredits: '30' },
    ]);
  });

  it('shows the semester of a requisite source and warns when it is later (KB-019)', async () => {
    curriculumItem.findMany.mockResolvedValue([
      row('B', 2, 1, {
        requisites: [
          {
            id: 'r1',
            sourceCourseId: 'course-A',
            sourceCourse: course('A', '3', null),
            relationType: CourseRelationType.PREREQUISITE,
            minScore: new Prisma.Decimal('2'),
          },
        ],
      }),
      row('A', 3, 1),
    ]);
    const result = await service.read('v1', R1);
    expect(result.items[0].requisites[0]).toMatchObject({
      sourceSemester: 3,
      minScore: '2',
    });
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: 'REQUISITE_NOT_EARLIER',
        severity: 'HIGH',
        itemId: 'item-B',
      }),
    );
  });

  it('lets R4 add and edit only rows of its group, never the structure', async () => {
    curriculumItem.findMany.mockResolvedValue([
      row('A', 1, 1),
      row('B', 1, 2, { course: course('B', '3', 'H') }),
    ]);
    const result = await service.read('v1', R4);
    expect(result).toMatchObject({
      editPath: 'DIRECT',
      canEditStructure: false,
      canAddItems: true,
    });
    expect(result.items.map((item) => item.canEdit)).toEqual([true, false]);
  });

  it('shows R4 the request path on a released version whose courses include its group', async () => {
    programVersion.findUnique.mockResolvedValue({
      ...VERSION,
      status: ProgramVersionStatus.ACTIVE,
      versionNumber: '1.0',
    });
    programVersion.findFirst.mockResolvedValue({ id: 'v1' });
    curriculumItem.findMany.mockResolvedValue([row('A', 1, 1)]);
    const result = await service.read('v1', R4);
    expect(result).toMatchObject({
      editPath: 'VIA_REQUEST',
      canEditStructure: false,
      canAddItems: false,
    });
  });

  it('gives R4 no request path when none of the programme courses is in its group', async () => {
    programVersion.findUnique.mockResolvedValue({
      ...VERSION,
      status: ProgramVersionStatus.ACTIVE,
      versionNumber: '1.0',
    });
    programVersion.findFirst.mockResolvedValue({ id: 'v1' });
    curriculumItem.findMany.mockResolvedValue([
      row('B', 1, 1, { course: course('B', '3', 'H') }),
    ]);
    const result = await service.read('v1', R4);
    expect(result.editPath).toBeNull();
  });

  it('gives R1 direct editing of an unreleased Draft', async () => {
    const result = await service.read('v1', R1);
    expect(result).toMatchObject({
      editPath: 'DIRECT',
      canEditStructure: true,
      canAddItems: true,
    });
  });

  it('shows VIA_REQUEST and no editing for an Active version', async () => {
    programVersion.findUnique.mockResolvedValue({
      ...VERSION,
      status: ProgramVersionStatus.ACTIVE,
      versionNumber: '1.0',
    });
    programVersion.findFirst.mockResolvedValue({ id: 'v1' });
    curriculumItem.findMany.mockResolvedValue([row('A', 1, 1)]);
    const result = await service.read('v1', R1);
    expect(result).toMatchObject({
      editPath: 'VIA_REQUEST',
      canEditStructure: false,
      canAddItems: false,
    });
    expect(result.items[0].canEdit).toBe(false);
  });
});
