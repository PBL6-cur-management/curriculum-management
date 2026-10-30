import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Prisma,
  ScopeSource,
  ScopeType,
} from '../../generated/prisma/client.js';
import {
  AccessContext,
  type ActiveAssignment,
} from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import type { VersionActivator } from '../../shared/releases/version.activator.js';
import { SemestersService } from './semesters.service.js';

function holder(
  cell: { mode: 'DIRECT' | 'VIA_REQUEST'; scope: 'ALL' | 'SCOPED' } | null,
) {
  const assignment: ActiveAssignment = {
    assignmentId: null,
    roleId: 'r',
    roleCode: 'R',
    roleName: 'R',
    scopeSource: ScopeSource.NONE,
    scopeType: ScopeType.SYSTEM,
    scopeUnit: null,
    scope: { all: true },
    permissions: new Map(cell ? [[PERMISSIONS.SEMESTER_MANAGE, cell]] : []),
  };
  return new AccessContext('u', [assignment]);
}

const R1 = holder({ mode: 'DIRECT', scope: 'ALL' });
const R3 = holder({ mode: 'VIA_REQUEST', scope: 'SCOPED' });
const unique = () =>
  new Prisma.PrismaClientKnownRequestError('dup', {
    code: 'P2002',
    clientVersion: 'test',
  });

