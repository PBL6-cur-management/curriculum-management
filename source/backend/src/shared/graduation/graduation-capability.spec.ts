import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  AccessContext,
  type ActiveAssignment,
} from '../authz/access-context.js';
import { PERMISSIONS } from '../authz/permission-codes.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AppliedProgramVersionReader } from '../releases/applied-program-version.reader.js';
import { AcademicResultsReader } from '../students/academic-results.reader.js';
import { requireGraduationReauditLookup } from '../students/student-access.js';
import { StudentAppliedVersionReader } from '../students/student-applied-version.reader.js';
import { staffGraduationCapability } from './graduation-capability.js';
import { GRADUATION_ERRORS } from './graduation.errors.js';

const now = new Date('2026-10-30T12:00:00.000Z');
const lookup = {
  studentId: 'student-a',
  programId: 'program-a',
  semesterId: 'semester-a',
};
const semesterStart = new Date('2026-09-01T00:00:00.000Z');

function runningTask() {
  return {
    id: 'task-a',
    status: 'RUNNING',
    leaseToken: 'lease-a',
    leaseUntil: new Date(now.getTime() + 60_000) as Date | null,
    context: {
      id: 'context-a',
      ...lookup,
      semester: { startDate: semesterStart as Date | null },
    },
    baselineAudit: { contextId: 'context-a' },
    receipt: {
      change: {
        academicResult: {
          studentId: lookup.studentId,
          semester: {
            startDate: new Date('2026-02-01T00:00:00.000Z') as Date | null,
          },
        },
      },
    },
  };
}

type Task = ReturnType<typeof runningTask>;

function build(task: Task | null = runningTask()) {
  const db = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    graduationReauditTask: { findUnique: vi.fn().mockResolvedValue(task) },
    semester: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: lookup.semesterId, startDate: semesterStart }),
    },
    student: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: lookup.studentId, userId: 'student-user' }]),
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: lookup.studentId, userId: 'student-user' }),
    },
    programEnrollment: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'enrollment-a',
          studentId: lookup.studentId,
          programId: lookup.programId,
          cohortId: 'cohort-a',
          isException: false,
          fromSemester: { startDate: new Date('2025-09-01T00:00:00.000Z') },
          untilSemester: null,
          appliedVersion: null,
        },
      ]),
    },
    academicResult: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const tx = db as unknown as Prisma.TransactionClient;
  const transaction = vi.fn(
    async (run: (current: Prisma.TransactionClient) => Promise<unknown>) =>
      run(tx),
  );
  const prisma = { $transaction: transaction } as unknown as PrismaService;
  const cohortVersions = {
    forCohorts: vi.fn().mockResolvedValue([
      {
        cohort: { id: 'cohort-a' },
        assignment: { id: 'cohort-assignment-a', version: { id: 'version-a' } },
      },
    ]),
  };
  return {
    db,
    tx,
    transaction,
    cohortVersions,
    versions: new StudentAppliedVersionReader(
      prisma,
      cohortVersions as unknown as AppliedProgramVersionReader,
    ),
    results: new AcademicResultsReader(prisma),
  };
}

