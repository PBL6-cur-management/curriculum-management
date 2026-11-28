import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Prisma,
  ScopeSource,
  ScopeType,
} from '../../generated/prisma/client.js';
import {
  AccessContext,
  type ActiveAssignment,
  type PermissionGrant,
} from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import {
  toVersionRef,
  VersionHistoryReader,
} from './version-history.reader.js';

const dec = (value: string) => new Prisma.Decimal(value);

function holder(
  grants: [string, PermissionGrant][],
  scope: { all: true } | { all: false; programIds: string[] } = { all: true },
) {
  const assignment: ActiveAssignment = {
    assignmentId: null,
    roleId: 'r',
    roleCode: 'R',
    roleName: 'R',
    scopeSource: ScopeSource.NONE,
    scopeType: ScopeType.SYSTEM,
    scopeUnit: null,
    scope: scope.all
      ? { all: true }
      : {
          all: false,
          orgUnitIds: new Set(),
          subjectGroupIds: new Set(),
          programIds: new Set(scope.programIds),
          studentIds: new Set(),
        },
    permissions: new Map(grants as never),
  };
  return new AccessContext('u', [assignment]);
}

const VIEW = [PERMISSIONS.PROGRAM_VIEW, { mode: 'DIRECT', scope: 'ALL' }] as [
  string,
  PermissionGrant,
];
const CORRECT = [
  PERMISSIONS.VERSION_CORRECT,
  { mode: 'DIRECT', scope: 'ALL' },
] as [string, PermissionGrant];
const R1 = holder([VIEW, CORRECT]);
const R2 = holder([VIEW]);
const STUDENT = holder(
  [[PERMISSIONS.PROGRAM_VIEW, { mode: 'DIRECT', scope: 'SCOPED' }]],
  { all: false, programIds: ['p1'] },
);

const semester = {
  id: 's1',
  semesterCode: '2026-2027-1',
  academicYear: '2026-2027',
  termInYear: 1,
  startDate: new Date('2026-09-07T00:00:00.000Z'),
};

function row(patch: Record<string, unknown> = {}) {
  return {
    id: 'v1',
    programId: 'p1',
    versionNumber: '1.0',
    status: 'ACTIVE',
    decisionNumber: 'QD-1',
    signedDate: new Date('2026-09-01T00:00:00.000Z'),
    publishedAt: new Date('2026-09-02T03:00:00.000Z'),
    effectiveSemester: semester,
    cohortVersions: [
      { cohort: { id: 'k1', cohortCode: 'K2026', intakeYear: 2026 } },
    ],
    originRequest: null,
    correctedBy: null,
    correctionOfId: null,
    programName: 'CT',
    majorCode: 'M',
    majorName: 'N',
    semesterCount: 8,
    totalCredits: dec('150'),
    compulsoryCredits: dec('140'),
    electiveCredits: dec('10'),
    publishedBy: { id: 'u1', fullName: 'Phòng Đào tạo' },
    previousVersion: null,
    correctionOf: null,
    correctionReason: null,
    curriculumItems: [
      {
        id: 'i1',
        courseId: 'c1',
        plannedSemester: 1,
        sortOrder: 1,
        syllabusId: 'old-rev',
        courseNameSnapshot: 'Tên khi ban hành',
        creditsSnapshot: dec('3'),
        course: {
          courseCode: 'IT1',
          courseName: 'Tên hiện tại',
          credits: dec('5'),
        },
      },
    ],
    ...patch,
  };
}

