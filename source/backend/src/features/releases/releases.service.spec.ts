import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScopeSource, ScopeType } from '../../generated/prisma/client.js';
import {
  AccessContext,
  type ActiveAssignment,
} from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import type { ConsistencyChecker } from '../../shared/curriculum/consistency-checker.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import type { VersionPublisher } from '../../shared/releases/version.publisher.js';
import { ReleasesService } from './releases.service.js';
import type { VersionHistoryReader } from './version-history.reader.js';

function holder(
  code: string,
  mode: 'DIRECT' | 'VIA_REQUEST',
  scope: 'ALL' | 'SCOPED',
) {
  const assignment: ActiveAssignment = {
    assignmentId: null,
    roleId: 'r',
    roleCode: 'R',
    roleName: 'R',
    scopeSource: ScopeSource.NONE,
    scopeType: ScopeType.SYSTEM,
    scopeUnit: null,
    scope: {
      all: scope === 'ALL',
      orgUnitIds: new Set(),
      subjectGroupIds: new Set(),
      programIds: new Set(),
      studentIds: new Set(),
    },
    permissions: new Map([[code as never, { mode, scope }]]),
  };
  return new AccessContext('office', [assignment]);
}

const R1 = holder(PERMISSIONS.VERSION_PUBLISH, 'DIRECT', 'ALL');
const R3 = holder(PERMISSIONS.VERSION_PUBLISH, 'VIA_REQUEST', 'SCOPED');

const dto = {
  decisionNumber: 'QD-1',
  signedDate: '2026-10-01',
  effectiveSemesterId: 'sem',
  cohortIds: ['k1'],
};