function actor(
  roleCode = 'R3',
  programId = lookup.programId,
  studentId = lookup.studentId,
) {
  const assignment: ActiveAssignment = {
    assignmentId: 'assignment-a',
    roleId: roleCode,
    roleCode,
    roleName: roleCode,
    scopeSource: 'NONE',
    scopeType: 'SYSTEM',
    scopeUnit: null,
    scope: {
      all: false,
      orgUnitIds: new Set(),
      subjectGroupIds: new Set(),
      programIds: new Set([programId]),
      studentIds: new Set([studentId]),
    },
    permissions: new Map([
      [PERMISSIONS.GRADUATION_VIEW, { mode: 'DIRECT', scope: 'SCOPED' }],
    ]),
  };
  return new AccessContext(
    roleCode === 'R6' ? 'student-user' : 'director-user',
    [assignment],
  );
}

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(now.getTime());
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('actor-bound graduation capability', () => {
  it('delegates through the actual existing actor facades with unchanged lookup and transaction arguments', async () => {
    const { db, tx, transaction, versions, results } = build();
    const access = actor();
    const versionAccess = vi.spyOn(versions, 'forAccess');
    const resultAccess = vi.spyOn(results, 'forAccess');
    const capability = staffGraduationCapability(
      access,
      lookup,
      versions,
      results,
    );
    await expect(capability.resolve(tx)).resolves.toEqual({
      ...lookup,
      enrollmentId: 'enrollment-a',
      programVersionId: 'version-a',
      source: 'COHORT',
      cohortAssignmentId: 'cohort-assignment-a',
    });
    await expect(capability.attempts(tx)).resolves.toEqual([]);
    expect(versionAccess).toHaveBeenCalledWith(access, 'GRADUATION');
    expect(resultAccess).toHaveBeenCalledWith(access, 'GRADUATION');
    expect(db.student.findMany).toHaveBeenCalledWith({
      where: { id: { in: [lookup.studentId] } },
      select: { id: true, userId: true },
    });
    expect(db.academicResult.findMany).toHaveBeenCalledWith({
      where: { studentId: lookup.studentId },
      include: { semester: { select: { startDate: true } } },
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('preserves optional-transaction call signatures for existing actor readers', async () => {
    const { tx, transaction, versions, results } = build();
    const access = actor();
    await versions.forAccess(access, 'GRADUATION').resolveForStudent(lookup);
    await results.forAccess(access, 'GRADUATION').forStudent(lookup);
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
    });
    expect(tx).toBeDefined();
  });

  it('does not bypass actual director program authorization', async () => {
    const { db, tx, versions, results } = build();
    const capability = staffGraduationCapability(
      actor('R3', 'foreign-program'),
      lookup,
      versions,
      results,
    );
    await expect(capability.resolve(tx)).rejects.toMatchObject({
      code: 'STUDENT_NOT_FOUND',
    });
    await expect(capability.attempts(tx)).rejects.toMatchObject({
      code: 'STUDENT_NOT_FOUND',
    });
    expect(db.programEnrollment.findMany).not.toHaveBeenCalled();
    expect(db.academicResult.findMany).not.toHaveBeenCalled();
  });

  it('retains actual owning-R6 reads and denies foreign R6 records', async () => {
    const { tx, versions, results } = build();
    const own = staffGraduationCapability(
      actor('R6'),
      lookup,
      versions,
      results,
    );
    await expect(own.resolve(tx)).resolves.toMatchObject({
      studentId: lookup.studentId,
    });
    await expect(own.attempts(tx)).resolves.toEqual([]);
    const foreign = staffGraduationCapability(
      actor('R6', lookup.programId, 'another-student'),
      lookup,
      versions,
      results,
    );
    await expect(foreign.resolve(tx)).rejects.toMatchObject({
      code: 'STUDENT_NOT_FOUND',
    });
    await expect(foreign.attempts(tx)).rejects.toMatchObject({
      code: 'STUDENT_NOT_FOUND',
    });
  });

  it('propagates source-reader failures rather than manufacturing empty evidence', async () => {
    const { db, tx, versions, results } = build();
    const error = new Error('synthetic transcript failure');
    db.academicResult.findMany.mockRejectedValueOnce(error);
    await expect(
      staffGraduationCapability(actor(), lookup, versions, results).attempts(
        tx,
      ),
    ).rejects.toBe(error);
  });
});

describe('restricted graduation re-audit lookup', () => {
  it('derives only the saved task context and locks the supplied task row in its caller transaction', async () => {
    const { db, tx } = build();
    await expect(
      requireGraduationReauditLookup('task-a', 'lease-a', tx),
    ).resolves.toEqual(lookup);
    expect(db.graduationReauditTask.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'task-a' } }),
    );
    expect(db.$queryRaw).toHaveBeenCalledWith(expect.any(Array), 'task-a');
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.graduationReauditTask.findUnique.mock.invocationCallOrder[0]!,
    );
  });

  it('rejects a guessed task ID without deriving another context', async () => {
    const { db, tx } = build(null);
    await expect(
      requireGraduationReauditLookup('guessed-task', 'lease-a', tx),
    ).rejects.toMatchObject({ code: GRADUATION_ERRORS.ACCESS_REVOKED.code });
    expect(db.graduationReauditTask.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'guessed-task' } }),
    );
  });

  it.each(['PENDING', 'COMPLETED', 'COVERED', 'FAILED'])(
    'rejects status %s even with a matching token',
    async (status) => {
      const task = runningTask();
      task.status = status;
      const { tx } = build(task);
      await expect(
        requireGraduationReauditLookup('task-a', 'lease-a', tx),
      ).rejects.toMatchObject({ code: GRADUATION_ERRORS.ACCESS_REVOKED.code });
    },
  );

  it.each(['wrong-token', ''])(
    'rejects an invalid lease token (%s)',
    async (token) => {
      const { tx } = build();
      await expect(
        requireGraduationReauditLookup('task-a', token, tx),
      ).rejects.toMatchObject({ code: GRADUATION_ERRORS.ACCESS_REVOKED.code });
    },
  );

  it.each([new Date(now.getTime() - 1), now, null])(
    'rejects expired, boundary or absent lease expiry (%s)',
    async (leaseUntil) => {
      const task = runningTask();
      task.leaseUntil = leaseUntil;
      const { tx } = build(task);
      await expect(
        requireGraduationReauditLookup('task-a', 'lease-a', tx),
      ).rejects.toMatchObject({ code: GRADUATION_ERRORS.ACCESS_REVOKED.code });
    },
  );

  const invalidContexts: { name: string; alter: (task: Task) => void }[] = [
    {
      name: 'baseline audit belongs to a different context',
      alter: (task) => {
        task.baselineAudit.contextId = 'another-context';
      },
    },
    {
      name: 'change belongs to a different student',
      alter: (task) => {
        task.receipt.change.academicResult.studentId = 'another-student';
      },
    },
    {
      name: 'change semester starts after the audited semester',
      alter: (task) => {
        task.receipt.change.academicResult.semester.startDate = new Date(
          '2027-02-01T00:00:00.000Z',
        );
      },
    },
    {
      name: 'source semester has no start date',
      alter: (task) => {
        task.receipt.change.academicResult.semester.startDate = null;
      },
    },
    {
      name: 'context semester has no start date',
      alter: (task) => {
        task.context.semester.startDate = null;
      },
    },
  ];

  it.each(invalidContexts)(
    'rejects invalid context: $name',
    async ({ alter }) => {
      const task = runningTask();
      alter(task);
      const { tx } = build(task);
      await expect(
        requireGraduationReauditLookup('task-a', 'lease-a', tx),
      ).rejects.toMatchObject({ code: GRADUATION_ERRORS.INPUT_INVALID.code });
    },
  );
});

