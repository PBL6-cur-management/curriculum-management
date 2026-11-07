import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DegreeLevel,
  OrgUnitStatus,
  OrgUnitType,
  Prisma,
  ProgramStatus,
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
import { HOME_FACULTY_CODE } from '../../shared/org-units/home-faculty.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { CurriculumFactsReader } from '../../shared/curriculum/curriculum-facts.reader.js';
import { activeDirectorWhere } from '../../shared/programs/active-director.js';
import { todayDate } from '../../shared/time/today.js';
import { releaseYearWhere } from './program-release-year.js';
import type { CreateProgramDto } from './create-program.dto.js';
import { ProgramQueryDto } from './program-query.dto.js';
import type { ProgramRow, VersionInfoRow } from './program.dto.js';
import { ProgramsService } from './programs.service.js';

const NOW = new Date('2026-10-19T00:00:00.000Z');
const FACULTY = {
  id: 'home',
  unitCode: HOME_FACULTY_CODE,
  unitName: 'Khoa CNTT',
};

function version(patch: Partial<VersionInfoRow> = {}): VersionInfoRow {
  return {
    id: 'v1',
    versionNumber: null,
    status: ProgramVersionStatus.DRAFT,
    programName: 'Kỹ thuật máy tính',
    majorCode: '7480106',
    majorName: 'Kỹ thuật máy tính',
    semesterCount: 10,
    totalCredits: new Prisma.Decimal('150'),
    compulsoryCredits: new Prisma.Decimal('140'),
    electiveCredits: new Prisma.Decimal('10'),
    updatedAt: NOW,
    signedDate: null,
    publishedAt: null,
    cohortVersions: [],
    ...patch,
  };
}

function row(patch: Partial<ProgramRow> = {}): ProgramRow {
  return {
    id: 'p1',
    programCode: '1024034',
    facultyId: FACULTY.id,
    faculty: FACULTY,
    degreeLevel: DegreeLevel.ENGINEER,
    status: ProgramStatus.ACTIVE,
    clonedFromId: null,
    clonedFrom: null,
    versions: [version()],
    directors: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...patch,
  };
}

interface Cell {
  code: PermissionCode;
  mode: PermissionMode;
  all?: boolean;
}

function access(cells: Cell[], programIds: string[] = []): AccessContext {
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
      subjectGroupIds: new Set(),
      programIds: new Set(programIds),
      studentIds: new Set(),
    },
    permissions: new Map(
      cells.map((cell) => [
        cell.code,
        {
          mode: cell.mode,
          scope: cell.all ? ('ALL' as const) : ('SCOPED' as const),
        },
      ]),
    ),
  };
  return new AccessContext('user', [assignment]);
}

const R1 = access([
  { code: PERMISSIONS.PROGRAM_VIEW, mode: 'DIRECT', all: true },
  { code: PERMISSIONS.PROGRAM_EDIT_INFO, mode: 'DIRECT', all: true },
  { code: PERMISSIONS.PROGRAM_CLONE, mode: 'DIRECT', all: true },
  { code: PERMISSIONS.DIRECTOR_ASSIGN, mode: 'DIRECT', all: true },
]);
const r3Directing = (programIds: string[]) =>
  access(
    [
      { code: PERMISSIONS.PROGRAM_VIEW, mode: 'DIRECT', all: true },
      { code: PERMISSIONS.PROGRAM_EDIT_INFO, mode: 'DIRECT' },
    ],
    programIds,
  );
const R6 = access([{ code: PERMISSIONS.PROGRAM_VIEW, mode: 'DIRECT' }]);

const CREATE = {
  programCode: '9999999',
  degreeLevel: DegreeLevel.BACHELOR,
  programName: 'Công nghệ thông tin',
  majorCode: '7480201',
  majorName: 'Công nghệ thông tin',
  semesterCount: 8,
  totalCredits: '120',
  compulsoryCredits: '110',
  electiveCredits: '10',
} satisfies CreateProgramDto;

function query(patch: Partial<ProgramQueryDto> = {}): ProgramQueryDto {
  return Object.assign(new ProgramQueryDto(), patch);
}