describe('ReleasesService', () => {
  let db: {
    program: { findUnique: ReturnType<typeof vi.fn> };
    programVersion: {
      count: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
    semester: { findUnique: ReturnType<typeof vi.fn> };
    cohort: { count: ReturnType<typeof vi.fn> };
    curriculumItem: { findMany: ReturnType<typeof vi.fn> };
    syllabus: { findMany: ReturnType<typeof vi.fn> };
    $queryRaw: ReturnType<typeof vi.fn>;
    $executeRaw: ReturnType<typeof vi.fn>;
  };
  let consistency: {
    check: ReturnType<typeof vi.fn>;
    assertPasses: ReturnType<typeof vi.fn>;
  };
  let publisher: { promote: ReturnType<typeof vi.fn> };
  let history: { detail: ReturnType<typeof vi.fn> };
  let service: ReleasesService;

  beforeEach(() => {
    db = {
      program: { findUnique: vi.fn().mockResolvedValue({ id: 'p1' }) },
      programVersion: {
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue({ id: 'v1' }),
      },
      semester: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'sem',
          semesterCode: '2026-2027-1',
          startDate: new Date('2026-09-07T00:00:00.000Z'),
        }),
      },
      cohort: { count: vi.fn().mockResolvedValue(1) },
      curriculumItem: { findMany: vi.fn().mockResolvedValue([]) },
      syllabus: { findMany: vi.fn().mockResolvedValue([]) },
      $queryRaw: vi.fn().mockResolvedValue([]),
      // lockRequisiteGraph
      $executeRaw: vi.fn().mockResolvedValue(0),
    };
    consistency = {
      check: vi.fn().mockResolvedValue({ issues: [] }),
      assertPasses: vi.fn().mockResolvedValue(undefined),
    };
    publisher = {
      promote: vi.fn().mockResolvedValue({
        id: 'v1',
        versionNumber: '1.0',
        status: 'ACTIVE',
      }),
    };
    history = { detail: vi.fn().mockResolvedValue({ id: 'v1' }) };
    const prisma = {
      ...db,
      $transaction: vi.fn((run: (tx: unknown) => unknown) => run(db)),
    };
    service = new ReleasesService(
      prisma as unknown as PrismaService,
      consistency as unknown as ConsistencyChecker,
      publisher as unknown as VersionPublisher,
      history as unknown as VersionHistoryReader,
    );
  });

  describe('release', () => {
    it('promotes the Draft as 1.0 by default, with the decision, semester start and cohorts', async () => {
      await service.release('p1', 'v1', dto, R1);

      expect(publisher.promote).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          versionId: 'v1',
          programId: 'p1',
          versionNumber: '1.0',
          decisionNumber: 'QD-1',
          signedDate: new Date('2026-10-01T00:00:00.000Z'),
          effectiveSemesterId: 'sem',
          effectiveStart: new Date('2026-09-07T00:00:00.000Z'),
          publisherId: 'office',
          cohortIds: ['k1'],
        }),
      );
      expect(history.detail).toHaveBeenCalledWith('p1', 'v1', R1);
    });

    it('takes the number the user typed', async () => {
      await service.release('p1', 'v1', { ...dto, versionNumber: '2.0' }, R1);

      expect(publisher.promote.mock.calls[0][1].versionNumber).toBe('2.0');
    });

    it('allows an empty cohort list and a semester that began long ago (PB-04)', async () => {
      db.semester.findUnique.mockResolvedValue({
        id: 'sem',
        startDate: new Date('2020-09-01T00:00:00.000Z'),
      });

      await service.release('p1', 'v1', { ...dto, cohortIds: [] }, R1);

      expect(publisher.promote).toHaveBeenCalledTimes(1);
      expect(db.cohort.count).not.toHaveBeenCalled();
    });

    it('is for R1 only', async () => {
      await expect(service.release('p1', 'v1', dto, R3)).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
      });
      expect(publisher.promote).not.toHaveBeenCalled();
    });

    it('answers ALREADY_RELEASED when the program has any issued version, even beside another Draft', async () => {
      db.programVersion.count.mockResolvedValue(1);

      await expect(service.release('p1', 'v1', dto, R1)).rejects.toMatchObject({
        code: 'ALREADY_RELEASED',
      });
      expect(publisher.promote).not.toHaveBeenCalled();
    });

    it("refuses a version that is not the program's plain Draft", async () => {
      db.programVersion.findFirst.mockResolvedValue(null);

      await expect(service.release('p1', 'v1', dto, R1)).rejects.toMatchObject({
        code: 'PROGRAM_VERSION_NOT_FOUND',
      });
    });

    it('refuses a semester without a start date, and an unknown one, and an unknown cohort', async () => {
      db.semester.findUnique.mockResolvedValueOnce({
        id: 'sem',
        startDate: null,
      });
      await expect(service.release('p1', 'v1', dto, R1)).rejects.toMatchObject({
        code: 'SEMESTER_START_UNKNOWN',
      });
      db.semester.findUnique.mockResolvedValueOnce(null);
      await expect(service.release('p1', 'v1', dto, R1)).rejects.toMatchObject({
        code: 'SEMESTER_NOT_FOUND',
      });
      db.cohort.count.mockResolvedValue(0);
      await expect(service.release('p1', 'v1', dto, R1)).rejects.toMatchObject({
        code: 'COHORT_NOT_FOUND',
      });
      expect(publisher.promote).not.toHaveBeenCalled();
    });

    it('takes the requisite graph lock before the consistency check, and writes nothing when it fails', async () => {
      const order: string[] = [];
      db.$executeRaw.mockImplementation(() => {
        order.push('lock');
        return Promise.resolve(0);
      });
      consistency.assertPasses.mockImplementation(() => {
        order.push('check');
        return Promise.reject(new Error('CONSISTENCY_FAILED'));
      });

      await expect(service.release('p1', 'v1', dto, R1)).rejects.toThrow(
        'CONSISTENCY_FAILED',
      );

      expect(order).toEqual(['lock', 'check']);
      expect(publisher.promote).not.toHaveBeenCalled();
    });

    it('names every course whose syllabus cannot be published, and publishes nothing', async () => {
      db.curriculumItem.findMany.mockResolvedValue([
        { courseId: 'c1', course: { courseCode: 'IT1' } },
        { courseId: 'c2', course: { courseCode: 'IT2' } },
      ]);
      db.syllabus.findMany.mockResolvedValue([
        {
          courseId: 'c1',
          status: 'DRAFT',
          courseDescription: null,
          objectives: '<p>x</p>',
          failingScore: null,
          clos: [],
          assessmentComponents: [],
        },
      ]);

      await expect(service.release('p1', 'v1', dto, R1)).rejects.toMatchObject({
        code: 'SYLLABUS_INCOMPLETE',
        details: [
          {
            field: 'IT1',
            constraints: [
              'SYLLABUS_INCOMPLETE',
              'COURSE_DESCRIPTION_EMPTY',
              'ASSESSMENT_FORMULA_EMPTY',
            ],
          },
          { field: 'IT2', constraints: ['MISSING_SYLLABUS'] },
        ],
      });
      expect(publisher.promote).not.toHaveBeenCalled();
    });
  });

  describe('check', () => {
    it('can release when the checker has no Error and every syllabus is ready; a Warning does not block', async () => {
      consistency.check.mockResolvedValue({
        issues: [{ code: 'CREDIT_MISMATCH', severity: 'HIGH' }],
      });

      const result = await service.check('p1', 'v1', R1);

      expect(result).toMatchObject({ versionId: 'v1', canRelease: true });
      expect(result.consistencyIssues).toHaveLength(1);
    });

    it('cannot release on an Error or on a missing syllabus, and is for R1 only', async () => {
      consistency.check.mockResolvedValue({
        issues: [{ code: 'DUPLICATE_COURSE', severity: 'ERROR' }],
      });
      expect((await service.check('p1', 'v1', R1)).canRelease).toBe(false);

      consistency.check.mockResolvedValue({ issues: [] });
      db.curriculumItem.findMany.mockResolvedValue([
        { courseId: 'c1', course: { courseCode: 'IT1' } },
      ]);
      const result = await service.check('p1', 'v1', R1);
      expect(result.canRelease).toBe(false);
      expect(result.syllabusIssues[0]).toMatchObject({
        code: 'MISSING_SYLLABUS',
      });

      await expect(service.check('p1', 'v1', R3)).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
      });
    });
  });
});