describe('actual shared student task facades', () => {
  it('resolves versions and attempts from the task context without an actor or replaceable lookup', async () => {
    const { db, tx, transaction, versions, results } = build();
    const versionFacade = await versions.forReauditTask(
      'task-a',
      'lease-a',
      tx,
    );
    const resultFacade = await results.forReauditTask('task-a', 'lease-a', tx);
    expect(versionFacade.lookup).toEqual(lookup);
    expectTypeOf(versionFacade.resolveForStudent).parameters.toEqualTypeOf<
      []
    >();
    expectTypeOf(resultFacade.forStudent).parameters.toEqualTypeOf<[]>();
    await expect(versionFacade.resolveForStudent()).resolves.toMatchObject({
      ...lookup,
      programVersionId: 'version-a',
    });
    await expect(resultFacade.forStudent()).resolves.toEqual([]);
    expect(db.graduationReauditTask.findUnique).toHaveBeenCalledTimes(4);
    expect(db.student.findMany).not.toHaveBeenCalled();
    expect(db.student.findUnique).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects guessed tasks before either facade can read academic evidence', async () => {
    const { db, tx, versions, results } = build(null);
    await expect(
      versions.forReauditTask('guessed-task', 'lease-a', tx),
    ).rejects.toMatchObject({ code: GRADUATION_ERRORS.ACCESS_REVOKED.code });
    await expect(
      results.forReauditTask('guessed-task', 'lease-a', tx),
    ).rejects.toMatchObject({ code: GRADUATION_ERRORS.ACCESS_REVOKED.code });
    expect(db.programEnrollment.findMany).not.toHaveBeenCalled();
    expect(db.academicResult.findMany).not.toHaveBeenCalled();
  });

  it.each(['completed', 'expired', 'reclaimed', 'mismatched-context'])(
    'revalidates %s tasks on every restricted read',
    async (reason) => {
      const task = runningTask();
      const { db, tx, versions, results } = build(task);
      const versionFacade = await versions.forReauditTask(
        'task-a',
        'lease-a',
        tx,
      );
      const resultFacade = await results.forReauditTask(
        'task-a',
        'lease-a',
        tx,
      );
      if (reason === 'completed') task.status = 'COMPLETED';
      if (reason === 'expired') task.leaseUntil = now;
      if (reason === 'reclaimed') task.leaseToken = 'new-worker-token';
      if (reason === 'mismatched-context')
        task.baselineAudit.contextId = 'another-context';
      const code =
        reason === 'mismatched-context'
          ? GRADUATION_ERRORS.INPUT_INVALID.code
          : GRADUATION_ERRORS.ACCESS_REVOKED.code;
      await expect(versionFacade.resolveForStudent()).rejects.toMatchObject({
        code,
      });
      await expect(resultFacade.forStudent()).rejects.toMatchObject({ code });
      expect(db.programEnrollment.findMany).not.toHaveBeenCalled();
      expect(db.academicResult.findMany).not.toHaveBeenCalled();
    },
  );
});