describe('ProgramsService', () => {
  let program: Record<
    'findMany' | 'findUnique' | 'count' | 'create' | 'update',
    ReturnType<typeof vi.fn>
  >;
  let programVersion: Record<'findFirst' | 'update', ReturnType<typeof vi.fn>>;
  let orgUnit: { findUnique: ReturnType<typeof vi.fn> };
  let curriculumFacts: { maxPlannedSemester: ReturnType<typeof vi.fn> };
  let service: ProgramsService;

  beforeEach(() => {
    program = {
      findMany: vi.fn().mockResolvedValue([row()]),
      findUnique: vi.fn().mockResolvedValue(row()),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue({ id: 'p1', versions: [{ id: 'v1' }] }),
      update: vi.fn().mockResolvedValue({}),
    };
    programVersion = {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    };
    orgUnit = {
      findUnique: vi.fn().mockResolvedValue({
        id: FACULTY.id,
        unitType: OrgUnitType.FACULTY,
        status: OrgUnitStatus.ACTIVE,
      }),
    };
    curriculumFacts = {
      maxPlannedSemester: vi.fn().mockResolvedValue(null),
    };
    const client: Record<string, unknown> = {
      program,
      programVersion,
      orgUnit,
    };
    client.$transaction = (work: unknown) =>
      typeof work === 'function'
        ? (work as (tx: unknown) => Promise<unknown>)(client)
        : Promise.all(work as Promise<unknown>[]);
    service = new ProgramsService(
      client as unknown as PrismaService,
      curriculumFacts as unknown as CurriculumFactsReader,
    );
  });

  describe('list', () => {
    it('refuses a caller whose program.view is scoped, such as a student (US-018 AC3)', async () => {
      await expect(service.list(query(), R6)).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
      });
      expect(program.findMany).not.toHaveBeenCalled();
    });

    it('filters by level and status, and searches the code or any version name', async () => {
      await service.list(
        query({
          q: 'máy',
          degreeLevel: DegreeLevel.ENGINEER,
          status: ProgramStatus.ACTIVE,
        }),
        R1,
      );
      expect(program.findMany.mock.calls[0][0].where).toEqual({
        degreeLevel: DegreeLevel.ENGINEER,
        status: ProgramStatus.ACTIVE,
        OR: [
          { programCode: { contains: 'máy', mode: 'insensitive' } },
          {
            versions: {
              some: { programName: { contains: 'máy', mode: 'insensitive' } },
            },
          },
        ],
      });
    });

    it('filters by faculty', async () => {
      await service.list(query({ facultyId: 'f1' }), R1);
      expect(program.findMany.mock.calls[0][0].where).toEqual({
        facultyId: 'f1',
      });
    });

    it('filters release and intake year on the same released version', async () => {
      await service.list(query({ releaseYear: 2026, intakeYear: 2021 }), R1);
      expect(program.findMany.mock.calls[0][0].where).toEqual({
        versions: {
          some: {
            sourceRequestId: null,
            status: { in: ['PENDING', 'ACTIVE', 'HISTORICAL'] },
            AND: [
              releaseYearWhere(2026),
              { cohortVersions: { some: { cohort: { intakeYear: 2021 } } } },
            ],
          },
        },
      });
    });

    it('lists released versions only, with release year fallback and sorted deduped cohorts', async () => {
      const c21 = { id: 'c21', cohortCode: '21', intakeYear: 2021 };
      const c19 = { id: 'c19', cohortCode: '19', intakeYear: 2019 };
      program.findMany.mockResolvedValue([
        row({
          versions: [
            version({ id: 'd', status: ProgramVersionStatus.DRAFT }),
            version({
              id: 'v2',
              versionNumber: '2.0',
              status: ProgramVersionStatus.ACTIVE,
              publishedAt: new Date('2025-12-31T18:00:00.000Z'),
              cohortVersions: [
                { cohort: c21 },
                { cohort: c19 },
                { cohort: c21 },
              ],
            }),
            version({
              id: 'v1',
              versionNumber: '1.0',
              status: ProgramVersionStatus.HISTORICAL,
              signedDate: new Date('2020-05-01T00:00:00.000Z'),
              publishedAt: new Date('2025-01-01T00:00:00.000Z'),
            }),
            version({
              id: 'v0',
              versionNumber: '0.9',
              status: ProgramVersionStatus.PENDING,
            }),
          ],
        }),
      ]);
      const page = await service.list(query(), R1);
      expect(
        page.items[0].releasedVersions.map((v) => [v.id, v.releaseYear]),
      ).toEqual([
        ['v1', 2020],
        ['v2', 2026],
        ['v0', null],
      ]);
      expect(page.items[0].releasedVersions[1].cohorts).toEqual([c19, c21]);
      expect(page.items[0]).toMatchObject({
        majorCode: '7480106',
        majorName: 'Kỹ thuật máy tính',
      });
    });

    it('loads only the directors active today and pages by code', async () => {
      const page = await service.list(query({ page: 2, pageSize: 10 }), R1);
      const call = program.findMany.mock.calls[0][0];
      expect(call).toMatchObject({
        orderBy: { programCode: 'asc' },
        skip: 10,
        take: 10,
      });
      expect(call.include.directors.where).toEqual(
        activeDirectorWhere(todayDate()),
      );
      expect(page).toMatchObject({ total: 1, page: 2, pageSize: 10 });
      expect(page.items[0]).toMatchObject({
        programCode: '1024034',
        programName: 'Kỹ thuật máy tính',
        currentVersion: { versionNumber: null, status: 'DRAFT' },
        directors: [],
      });
    });

    it('shows the Active version as current when one exists', async () => {
      program.findMany.mockResolvedValue([
        row({
          versions: [
            version({ id: 'v2', status: ProgramVersionStatus.DRAFT }),
            version({
              id: 'v1',
              versionNumber: '1.0',
              status: ProgramVersionStatus.ACTIVE,
              programName: 'Bản hiện hành',
            }),
          ],
        }),
      ]);
      const page = await service.list(query(), R1);
      expect(page.items[0]).toMatchObject({
        programName: 'Bản hiện hành',
        currentVersion: { id: 'v1', versionNumber: '1.0' },
      });
    });
  });

  describe('detail', () => {
    it('reports editPath, canManage and canClone for R1', async () => {
      await expect(service.detail('p1', R1)).resolves.toMatchObject({
        editPath: 'DIRECT',
        canManage: true,
        canClone: true,
        draftVersion: { id: 'v1', totalCredits: '150' },
        clonedFrom: null,
      });
    });

    it('is direct for R3 on the program they direct and cannot manage', async () => {
      await expect(
        service.detail('p1', r3Directing(['p1'])),
      ).resolves.toMatchObject({
        editPath: 'DIRECT',
        canManage: false,
        canClone: false,
      });
    });

    it('reports VIA_REQUEST once any version has left Draft', async () => {
      programVersion.findFirst.mockResolvedValue({ id: 'v0' });
      await expect(service.detail('p1', R1)).resolves.toMatchObject({
        editPath: 'VIA_REQUEST',
      });
    });

    it('maps where the program was cloned from', async () => {
      program.findUnique.mockResolvedValue(
        row({
          clonedFromId: 'src',
          clonedFrom: {
            id: 'src',
            versionNumber: null,
            status: ProgramVersionStatus.DRAFT,
            program: { id: 'p0', programCode: '1024033' },
          },
        }),
      );
      const detail = await service.detail('p1', R1);
      expect(detail.clonedFrom).toEqual({
        programId: 'p0',
        programCode: '1024033',
        version: { id: 'src', versionNumber: null, status: 'DRAFT' },
      });
    });

    it('is not found for an unknown id, and out of scope for a student', async () => {
      program.findUnique.mockResolvedValueOnce(null);
      await expect(service.detail('nope', R1)).rejects.toMatchObject({
        code: 'PROGRAM_NOT_FOUND',
      });
      await expect(service.detail('p1', R6)).rejects.toMatchObject({
        code: 'OUT_OF_SCOPE',
      });
    });
  });

  describe('create', () => {
    it('writes the program with one Draft version in a single call (US-019 AC1)', async () => {
      await service.create(CREATE, R1);
      expect(orgUnit.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { unitCode: HOME_FACULTY_CODE } }),
      );
      expect(program.create).toHaveBeenCalledWith({
        data: {
          programCode: '9999999',
          facultyId: FACULTY.id,
          degreeLevel: DegreeLevel.BACHELOR,
          versions: {
            create: {
              programName: CREATE.programName,
              majorCode: CREATE.majorCode,
              majorName: CREATE.majorName,
              semesterCount: 8,
              totalCredits: '120',
              compulsoryCredits: '110',
              electiveCredits: '10',
            },
          },
        },
        select: { id: true },
      });
    });

    it('refuses 150 = 120 + 25 and names the gap (KB-011)', async () => {
      await expect(
        service.create(
          {
            ...CREATE,
            totalCredits: '150',
            compulsoryCredits: '120',
            electiveCredits: '25',
          },
          R1,
        ),
      ).rejects.toMatchObject({
        code: 'CREDITS_MISMATCH',
        message: expect.stringContaining('chênh lệch 5'),
      });
      expect(program.create).not.toHaveBeenCalled();
    });

    it('refuses R3, whose cell is scoped (R1 only)', async () => {
      await expect(
        service.create(CREATE, r3Directing(['p1'])),
      ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    });

    it('requires an active FACULTY unit', async () => {
      orgUnit.findUnique.mockResolvedValue({
        id: 'x',
        unitType: OrgUnitType.OFFICE,
        status: OrgUnitStatus.ACTIVE,
      });
      await expect(
        service.create({ ...CREATE, facultyId: 'x' }, R1),
      ).rejects.toMatchObject({ code: 'PROGRAM_FACULTY_INVALID' });
    });

    it('maps a duplicate code to PROGRAM_CODE_TAKEN', async () => {
      program.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      await expect(service.create(CREATE, R1)).rejects.toMatchObject({
        code: 'PROGRAM_CODE_TAKEN',
        details: [{ field: 'programCode', constraints: ['unique'] }],
      });
    });
  });

  describe('update', () => {
    it('updates the Draft for R3 on a program they direct, never released', async () => {
      await service.update(
        'p1',
        { programName: 'Tên mới' },
        r3Directing(['p1']),
      );
      expect(programVersion.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: expect.objectContaining({ programName: 'Tên mới' }),
      });
      expect(program.update).not.toHaveBeenCalled();
    });

    it('refuses R3 on a program they do not direct', async () => {
      await expect(
        service.update('p1', { programName: 'X' }, r3Directing(['other'])),
      ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
      expect(programVersion.update).not.toHaveBeenCalled();
    });

    it('needs a change request once a non-Draft version exists', async () => {
      programVersion.findFirst.mockResolvedValue({ id: 'v0' });
      await expect(
        service.update('p1', { programName: 'X' }, R1),
      ).rejects.toMatchObject({ code: 'CHANGE_REQUEST_REQUIRED' });
    });

    it('needs a change request when no Draft exists', async () => {
      program.findUnique.mockResolvedValue(
        row({
          versions: [
            version({
              status: ProgramVersionStatus.ACTIVE,
              versionNumber: '1',
            }),
          ],
        }),
      );
      await expect(
        service.update('p1', { programName: 'X' }, R1),
      ).rejects.toMatchObject({ code: 'CHANGE_REQUEST_REQUIRED' });
    });

    it('checks a lone elective change against the stored totals', async () => {
      await expect(
        service.update('p1', { electiveCredits: '12' }, R1),
      ).rejects.toMatchObject({
        code: 'CREDITS_MISMATCH',
        message: expect.stringContaining('chênh lệch 2'),
      });
      await expect(
        service.update(
          'p1',
          { compulsoryCredits: '130', electiveCredits: '20' },
          R1,
        ),
      ).resolves.toBeDefined();
    });

    it('refuses a semester count below a planned row, naming the semester (EC-08)', async () => {
      curriculumFacts.maxPlannedSemester.mockResolvedValue(8);
      await expect(
        service.update('p1', { semesterCount: 7 }, R1),
      ).rejects.toMatchObject({
        code: 'SEMESTERS_BELOW_CURRICULUM',
        message: expect.stringContaining('8'),
        details: [{ field: 'semesterCount' }],
      });
      expect(programVersion.update).not.toHaveBeenCalled();
      expect(curriculumFacts.maxPlannedSemester).toHaveBeenCalledWith('v1');
    });

    it('accepts a semester count that still covers the last planned row', async () => {
      curriculumFacts.maxPlannedSemester.mockResolvedValue(8);
      await expect(
        service.update('p1', { semesterCount: 8 }, R1),
      ).resolves.toBeDefined();
      expect(programVersion.update).toHaveBeenCalledOnce();
    });

    it('accepts any semester count while the curriculum is empty', async () => {
      await expect(
        service.update('p1', { semesterCount: 4 }, R1),
      ).resolves.toBeDefined();
    });

    it('does not read the curriculum when the semester count is not sent', async () => {
      curriculumFacts.maxPlannedSemester.mockResolvedValue(8);
      await service.update('p1', { programName: 'Tên mới' }, R1);
      expect(curriculumFacts.maxPlannedSemester).not.toHaveBeenCalled();
    });

    it('moves the degree level on the program in the same transaction', async () => {
      await service.update('p1', { degreeLevel: DegreeLevel.BACHELOR }, R1);
      expect(program.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { degreeLevel: DegreeLevel.BACHELOR },
      });
    });
  });

  describe('setStatus', () => {
    it('deactivates and reactivates for R1', async () => {
      await service.setStatus('p1', ProgramStatus.INACTIVE, R1);
      expect(program.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { status: ProgramStatus.INACTIVE },
      });
    });

    it('refuses the status it already has', async () => {
      await expect(
        service.setStatus('p1', ProgramStatus.ACTIVE, R1),
      ).rejects.toMatchObject({ code: 'PROGRAM_STATUS_UNCHANGED' });
    });

    it('refuses R3 even on a program they direct', async () => {
      await expect(
        service.setStatus('p1', ProgramStatus.INACTIVE, r3Directing(['p1'])),
      ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    });
  });
});
