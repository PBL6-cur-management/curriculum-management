import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CourseStatus,
  Prisma,
  ScopeSource,
  ScopeType,
  SyllabusStatus,
} from '../../generated/prisma/client.js';
import {
  AccessContext,
  type ActiveAssignment,
  type PermissionGrant,
} from '../../shared/authz/access-context.js';
import {
  PERMISSIONS,
  type PermissionCode,
} from '../../shared/authz/permission-codes.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import { toCloDto } from './clo.dto.js';
import { ClosService } from './clos.service.js';

function holder(
  orgUnitIds: string[],
  permissions: PermissionCode[],
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
      orgUnitIds: new Set(orgUnitIds),
      subjectGroupIds: new Set(subjectGroupIds),
      programIds: new Set(),
      studentIds: new Set(),
    },
    permissions: new Map<PermissionCode, PermissionGrant>([
      ...permissions.map((code): [PermissionCode, PermissionGrant] => [
        code,
        { mode: 'DIRECT', scope: 'SCOPED' },
      ]),
      [PERMISSIONS.PROGRAM_VIEW, { mode: 'DIRECT', scope: 'ALL' }],
    ]),
  };
  return new AccessContext('user', [assignment]);
}

const R3 = holder(['home'], [PERMISSIONS.CLO_EDIT]);
const R2 = holder(['home'], [PERMISSIONS.SYLLABUS_EDIT]);
const OUTSIDER = holder(['other'], [PERMISSIONS.CLO_EDIT]);

function accessRow(status: SyllabusStatus) {
  return {
    id: 's1',
    status,
    courseId: 'c1',
    course: {
      id: 'c1',
      courseCode: 'IT001',
      courseName: 'Nhập môn',
      englishName: null,
      credits: new Prisma.Decimal('3'),
      status: CourseStatus.ACTIVE,
      ownerFacultyId: 'home',
      ownerGroupId: null,
      ownerFaculty: { unitCode: 'KHOA_CNTT' },
    },
  };
}

function cloRow(
  id: string,
  sortOrder: number,
  programs: string[] = [],
  assessmentLinks = 0,
) {
  return {
    id,
    syllabusId: 's1',
    cloCode: id.toUpperCase(),
    description: 'Mô tả',
    englishDescription: null,
    cognitiveLevel: null,
    sortOrder,
    _count: { assessmentLinks: assessmentLinks },
    ploLinks: programs.map((programCode) => ({
      coursePlo: {
        curriculumItem: { version: { program: { programCode } } },
      },
    })),
  };
}