describe('VersionHistoryReader', () => {
  let programVersion: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  let reader: VersionHistoryReader;

  beforeEach(() => {
    programVersion = {
      findMany: vi.fn().mockResolvedValue([row()]),
      findFirst: vi.fn().mockResolvedValue(row()),
    };
    const prisma = {
      program: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'p1',
          programCode: '1024034',
          facultyId: 'f1',
        }),
      },
      programVersion,
      syllabus: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'old-rev',
            courseId: 'c1',
            revisionNumber: 1,
            status: 'HISTORICAL',
          },
        ]),
      },
    };
    reader = new VersionHistoryReader(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('lists issued versions and plain Drafts, never a working copy or an unissued correction', async () => {
      await reader.list('p1', R1);

      expect(programVersion.findMany.mock.calls[0][0].where).toEqual({
        programId: 'p1',
        sourceRequestId: null,
        NOT: { status: 'DRAFT', correctionOfId: { not: null } },
      });
    });

    it('shows a student issued versions only, and a staff reader the Draft too', async () => {
      await reader.list('p1', STUDENT);
      expect(programVersion.findMany.mock.calls[0][0].where.status).toEqual({
        not: 'DRAFT',
      });

      await reader.list('p1', R2);
      expect(
        programVersion.findMany.mock.calls[1][0].where.status,
      ).toBeUndefined();
    });

    it('maps a version with its decision, semester, cohorts and calendar dates', async () => {
      const { versions } = await reader.list('p1', R1);

      expect(versions[0]).toEqual({
        id: 'v1',
        versionNumber: '1.0',
        status: 'ACTIVE',
        decisionNumber: 'QD-1',
        signedDate: '2026-09-01',
        publishedAt: '2026-09-02T03:00:00.000Z',
        effectiveSemester: {
          id: 's1',
          semesterCode: '2026-2027-1',
          academicYear: '2026-2027',
          termInYear: 1,
          startDate: '2026-09-07',
        },
        cohorts: [{ id: 'k1', cohortCode: 'K2026', intakeYear: 2026 }],
        originRequest: null,
        correctedBy: null,
      });
    });

    it('answers PROGRAM_NOT_FOUND and the scope refusal before reading any version', async () => {
      const outsider = holder(
        [[PERMISSIONS.PROGRAM_VIEW, { mode: 'DIRECT', scope: 'SCOPED' }]],
        {
          all: false,
          programIds: ['other'],
        },
      );

      await expect(reader.list('p1', outsider)).rejects.toMatchObject({
        code: 'OUT_OF_SCOPE',
      });
      expect(programVersion.findMany).not.toHaveBeenCalled();
    });
  });

  describe('toVersionRef', () => {
    it('names the correction only once it is issued', () => {
      const draft = toVersionRef(
        row({
          correctedBy: { id: 'd', versionNumber: null, status: 'DRAFT' },
        }) as never,
      );
      const issued = toVersionRef(
        row({
          correctedBy: { id: 'c', versionNumber: '1.1', status: 'ACTIVE' },
        }) as never,
      );

      expect(draft.correctedBy).toBeNull();
      expect(issued.correctedBy).toEqual({ id: 'c', versionNumber: '1.1' });
    });

    it('carries the request a version came from', () => {
      const ref = toVersionRef(
        row({
          originRequest: { id: 'r1', requestCode: 'DX-2026-0007' },
        }) as never,
      );

      expect(ref.originRequest).toEqual({
        id: 'r1',
        requestCode: 'DX-2026-0007',
      });
    });
  });

  describe('detail', () => {
    it("shows the name and credits the version was released with and the revision it pins, not today's", async () => {
      const detail = await reader.detail('p1', 'v1', R2);

      expect(detail.rows).toEqual([
        {
          itemId: 'i1',
          plannedSemester: 1,
          courseId: 'c1',
          courseCode: 'IT1',
          courseName: 'Tên khi ban hành',
          credits: '3',
          syllabus: { id: 'old-rev', revisionNumber: 1, status: 'HISTORICAL' },
        },
      ]);
      expect(detail).toMatchObject({
        programCode: '1024034',
        totalCredits: '150',
        publishedBy: { fullName: 'Phòng Đào tạo' },
      });
    });

    it('lets only the academic office correct an Active or Pending version that has no issued correction', async () => {
      expect((await reader.detail('p1', 'v1', R1)).canCorrect).toBe(true);
      expect((await reader.detail('p1', 'v1', R2)).canCorrect).toBe(false);

      programVersion.findFirst.mockResolvedValue(
        row({
          correctedBy: { id: 'c', versionNumber: '1.1', status: 'ACTIVE' },
        }),
      );
      expect((await reader.detail('p1', 'v1', R1)).canCorrect).toBe(false);
      programVersion.findFirst.mockResolvedValue(
        row({ status: 'HISTORICAL', cohortVersions: [] }),
      );
      expect((await reader.detail('p1', 'v1', R1)).canCorrect).toBe(false);
      programVersion.findFirst.mockResolvedValue(row({ status: 'HISTORICAL' }));
      expect((await reader.detail('p1', 'v1', R1)).canCorrect).toBe(true);
    });

    it('offers R1 the open correction Draft to continue, and hides it from everyone else', async () => {
      programVersion.findFirst.mockResolvedValue(
        row({
          correctedBy: { id: 'd1', versionNumber: null, status: 'DRAFT' },
        }),
      );

      const mine = await reader.detail('p1', 'v1', R1);
      expect(mine.openCorrection).toEqual({ id: 'd1', versionNumber: null });
      expect(mine.canCorrect).toBe(true);
      expect((await reader.detail('p1', 'v1', R2)).openCorrection).toBeNull();
    });

    it('serves a correction Draft to R1 alone, and never a plain Draft', async () => {
      programVersion.findFirst.mockResolvedValue(
        row({
          status: 'DRAFT',
          versionNumber: null,
          correctionOfId: 'v0',
          correctionOf: { id: 'v0', versionNumber: '1.0' },
        }),
      );
      expect((await reader.detail('p1', 'd1', R1)).isCorrectionDraft).toBe(
        true,
      );
      await expect(reader.detail('p1', 'd1', R2)).rejects.toMatchObject({
        code: 'PROGRAM_VERSION_NOT_FOUND',
      });

      programVersion.findFirst.mockResolvedValue(
        row({ status: 'DRAFT', versionNumber: null }),
      );
      await expect(reader.detail('p1', 'v2', R1)).rejects.toMatchObject({
        code: 'PROGRAM_VERSION_NOT_FOUND',
      });
      programVersion.findFirst.mockResolvedValue(null);
      await expect(reader.detail('p1', 'nope', R1)).rejects.toMatchObject({
        code: 'PROGRAM_VERSION_NOT_FOUND',
      });
    });
  });
});