describe('SemestersService', () => {
  let semester: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let programVersion: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  let cohort: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let activate: ReturnType<typeof vi.fn>;
  let programEnrollment: { count: ReturnType<typeof vi.fn> };
  let queryRaw: ReturnType<typeof vi.fn>;
  let service: SemestersService;
  const current = {
    id: 's1',
    semesterCode: '2026-2027-2',
    academicYear: '2026-2027',
    termInYear: 2,
    startDate: new Date('2027-01-18T00:00:00.000Z'),
  };

  beforeEach(() => {
    semester = {
      findMany: vi.fn().mockResolvedValue([current]),
      findUnique: vi.fn().mockResolvedValue(current),
      create: vi.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'new', ...args.data }),
      ),
      update: vi.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...current, ...args.data }),
      ),
    };
    programVersion = {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    };
    cohort = {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'k1', ...args.data }),
      ),
      update: vi.fn(),
    };
    activate = vi.fn().mockResolvedValue(true);
    programEnrollment = { count: vi.fn().mockResolvedValue(0) };
    queryRaw = vi.fn().mockResolvedValue([]);
    const db = {
      semester,
      programVersion,
      programEnrollment,
      cohort,
      $queryRaw: queryRaw,
    };
    const prisma = {
      ...db,
      $transaction: vi.fn((run: (tx: unknown) => unknown) => run(db)),
    };
    service = new SemestersService(
      prisma as unknown as PrismaService,
      { activate } as unknown as VersionActivator,
    );
  });

  it('lists semesters newest year first, as calendar days', async () => {
    expect(await service.listSemesters()).toEqual([
      {
        id: 's1',
        semesterCode: '2026-2027-2',
        academicYear: '2026-2027',
        termInYear: 2,
        startDate: '2027-01-18',
      },
    ]);
    expect(semester.findMany.mock.calls[0][0].orderBy).toEqual([
      { academicYear: 'desc' },
      { termInYear: 'asc' },
    ]);
  });

  it('lets only an unscoped direct holder manage semesters and cohorts', async () => {
    for (const run of [
      () =>
        service.createSemester(
          { semesterCode: 'x', academicYear: 'y', termInYear: 1 },
          R3,
        ),
      () => service.updateSemester('s1', { termInYear: 2 }, R3),
      () => service.createCohort({ cohortCode: 'K1', intakeYear: 2026 }, R3),
      () => service.updateCohort('k1', { intakeYear: 2027 }, R3),
    ]) {
      await expect(run()).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    }
    expect(semester.create).not.toHaveBeenCalled();
  });

  it('stores a start date as a calendar day and allows none yet (blank date)', async () => {
    await service.createSemester(
      {
        semesterCode: 'A',
        academicYear: '2027-2028',
        termInYear: 1,
        startDate: '2027-09-06',
      },
      R1,
    );
    expect(semester.create.mock.calls[0][0].data.startDate).toEqual(
      new Date('2027-09-06T00:00:00.000Z'),
    );
    await service.createSemester(
      { semesterCode: 'B', academicYear: '2027-2028', termInYear: 2 },
      R1,
    );
    expect(semester.create.mock.calls[1][0].data.startDate).toBeNull();
  });

  it('maps a duplicate code or year-term to SEMESTER_EXISTS and a duplicate cohort to COHORT_EXISTS', async () => {
    semester.create.mockRejectedValue(unique());
    await expect(
      service.createSemester(
        { semesterCode: 'A', academicYear: 'y', termInYear: 1 },
        R1,
      ),
    ).rejects.toMatchObject({ code: 'SEMESTER_EXISTS' });
    cohort.create.mockRejectedValue(unique());
    await expect(
      service.createCohort({ cohortCode: 'K1', intakeYear: 2026 }, R1),
    ).rejects.toMatchObject({ code: 'COHORT_EXISTS' });
  });

  describe('updateSemester', () => {
    it('locks the semester row before it reads or writes', async () => {
      await service.updateSemester('s1', { semesterCode: 'Mới' }, R1);

      expect(queryRaw).toHaveBeenCalledTimes(1);
    });

    it('refuses a new start date once an Active or Historical version stands on the semester', async () => {
      programVersion.count.mockResolvedValue(1);

      await expect(
        service.updateSemester('s1', { startDate: '2027-01-25' }, R1),
      ).rejects.toMatchObject({ code: 'SEMESTER_IN_USE' });
      expect(programVersion.count.mock.calls[0][0].where.status).toEqual({
        in: ['ACTIVE', 'HISTORICAL'],
      });
      expect(semester.update).not.toHaveBeenCalled();
    });

    it('lets the same date through and other fields change even when a version stands on it', async () => {
      programVersion.count.mockResolvedValue(1);

      await service.updateSemester('s1', { startDate: '2027-01-18' }, R1);
      await service.updateSemester('s1', { academicYear: '2026-2027' }, R1);

      expect(semester.update).toHaveBeenCalledTimes(2);
    });

    it.each(['fromSemesterId', 'untilSemesterId'] as const)(
      'refuses changing or clearing an enrollment %s boundary',
      async (boundary) => {
        programEnrollment.count.mockImplementation(
          async (input: { where: { OR: Record<string, string>[] } }) =>
            input.where.OR.some((clause) => clause[boundary] === 's1') ? 1 : 0,
        );

        for (const startDate of ['2027-01-25', null]) {
          await expect(
            service.updateSemester('s1', { startDate }, R1),
          ).rejects.toMatchObject({ code: 'SEMESTER_IN_USE' });
        }
        expect(programEnrollment.count).toHaveBeenCalledWith({
          where: {
            OR: [{ fromSemesterId: 's1' }, { untilSemesterId: 's1' }],
          },
        });
        expect(semester.update).not.toHaveBeenCalled();
        expect(activate).not.toHaveBeenCalled();
      },
    );

    it('permits unchanged dates and metadata edits for an enrollment boundary', async () => {
      programEnrollment.count.mockResolvedValue(1);
      await service.updateSemester('s1', { startDate: '2027-01-18' }, R1);
      await service.updateSemester('s1', { academicYear: '2026-2027' }, R1);
      expect(programEnrollment.count).not.toHaveBeenCalled();
      expect(semester.update).toHaveBeenCalledTimes(2);
    });

    it('moves the date of a semester only Pending versions wait on, and activates those it has now reached', async () => {
      programVersion.findMany.mockResolvedValue([{ id: 'v1' }, { id: 'v2' }]);

      await service.updateSemester('s1', { startDate: '2020-01-01' }, R1);

      expect(activate.mock.calls.map((call) => call[1])).toEqual(['v1', 'v2']);
    });

    it('answers SEMESTER_NOT_FOUND for an unknown id', async () => {
      semester.findUnique.mockResolvedValue(null);

      await expect(service.updateSemester('x', {}, R1)).rejects.toMatchObject({
        code: 'SEMESTER_NOT_FOUND',
      });
    });
  });

  it('answers COHORT_NOT_FOUND when updating a cohort that is gone', async () => {
    cohort.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('gone', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.updateCohort('x', { intakeYear: 2027 }, R1),
    ).rejects.toMatchObject({ code: 'COHORT_NOT_FOUND' });
  });
});
