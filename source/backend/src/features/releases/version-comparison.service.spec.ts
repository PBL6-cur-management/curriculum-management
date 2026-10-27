import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma, SyllabusStatus } from '../../generated/prisma/client.js';
import {
  AccessContext,
  type ActiveAssignment,
} from '../../shared/authz/access-context.js';
import {
  PERMISSIONS,
  type PermissionCode,
} from '../../shared/authz/permission-codes.js';
import { readSyllabusSnapshot } from '../../shared/change-requests/diff/syllabus-snapshot.reader.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import {
  readReleasedVersionSnapshot,
  type ReleasedProgramSnapshot,
} from './released-version-snapshot.reader.js';
import { VersionComparisonService } from './version-comparison.service.js';

vi.mock('./released-version-snapshot.reader.js', () => ({
  readReleasedVersionSnapshot: vi.fn(),
}));
vi.mock(
  '../../shared/change-requests/diff/syllabus-snapshot.reader.js',
  () => ({ readSyllabusSnapshot: vi.fn() }),
);

function access(
  codes: PermissionCode[] = [
    PERMISSIONS.PROGRAM_VIEW,
    PERMISSIONS.VERSION_COMPARE,
    PERMISSIONS.SYLLABUS_VIEW,
  ],
  scoped = false,
): AccessContext {
  const assignment: ActiveAssignment = {
    assignmentId: null,
    roleId: 'role',
    roleCode: 'CUSTOM',
    roleName: 'Custom',
    scopeSource: 'NONE',
    scopeType: 'UNIT',
    scopeUnit: null,
    scope: scoped
      ? {
          all: false,
          orgUnitIds: new Set(['foreign']),
          programIds: new Set(),
          subjectGroupIds: new Set(),
          studentIds: new Set(),
        }
      : { all: true },
    permissions: new Map(
      codes.map((code) => [
        code,
        { mode: 'DIRECT', scope: scoped ? 'SCOPED' : 'ALL' },
      ]),
    ),
  };
  return new AccessContext('user', [assignment]);
}
const query = { beforeVersionId: 'v1', afterVersionId: 'v3' };
describe('VersionComparisonService', () => {
  beforeEach(() => vi.resetAllMocks());
  function setup() {
    const tx = {
      program: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'p', facultyId: 'faculty' }),
      },
      course: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ ownerFacultyId: 'faculty', ownerGroupId: null }),
      },
      syllabus: {
        findUniqueOrThrow: vi.fn(
          async ({ where }: { where: { id: string } }) => ({
            id: where.id,
            status: 'HISTORICAL' as SyllabusStatus,
          }),
        ),
      },
    };
    const db = {
      $transaction: vi.fn(
        async (operation: (db: Prisma.TransactionClient) => unknown) =>
          operation(tx as unknown as Prisma.TransactionClient),
      ),
    };
    vi.mocked(readReleasedVersionSnapshot).mockImplementation(
      async (_tx, _programId, versionId): Promise<ReleasedProgramSnapshot> => ({
        version: {
          id: versionId,
          versionNumber: '1.0',
          status: 'HISTORICAL',
          decisionNumber: 'QD',
          effectiveSemester: {
            id: 's',
            semesterCode: 'S',
            academicYear: 'Y',
            termInYear: 1,
            startDate: '2026-01-01',
          },
        },
        entries: [],
        pinsByCourseCode: new Map([
          [
            'C1',
            {
              courseId: 'course',
              syllabusId: versionId === 'v1' ? 'pin1' : 'pin3',
              revisionNumber: versionId === 'v1' ? 1 : 3,
            },
          ],
        ]),
      }),
    );
    vi.mocked(readSyllabusSnapshot).mockResolvedValue([]);
    return {
      tx,
      db,
      service: new VersionComparisonService(db as unknown as PrismaService),
    };
  }
  it('reads non-adjacent endpoints on one read-only RepeatableRead snapshot', async () => {
    const { service, db, tx } = setup();
    const result = await service.compare('p', query, access());
    expect(result.before.id).toBe('v1');
    expect(result.after.id).toBe('v3');
    expect(result.sections.every((section) => section.rows.length === 0)).toBe(
      true,
    );
    expect(readReleasedVersionSnapshot).toHaveBeenNthCalledWith(
      1,
      tx,
      'p',
      'v1',
    );
    expect(readReleasedVersionSnapshot).toHaveBeenNthCalledWith(
      2,
      tx,
      'p',
      'v3',
    );
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
    });
  });
  it.each([
    { codes: [PERMISSIONS.PROGRAM_VIEW] },
    { codes: [PERMISSIONS.VERSION_COMPARE] },
  ])(
    'requires both program and compare permissions: $codes',
    async ({ codes }) => {
      const { service } = setup();
      await expect(
        service.compare('p', query, access(codes)),
      ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
      expect(readReleasedVersionSnapshot).not.toHaveBeenCalled();
    },
  );
  it('denies a permission holder outside the program scope', async () => {
    const { service } = setup();
    await expect(
      service.compare('p', query, access(undefined, true)),
    ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
    expect(readReleasedVersionSnapshot).not.toHaveBeenCalled();
  });
  it('returns missing program before reading content', async () => {
    const { service, tx } = setup();
    tx.program.findUnique.mockResolvedValue(null);
    await expect(
      service.compare('missing', query, access()),
    ).rejects.toMatchObject({ code: 'PROGRAM_NOT_FOUND' });
    expect(readReleasedVersionSnapshot).not.toHaveBeenCalled();
  });
  it('does not accept a version from another program', async () => {
    const { service } = setup();
    vi.mocked(readReleasedVersionSnapshot).mockRejectedValue(
      Object.assign(new Error('missing'), {
        code: 'PROGRAM_VERSION_NOT_FOUND',
      }),
    );
    await expect(service.compare('p', query, access())).rejects.toMatchObject({
      code: 'PROGRAM_VERSION_NOT_FOUND',
    });
  });
  it('derives pins from both version contexts and keeps three unchanged syllabus sections', async () => {
    const { service, tx } = setup();
    const result = await service.syllabi('p', 'course', query, access());
    expect(result.before).toEqual({
      id: 'pin1',
      revisionNumber: 1,
      status: 'HISTORICAL',
    });
    expect(result.after.id).toBe('pin3');
    expect(result.sections.map((section) => section.entityType)).toEqual([
      'SYLLABUS_FIELD',
      'WEEKLY_CONTENTS',
      'CLO',
    ]);
    expect(result.sections.every((section) => section.rows.length === 0)).toBe(
      true,
    );
    expect(readSyllabusSnapshot).toHaveBeenNthCalledWith(1, tx, 'pin1');
    expect(readSyllabusSnapshot).toHaveBeenNthCalledWith(2, tx, 'pin3');
  });
  it('refuses a substituted course and does not read arbitrary syllabus text', async () => {
    const { service } = setup();
    await expect(
      service.syllabi('p', 'foreign-course', query, access()),
    ).rejects.toMatchObject({ code: 'PINNED_SYLLABUS_NOT_FOUND' });
    expect(readSyllabusSnapshot).not.toHaveBeenCalled();
  });
  it('requires course-level syllabus permission before reading text', async () => {
    const { service } = setup();
    await expect(
      service.syllabi(
        'p',
        'course',
        query,
        access([PERMISSIONS.PROGRAM_VIEW, PERMISSIONS.VERSION_COMPARE]),
      ),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(readSyllabusSnapshot).not.toHaveBeenCalled();
  });
});
