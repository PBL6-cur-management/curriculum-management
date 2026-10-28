import { fromIsoDay } from '../time/today.js';
import { EnrollmentReconciler } from './enrollment-reconciler.js';

const semester = (id: string, day: string) => ({
  id,
  startDate: fromIsoDay(day),
});
const assignment = (
  id: string,
  versionId: string,
  from: ReturnType<typeof semester>,
) => ({
  id,
  cohort: { id: 'c1', cohortCode: 'K1', intakeYear: 2025 },
  version: { id: versionId, programId: 'p1' },
  fromSemester: from,
  createdAt: new Date('2025-01-01'),
});

const S1 = semester('s1', '2025-09-01');
const S2 = semester('s2', '2026-02-01');
const S3 = semester('s3', '2026-09-01');

function tip(over: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    studentId: 'st',
    programId: 'p1',
    cohortId: 'c1',
    appliedVersionId: 'v1',
    admissionVersionId: 'v1',
    cohortAssignmentId: 'a1',
    enrollmentType: 'PRIMARY',
    fromSemester: S1,
    cohortAssignment: { programVersionId: 'v1', fromSemester: S1 },
    ...over,
  };
}

const schedule = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('../releases/cohort-version-schedule.js', () => ({
  readProgramCohortSchedule: schedule.read,
}));

function setup(
  tips: unknown[],
  applied: Record<string, ReturnType<typeof assignment> | null>,
) {
  schedule.read.mockResolvedValue({
    assignments: [
      assignment('a1', 'v1', S1),
      assignment('a2', 'v2', S2),
      assignment('a3', 'v3', S3),
    ],
    revision: 'r',
  });
  let counter = 0;
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    programEnrollment: {
      findMany: vi.fn().mockResolvedValue(tips),
      findUnique: vi
        .fn()
        .mockResolvedValue({ status: 'ACTIVE', nextEnrollment: null }),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockImplementation(() => ({ id: `n${++counter}` })),
    },
    student: { update: vi.fn().mockResolvedValue({}) },
  };
  const prisma = { $transaction: (fn: (t: unknown) => unknown) => fn(tx) };
  const versions = {
    forCohort: vi.fn(({ semesterId }: { semesterId: string }) =>
      Promise.resolve({ assignment: applied[semesterId] ?? null }),
    ),
  };
  const reconciler = new EnrollmentReconciler(
    prisma as never,
    versions as never,
  );
  return { tx, reconciler };
}

const full = {
  s2: assignment('a2', 'v2', S2),
  s3: assignment('a3', 'v3', S3),
};

describe('EnrollmentReconciler', () => {
  it('creates the whole chain when several boundaries were missed', async () => {
    const { tx, reconciler } = setup([tip()], full);
    const counts = await reconciler.reconcileProgram(
      'p1',
      fromIsoDay('2026-10-01'),
    );
    expect(counts).toEqual({ transitioned: 1, unchanged: 0, blocked: 0 });
    expect(tx.programEnrollment.create).toHaveBeenCalledTimes(2);
    expect(tx.programEnrollment.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          appliedVersionId: 'v3',
          previousEnrollmentId: 'n1',
          admissionVersionId: 'v1',
          createdById: null,
        }),
      }),
    );
  });

  it('leaves a future boundary in the schedule', async () => {
    const { tx, reconciler } = setup([tip()], full);
    await reconciler.reconcileProgram('p1', fromIsoDay('2026-03-01'));
    expect(tx.programEnrollment.create).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when the chain already matches the schedule', async () => {
    const { tx, reconciler } = setup(
      [
        tip({
          appliedVersionId: 'v3',
          fromSemester: S3,
          cohortAssignment: { programVersionId: 'v3', fromSemester: S3 },
        }),
      ],
      full,
    );
    const counts = await reconciler.reconcileProgram(
      'p1',
      fromIsoDay('2026-10-01'),
    );
    expect(counts).toEqual({ transitioned: 0, unchanged: 1, blocked: 0 });
    expect(tx.programEnrollment.create).not.toHaveBeenCalled();
  });

  it('skips a row another worker already advanced', async () => {
    const { tx, reconciler } = setup([tip()], full);
    tx.programEnrollment.findUnique.mockResolvedValue({
      status: 'TRANSFERRED',
      nextEnrollment: { id: 'x' },
    });
    const counts = await reconciler.reconcileProgram(
      'p1',
      fromIsoDay('2026-10-01'),
    );
    expect(counts.unchanged).toBe(1);
    expect(tx.programEnrollment.create).not.toHaveBeenCalled();
  });

  it('blocks a row whose assignment was retargeted and rewrites nothing', async () => {
    const { tx, reconciler } = setup(
      [
        tip({
          cohortAssignment: { programVersionId: 'other', fromSemester: S1 },
        }),
      ],
      full,
    );
    const counts = await reconciler.reconcileProgram(
      'p1',
      fromIsoDay('2026-10-01'),
    );
    expect(counts).toEqual({ transitioned: 0, unchanged: 0, blocked: 1 });
    expect(tx.programEnrollment.update).not.toHaveBeenCalled();
    expect(tx.programEnrollment.create).not.toHaveBeenCalled();
  });
});

describe('EnrollmentReconciler.reconcileStudent', () => {
  const updatedAt = new Date('2026-01-01T00:00:00.000Z');
  const withStudent = (found: { updatedAt: Date } | null) => {
    const built = setup([tip()], full);
    Object.assign(built.tx.student, {
      findUnique: vi.fn().mockResolvedValue(found),
    });
    return built;
  };

  it('reconciles only the named student and returns real counts', async () => {
    const { tx, reconciler } = withStudent({ updatedAt });
    const counts = await reconciler.reconcileStudent(
      'st',
      updatedAt.toISOString(),
      fromIsoDay('2026-10-01'),
    );
    expect(counts).toEqual({ transitioned: 1, unchanged: 0, blocked: 0 });
    expect(tx.programEnrollment.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentId: 'st', programId: 'p1' }),
      }),
    );
  });

  it('refuses a stale revision token without writing', async () => {
    const { tx, reconciler } = withStudent({ updatedAt });
    await expect(
      reconciler.reconcileStudent(
        'st',
        '2025-01-01T00:00:00.000Z',
        fromIsoDay('2026-10-01'),
      ),
    ).rejects.toMatchObject({ code: 'ENROLLMENT_STATE_CHANGED' });
    expect(tx.programEnrollment.create).not.toHaveBeenCalled();
  });

  it('reports a missing student as not found', async () => {
    const { reconciler } = withStudent(null);
    await expect(
      reconciler.reconcileStudent('st', updatedAt.toISOString()),
    ).rejects.toMatchObject({ code: 'STUDENT_NOT_FOUND' });
  });
});
