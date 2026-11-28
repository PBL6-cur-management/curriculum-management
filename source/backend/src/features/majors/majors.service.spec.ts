import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  MajorStatus,
  OrgUnitStatus,
  OrgUnitType,
  Prisma,
} from '../../generated/prisma/client.js';
import {
  AccessContext,
  type ActiveAssignment,
} from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import { MajorsService } from './majors.service.js';

const NOW = new Date('2026-11-28T00:00:00Z');
const R1 = new AccessContext('admin', [
  {
    assignmentId: 'a1',
    roleId: 'r1',
    roleCode: 'R1',
    scopeType: 'SYSTEM',
    scopeUnitId: null,
    scope: { orgUnitIds: [], programIds: [], subjectGroupIds: [] },
    permissions: new Map([
      [PERMISSIONS.PROGRAM_EDIT_INFO, { mode: 'DIRECT', scope: 'ALL' }],
      [PERMISSIONS.PROGRAM_VIEW, { mode: 'DIRECT', scope: 'ALL' }],
    ]),
  } as unknown as ActiveAssignment,
]);

const majorRow = (patch: Record<string, unknown> = {}) => ({
  id: 'm1',
  majorCode: '7480201',
  majorName: 'Công nghệ Thông tin',
  englishName: 'Information Technology',
  degreeGroup: 'CD01',
  facultyId: 'f1',
  faculty: { id: 'f1', unitCode: 'KHOA_CNTT', unitName: 'Khoa Công nghệ Thông tin' },
  status: MajorStatus.ACTIVE,
  _count: { programs: 4 },
  createdAt: NOW,
  updatedAt: NOW,
  ...patch,
});

describe('MajorsService', () => {
  let major: Record<string, ReturnType<typeof vi.fn>>;
  let orgUnit: Record<string, ReturnType<typeof vi.fn>>;
  let service: MajorsService;

  beforeEach(() => {
    major = {
      findMany: vi.fn().mockResolvedValue([majorRow()]),
      count: vi.fn().mockResolvedValue(1),
      findUnique: vi.fn().mockResolvedValue(majorRow()),
      create: vi.fn().mockResolvedValue(majorRow()),
      update: vi.fn().mockResolvedValue(majorRow()),
    };
    orgUnit = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'f1',
        unitType: OrgUnitType.FACULTY,
        status: OrgUnitStatus.ACTIVE,
      }),
    };
    const prisma = {
      major,
      orgUnit,
      $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
    };
    service = new MajorsService(prisma as unknown as PrismaService);
  });

  it('lists majors with pagination and filters', async () => {
    const page = await service.list({ page: 1, pageSize: 20, q: '748' });
    expect(page.total).toBe(1);
    expect(page.items[0]?.majorCode).toBe('7480201');
    expect(page.items[0]?.programCount).toBe(4);
  });

  it('creates a major and maps duplicate code to 409', async () => {
    const created = await service.create(
      { majorCode: '7480201', majorName: 'Công nghệ Thông tin', facultyId: 'f1' },
      R1,
    );
    expect(created.majorCode).toBe('7480201');

    major.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.create({ majorCode: '7480201', majorName: 'Dup' }, R1),
    ).rejects.toMatchObject({ code: 'MAJOR_CODE_TAKEN' });
  });

  it('rejects unchanged status transition', async () => {
    await expect(
      service.setStatus('m1', MajorStatus.ACTIVE, R1),
    ).rejects.toMatchObject({ code: 'MAJOR_STATUS_UNCHANGED' });
  });
});
