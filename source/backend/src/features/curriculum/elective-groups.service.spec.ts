import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
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
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import type { VersionRow } from './curriculum-access.js';
import type { CurriculumReadService } from './curriculum-read.service.js';
import { ElectiveGroupsService } from './elective-groups.service.js';

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

function access(
  mode: PermissionMode,
  all: boolean,
  subjectGroupIds: string[] = [],
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
      subjectGroupIds: new Set(subjectGroupIds),
      programIds: new Set(),
      studentIds: new Set(),
    },
    permissions: new Map([
      [
        PERMISSIONS.CURRICULUM_EDIT,
        { mode, scope: all ? ('ALL' as const) : ('SCOPED' as const) },
      ],
    ]),
  };
  return new AccessContext('user', [assignment]);
}

const R1 = access('DIRECT', true);
const R4 = access('VIA_REQUEST', false, ['G1']);

const dec = (value: string) => new Prisma.Decimal(value);

function groupRow(patch: Record<string, unknown> = {}) {
  return {
    id: 'g1',
    versionId: 'v1',
    groupCode: 'TC1',
    groupName: 'Tự chọn 1',
    minCredits: dec('6'),
    minCourses: null as number | null,
    items: [],
    version: VERSION,
    ...patch,
  };
}

const item = (patch: Record<string, unknown> = {}) => ({
  id: 'a',
  versionId: 'v1',
  isElective: true,
  electiveGroupId: null,
  course: { courseCode: 'IT101' },
  ...patch,
});