describe('ClosService', () => {
  let prisma: {
    syllabus: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    cLO: Record<
      'findUnique' | 'findMany' | 'count' | 'create' | 'update' | 'delete',
      ReturnType<typeof vi.fn>
    >;
    $transaction: ReturnType<typeof vi.fn>;
    $queryRaw: ReturnType<typeof vi.fn>;
  };
  let service: ClosService;

  beforeEach(() => {
    prisma = {
      syllabus: {
        findUnique: vi.fn().mockResolvedValue(accessRow(SyllabusStatus.DRAFT)),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
      },
      cLO: {
        findUnique: vi.fn().mockResolvedValue({
          syllabusId: 's1',
          syllabus: accessRow(SyllabusStatus.DRAFT),
        }),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(({ data }: { data: { sortOrder: number } }) =>
          Promise.resolve(cloRow('new', data.sortOrder)),
        ),
        update: vi.fn().mockResolvedValue(cloRow('c1', 1)),
        delete: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn(),
      $queryRaw: vi.fn().mockResolvedValue([]),
    };
    prisma.$transaction.mockImplementation((run: (tx: unknown) => unknown) =>
      run(prisma),
    );
    service = new ClosService(prisma as unknown as PrismaService);
  });

  const input = { cloCode: 'CLO1', description: 'Giải thích được' };

  it('appends the CLO last and touches the syllabus', async () => {
    prisma.cLO.count.mockResolvedValue(2);

    await service.create('s1', input, R3);

    expect(prisma.cLO.create.mock.calls[0][0].data).toMatchObject({
      syllabusId: 's1',
      cloCode: 'CLO1',
      sortOrder: 3,
      englishDescription: null,
      cognitiveLevel: null,
    });
    expect(prisma.syllabus.update).toHaveBeenCalled();
  });

  it('maps a duplicate code to CLO_CODE_TAKEN on cloCode', async () => {
    prisma.cLO.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
      }),
    );

    await expect(service.create('s1', input, R3)).rejects.toMatchObject({
      code: 'CLO_CODE_TAKEN',
      details: [{ field: 'cloCode' }],
    });
  });

  it('refuses the 31st CLO', async () => {
    prisma.cLO.count.mockResolvedValue(30);

    await expect(service.create('s1', input, R3)).rejects.toMatchObject({
      code: 'SYLLABUS_CLOS_LIMIT',
    });
    expect(prisma.cLO.create).not.toHaveBeenCalled();
  });

  it('refuses a holder outside the course scope', async () => {
    await expect(service.create('s1', input, OUTSIDER)).rejects.toMatchObject({
      code: 'OUT_OF_SCOPE',
    });
  });

  it('refuses a caller who only holds syllabus.edit', async () => {
    await expect(service.create('s1', input, R2)).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
  });

  it('asks for a change request on a published revision', async () => {
    prisma.syllabus.findUnique.mockResolvedValue(
      accessRow(SyllabusStatus.PUBLISHED),
    );
    prisma.syllabus.findFirst.mockResolvedValue({ id: 's1' });

    await expect(service.create('s1', input, R3)).rejects.toMatchObject({
      code: 'CHANGE_REQUEST_REQUIRED',
    });
  });

  it('writes only the fields sent on update', async () => {
    await service.update('c1', { description: 'Mới' }, R3);

    expect(prisma.cLO.update.mock.calls[0][0].data).toEqual({
      description: 'Mới',
    });
  });

  it('is not found for an unknown CLO', async () => {
    prisma.cLO.findUnique.mockResolvedValue(null);

    await expect(service.remove('nope', R3)).rejects.toMatchObject({
      code: 'CLO_NOT_FOUND',
    });
  });

  it('closes the gap after deleting the middle of three', async () => {
    prisma.cLO.findMany.mockResolvedValue([{ id: 'a' }, { id: 'c' }]);

    await service.remove('b', R3);

    expect(prisma.cLO.update.mock.calls.map(([arg]) => arg)).toEqual([
      { where: { id: 'a' }, data: { sortOrder: 1 } },
      { where: { id: 'c' }, data: { sortOrder: 2 } },
    ]);
  });

  describe('reorder', () => {
    it('numbers the CLOs in the order given', async () => {
      prisma.cLO.findMany
        .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])
        .mockResolvedValue([cloRow('b', 1), cloRow('a', 2)]);

      const result = await service.reorder('s1', { ids: ['b', 'a'] }, R3);

      expect(result.map((row) => row.id)).toEqual(['b', 'a']);
    });

    it('refuses a list that does not match the rows', async () => {
      prisma.cLO.findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]);

      await expect(
        service.reorder('s1', { ids: ['a', 'z'] }, R3),
      ).rejects.toMatchObject({ code: 'SYLLABUS_ORDER_MISMATCH' });
    });
  });

  it('reports how many assessment components assess the CLO', () => {
    expect(toCloDto(cloRow('c1', 1, [], 2) as never).assessmentLinkCount).toBe(
      2,
    );
  });

  it('takes the revision lock before judging a CLO write', async () => {
    await service.create('s1', input, R3);

    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('lists each linked program once, sorted', () => {
    expect(
      toCloDto(cloRow('c1', 1, ['B', 'A', 'A']) as never).linkedPrograms,
    ).toEqual(['A', 'B']);
  });
});
