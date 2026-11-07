import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DegreeLevel,
  Prisma,
  ProgramStatus,
  ProgramVersionStatus,
  ScopeSource,
  ScopeType,
} from '../../generated/prisma/client.js';
import {
  AccessContext,
  type ActiveAssignment,
} from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { HOME_FACULTY_CODE } from '../../shared/org-units/home-faculty.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { VersionContentCopier } from '../../shared/programs/version-content.copier.js';
import { ProgramCloneService } from './program-clone.service.js';
import type { ProgramRow, VersionInfoRow } from './program.dto.js';
import type { ProgramsService } from './programs.service.js';

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
    programIds: new Set(),
    studentIds: new Set(),
  },
  permissions: new Map([
    [PERMISSIONS.PROGRAM_CLONE, { mode: 'DIRECT', scope: 'ALL' }],
  ]),
};
const R1 = new AccessContext('user', [assignment]);

describe('ProgramCloneService', () => {
  let program: Record<'findUnique' | 'create', ReturnType<typeof vi.fn>>;
  let copier: { copy: ReturnType<typeof vi.fn> };
  let programs: { detailOf: ReturnType<typeof vi.fn> };
  let service: ProgramCloneService;

  beforeEach(() => {
    program = {
      findUnique: vi.fn().mockResolvedValue(row()),
      create: vi.fn().mockResolvedValue({ id: 'p2', versions: [{ id: 'v2' }] }),
    };
    copier = { copy: vi.fn().mockResolvedValue(undefined) };
    programs = { detailOf: vi.fn().mockResolvedValue({ id: 'p2' }) };
    const client: Record<string, unknown> = { program };
    client.$transaction = (work: (tx: unknown) => Promise<unknown>) =>
      work(client);
    service = new ProgramCloneService(
      client as unknown as PrismaService,
      copier as unknown as VersionContentCopier,
      programs as unknown as ProgramsService,
    );
  });

  describe('clone', () => {
    const OLD_ACTIVE = version({
      id: 'active',
      versionNumber: '1.0',
      status: ProgramVersionStatus.ACTIVE,
      semesterCount: 9,
    });

    beforeEach(() => {
      program.create.mockResolvedValue({ id: 'p2', versions: [{ id: 'new' }] });
    });

    it('copies the Active version by default and records it as the source', async () => {
      program.findUnique.mockResolvedValue(
        row({ versions: [version({ id: 'draft' }), OLD_ACTIVE] }),
      );
      await service.clone(
        'p1',
        { programCode: '1024035', programName: 'Bản sao' },
        R1,
      );
      const data = program.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        programCode: '1024035',
        facultyId: FACULTY.id,
        degreeLevel: DegreeLevel.ENGINEER,
        clonedFromId: 'active',
      });
      expect(data.versions.create).toMatchObject({
        programName: 'Bản sao',
        semesterCount: 9,
      });
    });

    it('falls back to the newest version when none is Active', async () => {
      await service.clone(
        'p1',
        { programCode: '1024035', programName: 'Bản sao' },
        R1,
      );
      expect(program.create.mock.calls[0][0].data.clonedFromId).toBe('v1');
    });

    it('takes the version the caller picked', async () => {
      program.findUnique.mockResolvedValue(
        row({ versions: [version({ id: 'draft' }), OLD_ACTIVE] }),
      );
      await service.clone(
        'p1',
        {
          programCode: '1024035',
          programName: 'Bản sao',
          sourceVersionId: 'draft',
        },
        R1,
      );
      expect(program.create.mock.calls[0][0].data.clonedFromId).toBe('draft');
    });

    it('refuses a version of another program', async () => {
      await expect(
        service.clone(
          'p1',
          {
            programCode: '1024035',
            programName: 'Bản sao',
            sourceVersionId: 'foreign',
          },
          R1,
        ),
      ).rejects.toMatchObject({ code: 'SOURCE_VERSION_INVALID' });
      expect(program.create).not.toHaveBeenCalled();
    });

    it('calls the copier with the source version and the new Draft, leaving the release facts behind', async () => {
      await service.clone(
        'p1',
        { programCode: '1024035', programName: 'Bản sao' },
        R1,
      );
      expect(copier.copy).toHaveBeenCalledWith(expect.anything(), 'v1', 'new', {
        carryRelease: false,
      });
    });

    it('maps a duplicate code to PROGRAM_CODE_TAKEN', async () => {
      program.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      await expect(
        service.clone(
          'p1',
          { programCode: '1024034', programName: 'Bản sao' },
          R1,
        ),
      ).rejects.toMatchObject({ code: 'PROGRAM_CODE_TAKEN' });
      expect(copier.copy).not.toHaveBeenCalled();
    });
  });
});