describe('ElectiveGroupsService', () => {
  let electiveGroup: Record<
    'create' | 'update' | 'delete' | 'findUnique' | 'findUniqueOrThrow',
    ReturnType<typeof vi.fn>
  >;
  let curriculumItem: Record<
    'findMany' | 'updateMany',
    ReturnType<typeof vi.fn>
  >;
  let service: ElectiveGroupsService;

  beforeEach(() => {
    electiveGroup = {
      create: vi.fn().mockResolvedValue(groupRow()),
      update: vi.fn().mockResolvedValue(groupRow()),
      delete: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(groupRow()),
      findUniqueOrThrow: vi.fn().mockResolvedValue(groupRow()),
    };
    curriculumItem = {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    };
    const reader = { findVersion: vi.fn().mockResolvedValue(VERSION) };
    const client: Record<string, unknown> = {
      electiveGroup,
      curriculumItem,
      programVersion: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    client.$transaction = (work: unknown) =>
      typeof work === 'function'
        ? (work as (tx: unknown) => Promise<unknown>)(client)
        : Promise.all(work as Promise<unknown>[]);
    service = new ElectiveGroupsService(
      client as unknown as PrismaService,
      reader as unknown as CurriculumReadService,
    );
  });

  describe('create', () => {
    it('saves a group with a credit minimum', async () => {
      await service.create(
        'v1',
        { groupCode: 'TC1', groupName: 'Tự chọn 1', minCredits: '6' },
        R1,
      );
      expect(electiveGroup.create.mock.calls[0][0].data).toEqual({
        versionId: 'v1',
        trackId: null,
        groupCode: 'TC1',
        groupName: 'Tự chọn 1',
        minCredits: '6',
        minCourses: null,
      });
    });

    it('refuses a group with neither minimum, naming both fields', async () => {
      await expect(
        service.create('v1', { groupCode: 'TC1', groupName: 'X' }, R1),
      ).rejects.toMatchObject({
        code: 'GROUP_MINIMUM_REQUIRED',
        details: [{ field: 'minCredits' }, { field: 'minCourses' }],
      });
    });

    it('maps a duplicate code in the version', async () => {
      electiveGroup.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      await expect(
        service.create(
          'v1',
          { groupCode: 'TC1', groupName: 'X', minCourses: 2 },
          R1,
        ),
      ).rejects.toMatchObject({ code: 'ELECTIVE_GROUP_CODE_TAKEN' });
    });

    it('is program-level: R4 is out of scope', async () => {
      await expect(
        service.create(
          'v1',
          { groupCode: 'TC1', groupName: 'X', minCourses: 2 },
          R4,
        ),
      ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
    });
  });

  describe('update', () => {
    it('refuses to clear the only minimum', async () => {
      await expect(
        service.update('g1', { minCredits: null }, R1),
      ).rejects.toMatchObject({ code: 'GROUP_MINIMUM_REQUIRED' });
    });

    it('lets a minimum go when the other one remains', async () => {
      electiveGroup.findUnique.mockResolvedValue(groupRow({ minCourses: 2 }));
      await service.update('g1', { minCredits: null }, R1);
      expect(electiveGroup.update.mock.calls[0][0].data).toMatchObject({
        minCredits: null,
      });
    });

    it('is not found for an unknown group', async () => {
      electiveGroup.findUnique.mockResolvedValue(null);
      await expect(
        service.update('x', { groupName: 'Y' }, R1),
      ).rejects.toMatchObject({ code: 'ELECTIVE_GROUP_NOT_FOUND' });
    });
  });

  describe('assignItems', () => {
    it('refuses a compulsory row and names the course (KB-014)', async () => {
      curriculumItem.findMany.mockResolvedValue([
        item({ isElective: false, course: { courseCode: 'IT201' } }),
      ]);
      await expect(
        service.assignItems('g1', { itemIds: ['a'] }, R1),
      ).rejects.toMatchObject({
        code: 'GROUP_REQUIRES_ELECTIVE',
        message: expect.stringContaining('IT201'),
      });
      expect(curriculumItem.updateMany).not.toHaveBeenCalled();
    });

    it('refuses a row that already belongs to another group', async () => {
      curriculumItem.findMany.mockResolvedValue([
        item({ electiveGroupId: 'g2' }),
      ]);
      await expect(
        service.assignItems('g1', { itemIds: ['a'] }, R1),
      ).rejects.toMatchObject({ code: 'ITEM_IN_OTHER_GROUP' });
    });

    it('refuses a row of another version', async () => {
      curriculumItem.findMany.mockResolvedValue([item({ versionId: 'v9' })]);
      await expect(
        service.assignItems('g1', { itemIds: ['a'] }, R1),
      ).rejects.toMatchObject({ code: 'ITEM_NOT_IN_VERSION' });
    });

    it('refuses an unknown row id', async () => {
      curriculumItem.findMany.mockResolvedValue([]);
      await expect(
        service.assignItems('g1', { itemIds: ['ghost'] }, R1),
      ).rejects.toMatchObject({ code: 'ITEM_NOT_IN_VERSION' });
    });

    it('ungroups the rows that left and groups the rows that joined', async () => {
      curriculumItem.findMany.mockResolvedValue([
        item({ id: 'a' }),
        item({ id: 'b', electiveGroupId: 'g1' }),
      ]);
      await service.assignItems('g1', { itemIds: ['a', 'b'] }, R1);
      expect(curriculumItem.updateMany.mock.calls).toEqual([
        [
          {
            where: { electiveGroupId: 'g1', id: { notIn: ['a', 'b'] } },
            data: { electiveGroupId: null },
          },
        ],
        [
          {
            where: { id: { in: ['a', 'b'] } },
            data: { electiveGroupId: 'g1' },
          },
        ],
      ]);
    });

    it('ungroups every member for an empty list', async () => {
      await service.assignItems('g1', { itemIds: [] }, R1);
      expect(curriculumItem.updateMany.mock.calls[0][0]).toEqual({
        where: { electiveGroupId: 'g1', id: { notIn: [] } },
        data: { electiveGroupId: null },
      });
    });

    it('reports the listed credits of the new members', async () => {
      curriculumItem.findMany.mockResolvedValue([
        item({ id: 'a' }),
        item({ id: 'b' }),
      ]);
      electiveGroup.findUniqueOrThrow.mockResolvedValue(
        groupRow({
          items: [
            { id: 'a', course: { credits: dec('2.5') } },
            { id: 'b', course: { credits: dec('3.5') } },
          ],
        }),
      );
      const result = await service.assignItems(
        'g1',
        { itemIds: ['a', 'b'] },
        R1,
      );
      expect(result).toMatchObject({
        itemIds: ['a', 'b'],
        listedCredits: '6',
        itemCount: 2,
      });
    });

    it('is program-level: R4 is out of scope', async () => {
      await expect(
        service.assignItems('g1', { itemIds: [] }, R4),
      ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
    });
  });

  describe('remove', () => {
    it('deletes the group and leaves its rows to the database SetNull', async () => {
      await service.remove('g1', R1);
      expect(electiveGroup.delete).toHaveBeenCalledWith({
        where: { id: 'g1' },
      });
      expect(curriculumItem.updateMany).not.toHaveBeenCalled();
    });
  });
});
