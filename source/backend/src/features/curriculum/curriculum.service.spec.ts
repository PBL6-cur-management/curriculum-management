import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
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
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import type { VersionRow } from './curriculum-access.js';
import type { CurriculumReadService } from './curriculum-read.service.js';
import type { CurriculumRequisitesService } from './curriculum-requisites.service.js';
import { CurriculumService } from './curriculum.service.js';

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

interface Grant {
  mode: PermissionMode;
  all?: boolean;
}

function access(
  grant: Grant,
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
    permissions: new Map([
      [
        PERMISSIONS.CURRICULUM_EDIT,
        { mode: grant.mode, scope: grant.all ? 'ALL' : 'SCOPED' },
      ],
    ]),
  };
  return new AccessContext('user', [assignment]);
}

const R1 = access({ mode: 'DIRECT', all: true });
const r4Of = (groupId: string) =>
  access({ mode: 'VIA_REQUEST' }, { subjectGroupIds: [groupId] });

const COURSE = {
  id: 'c1',
  courseCode: 'IT001',
  status: CourseStatus.ACTIVE,
  ownerGroupId: 'G1',
};

const DTO = { courseId: 'c1', plannedSemester: 3, isElective: false };

describe('CurriculumService', () => {
  let curriculumItem: Record<
    'findFirst' | 'findMany' | 'create' | 'update' | 'delete' | 'aggregate',
    ReturnType<typeof vi.fn>
  >;
  let course: { findUnique: ReturnType<typeof vi.fn> };
  let programVersion: { findFirst: ReturnType<typeof vi.fn> };
  let reader: Record<
    'findVersion' | 'findItem' | 'itemDto',
    ReturnType<typeof vi.fn>
  >;
  let requisites: { seedFromCatalog: ReturnType<typeof vi.fn> };
  let service: CurriculumService;

  beforeEach(() => {
    curriculumItem = {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'i1' }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      aggregate: vi
        .fn()
        .mockResolvedValue({ _max: { sortOrder: null as number | null } }),
    };
    course = { findUnique: vi.fn().mockResolvedValue(COURSE) };
    programVersion = { findFirst: vi.fn().mockResolvedValue(null) };
    reader = {
      findVersion: vi.fn().mockResolvedValue(VERSION),
      findItem: vi.fn(),
      itemDto: vi.fn().mockResolvedValue({ id: 'i1' }),
    };
    requisites = { seedFromCatalog: vi.fn().mockResolvedValue(undefined) };
    const client: Record<string, unknown> = {
      curriculumItem,
      course,
      programVersion,
    };
    client.$transaction = (work: unknown) =>
      typeof work === 'function'
        ? (work as (tx: unknown) => Promise<unknown>)(client)
        : Promise.all(work as Promise<unknown>[]);
    service = new CurriculumService(
      client as unknown as PrismaService,
      reader as unknown as CurriculumReadService,
      requisites as unknown as CurriculumRequisitesService,
    );
  });

  describe('createItem', () => {
    it('puts the row last in its semester and seeds the requisites inside the transaction', async () => {
      curriculumItem.aggregate.mockResolvedValue({ _max: { sortOrder: 4 } });

      await service.createItem('v1', DTO, R1);

      expect(curriculumItem.create.mock.calls[0][0].data).toMatchObject({
        versionId: 'v1',
        courseId: 'c1',
        plannedSemester: 3,
        sortOrder: 5,
        blockSymbol: null,
        htDa: false,
        tqDa: false,
      });
      expect(requisites.seedFromCatalog).toHaveBeenCalledWith(
        expect.anything(),
        'i1',
        'c1',
      );
    });

    it('starts an empty semester at order 1', async () => {
      await service.createItem('v1', DTO, R1);
      expect(curriculumItem.create.mock.calls[0][0].data.sortOrder).toBe(1);
    });

    it('refuses a course already listed, naming its semester (KB-015)', async () => {
      curriculumItem.findFirst.mockResolvedValue({ plannedSemester: 3 });
      await expect(service.createItem('v1', DTO, R1)).rejects.toMatchObject({
        code: 'COURSE_ALREADY_IN_CURRICULUM',
        message: expect.stringMatching(/ở học kỳ 3\.$/),
      });
      expect(curriculumItem.create).not.toHaveBeenCalled();
    });

    it('maps the unique index of a lost race to the same error', async () => {
      curriculumItem.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      await expect(service.createItem('v1', DTO, R1)).rejects.toMatchObject({
        code: 'COURSE_ALREADY_IN_CURRICULUM',
      });
    });

    it('refuses semester 9 of 8 and names the count (KB-017)', async () => {
      await expect(
        service.createItem('v1', { ...DTO, plannedSemester: 9 }, R1),
      ).rejects.toMatchObject({
        code: 'SEMESTER_OUT_OF_RANGE',
        message: expect.stringContaining('8 học kỳ'),
        details: [{ field: 'plannedSemester' }],
      });
    });

    it('refuses a course that is not Active', async () => {
      course.findUnique.mockResolvedValue({
        ...COURSE,
        status: CourseStatus.DISCONTINUED,
      });
      await expect(service.createItem('v1', DTO, R1)).rejects.toMatchObject({
        code: 'COURSE_NOT_ACTIVE',
      });
    });

    it('refuses an unknown course', async () => {
      course.findUnique.mockResolvedValue(null);
      await expect(service.createItem('v1', DTO, R1)).rejects.toMatchObject({
        code: 'COURSE_NOT_FOUND',
      });
    });

    it('lets R4 of the course group add on a never-released program', async () => {
      await expect(
        service.createItem('v1', DTO, r4Of('G1')),
      ).resolves.toBeDefined();
    });

    it('refuses R4 on a course of another group (US-023 AC5)', async () => {
      await expect(
        service.createItem('v1', DTO, r4Of('H')),
      ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
      expect(curriculumItem.create).not.toHaveBeenCalled();
    });

    it('refuses a Pending version before any permission check', async () => {
      reader.findVersion.mockResolvedValue({
        ...VERSION,
        status: ProgramVersionStatus.PENDING,
      });
      await expect(
        service.createItem('v1', DTO, r4Of('H')),
      ).rejects.toMatchObject({ code: 'VERSION_NOT_EDITABLE' });
    });

    it('needs a change request once the program has been released', async () => {
      programVersion.findFirst.mockResolvedValue({ id: 'old' });
      await expect(service.createItem('v1', DTO, R1)).rejects.toMatchObject({
        code: 'CHANGE_REQUEST_REQUIRED',
      });
    });
  });

  describe('updateItem', () => {
    const ITEM = {
      id: 'i1',
      versionId: 'v1',
      courseId: 'c1',
      plannedSemester: 3,
      electiveGroupId: null as string | null,
      version: VERSION,
      course: { courseCode: 'IT001', ownerGroupId: 'G1' },
    };

    beforeEach(() => {
      reader.findItem.mockResolvedValue(ITEM);
    });

    it('refuses to make a grouped row compulsory', async () => {
      reader.findItem.mockResolvedValue({ ...ITEM, electiveGroupId: 'g' });
      await expect(
        service.updateItem('i1', { isElective: false }, R1),
      ).rejects.toMatchObject({ code: 'ITEM_IN_ELECTIVE_GROUP' });
    });

    it('puts a row moved to another semester last there', async () => {
      curriculumItem.aggregate.mockResolvedValue({ _max: { sortOrder: 6 } });
      await service.updateItem('i1', { plannedSemester: 5 }, R1);
      expect(curriculumItem.aggregate.mock.calls[0][0].where).toEqual({
        versionId: 'v1',
        plannedSemester: 5,
      });
      expect(curriculumItem.update.mock.calls[0][0].data).toMatchObject({
        plannedSemester: 5,
        sortOrder: 7,
      });
    });

    it('leaves the order alone when the semester does not change', async () => {
      await service.updateItem(
        'i1',
        { plannedSemester: 3, note: 'ghi chú' },
        R1,
      );
      expect(curriculumItem.aggregate).not.toHaveBeenCalled();
      expect(curriculumItem.update.mock.calls[0][0].data.sortOrder).toBe(
        undefined,
      );
    });

    it('refuses a move past the last semester', async () => {
      await expect(
        service.updateItem('i1', { plannedSemester: 9 }, R1),
      ).rejects.toMatchObject({ code: 'SEMESTER_OUT_OF_RANGE' });
    });

    it('refuses R4 on a course of another group', async () => {
      await expect(
        service.updateItem('i1', { note: 'x' }, r4Of('H')),
      ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
    });
  });

  describe('removeItem', () => {
    it('deletes the row of a Draft version', async () => {
      reader.findItem.mockResolvedValue({
        id: 'i1',
        versionId: 'v1',
        courseId: 'c1',
        plannedSemester: 3,
        electiveGroupId: null,
        version: VERSION,
        course: { courseCode: 'IT001', ownerGroupId: 'G1' },
      });
      await service.removeItem('i1', R1);
      expect(curriculumItem.delete).toHaveBeenCalledWith({
        where: { id: 'i1' },
      });
    });
  });

  describe('reorder', () => {
    it('rewrites 1..n in the given order', async () => {
      curriculumItem.findMany.mockResolvedValue([
        { id: 'a' },
        { id: 'b' },
        { id: 'c' },
      ]);
      await service.reorder(
        'v1',
        { plannedSemester: 1, itemIds: ['c', 'a', 'b'] },
        R1,
      );
      expect(
        curriculumItem.update.mock.calls.map(([call]) => [
          call.where.id,
          call.data.sortOrder,
        ]),
      ).toEqual([
        ['c', 1],
        ['a', 2],
        ['b', 3],
      ]);
    });

    it('refuses a list that misses a row of the semester', async () => {
      curriculumItem.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
      await expect(
        service.reorder('v1', { plannedSemester: 1, itemIds: ['a'] }, R1),
      ).rejects.toMatchObject({ code: 'CURRICULUM_ORDER_MISMATCH' });
      expect(curriculumItem.update).not.toHaveBeenCalled();
    });

    it('refuses a list with a row of another semester', async () => {
      curriculumItem.findMany.mockResolvedValue([{ id: 'a' }]);
      await expect(
        service.reorder('v1', { plannedSemester: 1, itemIds: ['x'] }, R1),
      ).rejects.toMatchObject({ code: 'CURRICULUM_ORDER_MISMATCH' });
    });

    it('is program-level: R4 is out of scope', async () => {
      await expect(
        service.reorder(
          'v1',
          { plannedSemester: 1, itemIds: ['a'] },
          r4Of('G1'),
        ),
      ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
    });
  });
});
