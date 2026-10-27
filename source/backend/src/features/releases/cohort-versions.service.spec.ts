import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import {
  AccessContext,
  type ActiveAssignment,
} from '../../shared/authz/access-context.js';
import {
  PERMISSIONS,
  type PermissionCode,
} from '../../shared/authz/permission-codes.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import type { AppliedProgramVersionReader } from '../../shared/releases/applied-program-version.reader.js';
import type { CohortAssignmentFact } from '../../shared/releases/applied-version.types.js';
import { readProgramCohortSchedule } from '../../shared/releases/cohort-version-schedule.js';
import { RELEASE_TRANSACTION } from '../../shared/releases/release-locks.js';
import { CohortVersionsService } from './cohort-versions.service.js';

vi.mock(
  '../../shared/releases/cohort-version-schedule.js',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../shared/releases/cohort-version-schedule.js')
    >()),
    readProgramCohortSchedule: vi.fn(),
  }),
);
const revision = 'a'.repeat(64);
const dto = {
  cohortIds: ['c1', 'c2'],
  programVersionId: 'v2',
  fromSemesterId: 's2',
  expectedRevision: revision,
};
function access(
  codes: PermissionCode[] = [
    PERMISSIONS.PROGRAM_VIEW,
    PERMISSIONS.VERSION_ASSIGN_COHORT,
  ],
  scoped = false,
  mode: 'DIRECT' | 'VIA_REQUEST' = 'DIRECT',
) {
  const assignment: ActiveAssignment = {
    assignmentId: null,
    roleId: 'r',
    roleCode: 'CUSTOM',
    roleName: 'Custom',
    scopeSource: 'NONE',
    scopeType: 'UNIT',
    scopeUnit: null,
    scope: { all: true },
    permissions: new Map(
      codes.map((code) => [code, { mode, scope: scoped ? 'SCOPED' : 'ALL' }]),
    ),
  };
  if (scoped)
    assignment.scope = {
      all: false,
      orgUnitIds: new Set(['other']),
      programIds: new Set(),
      subjectGroupIds: new Set(),
      studentIds: new Set(),
    };
  return new AccessContext('user', [assignment]);
}
function setup() {
  const date = new Date('2025-01-01');
  const first = {
    id: 's1',
    semesterCode: 'Z',
    academicYear: 'Y',
    termInYear: 1,
    startDate: date,
    createdAt: date,
    updatedAt: date,
  };
  const later = { ...first, id: 's2', startDate: new Date('2026-01-01') };
  const version = {
    id: 'v2',
    programId: 'p',
    versionNumber: '2.0',
    status: 'PENDING',
    decisionNumber: 'QD2',
    publishedAt: date,
    sourceRequestId: null,
    effectiveSemester: first,
  };
  const fact: CohortAssignmentFact = {
    id: 'a1',
    cohort: { id: 'c1', cohortCode: 'K2023', intakeYear: 2023 },
    version: { ...version, status: 'PENDING', effectiveSemester: first },
    fromSemester: first,
    createdAt: date,
  };
  const assignments: CohortAssignmentFact[] = [];
  vi.mocked(readProgramCohortSchedule).mockImplementation(async () => ({
    assignments,
    revision,
  }));
  const calls: string[] = [];
  const tx = {
    $queryRaw: vi.fn(async () => {
      calls.push('lock');
      return [];
    }),
    program: {
      findUnique: vi.fn(async () => {
        calls.push('program');
        return { id: 'p', facultyId: 'faculty' };
      }),
    },
    programVersion: { findFirst: vi.fn().mockResolvedValue(version) },
    semester: { findUnique: vi.fn().mockResolvedValue(later) },
    cohort: { count: vi.fn().mockResolvedValue(2) },
    cohortVersion: {
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    $transaction: vi.fn(
      async (operation: (tx: Prisma.TransactionClient) => unknown) =>
        operation(tx as unknown as Prisma.TransactionClient),
    ),
  };
  const applied = {
    forCohort: vi.fn().mockResolvedValue({
      programId: 'p',
      cohort: fact.cohort,
      semester: later,
      assignment: fact,
    }),
  };
  return {
    tx,
    prisma,
    first,
    later,
    version,
    fact,
    assignments,
    calls,
    applied,
    service: new CohortVersionsService(
      prisma as unknown as PrismaService,
      applied as unknown as AppliedProgramVersionReader,
    ),
  };
}
describe('CohortVersionsService', () => {
  beforeEach(() => vi.resetAllMocks());
  it('locks the program then authorizes inside one Serializable transaction, with one batch insert', async () => {
    const { service, tx, prisma, calls } = setup();
    expect((await service.assign('p', dto, access())).revision).toBe(revision);
    expect(calls).toEqual(['lock', 'program']);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      ...RELEASE_TRANSACTION,
      isolationLevel: 'Serializable',
    });
    expect(tx.cohortVersion.createMany).toHaveBeenCalledExactlyOnceWith({
      data: [
        { cohortId: 'c1', programVersionId: 'v2', fromSemesterId: 's2' },
        { cohortId: 'c2', programVersionId: 'v2', fromSemesterId: 's2' },
      ],
    });
  });
  it.each([{ codes: [] }, { codes: [PERMISSIONS.PROGRAM_VIEW] }])(
    'denies missing management permission without opening a transaction: $codes',
    ({ codes }) => {
      const { service, prisma } = setup();
      expect(() => service.assign('p', dto, access(codes))).toThrow();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );
  it('denies scoped and VIA_REQUEST assignment grants', () => {
    const { service, prisma } = setup();
    expect(() => service.list('p', access(undefined, true))).toThrow();
    expect(() =>
      service.list('p', access(undefined, false, 'VIA_REQUEST')),
    ).toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('also requires program view even with a school-wide assignment grant', async () => {
    const { service, tx } = setup();
    await expect(
      service.assign('p', dto, access([PERMISSIONS.VERSION_ASSIGN_COHORT])),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(tx.cohortVersion.createMany).not.toHaveBeenCalled();
  });
  it('rejects a stale revision before touching any mapping', async () => {
    const { service, tx } = setup();
    await expect(
      service.assign(
        'p',
        { ...dto, expectedRevision: 'b'.repeat(64) },
        access(),
      ),
    ).rejects.toMatchObject({ code: 'ASSIGNMENT_STATE_CHANGED' });
    expect(tx.cohortVersion.createMany).not.toHaveBeenCalled();
  });
  it.each([
    { status: 'DRAFT' },
    { sourceRequestId: 'request' },
    { publishedAt: null },
    { decisionNumber: null },
  ])('rejects unissued target %j', async (patch) => {
    const { service, version, tx } = setup();
    Object.assign(version, patch);
    await expect(service.assign('p', dto, access())).rejects.toMatchObject({
      code: 'VERSION_NOT_ISSUED',
    });
    expect(tx.cohortVersion.createMany).not.toHaveBeenCalled();
  });
  it('rejects missing cohorts atomically and does not insert a valid subset', async () => {
    const { service, tx } = setup();
    tx.cohort.count.mockResolvedValue(1);
    await expect(service.assign('p', dto, access())).rejects.toMatchObject({
      code: 'COHORT_NOT_FOUND',
    });
    expect(tx.cohortVersion.createMany).not.toHaveBeenCalled();
  });
  it('refuses a target from another program', async () => {
    const { service, tx } = setup();
    tx.programVersion.findFirst.mockResolvedValue(null);
    await expect(service.assign('p', dto, access())).rejects.toMatchObject({
      code: 'PROGRAM_VERSION_NOT_FOUND',
    });
    expect(tx.programVersion.findFirst).toHaveBeenCalledWith({
      where: { id: 'v2', programId: 'p' },
      include: { effectiveSemester: true },
    });
  });
  it('requires known starts and refuses starts before release eligibility', async () => {
    const { service, later, tx } = setup();
    later.startDate = new Date('2024-01-01');
    await expect(service.assign('p', dto, access())).rejects.toMatchObject({
      code: 'ASSIGNMENT_BEFORE_VERSION',
    });
    Object.assign(later, { startDate: null });
    await expect(service.assign('p', dto, access())).rejects.toMatchObject({
      code: 'SEMESTER_START_UNKNOWN',
    });
    expect(tx.cohortVersion.createMany).not.toHaveBeenCalled();
  });
  it('rejects repeated pairs and ambiguous same-date starts without changing old links', async () => {
    const { service, fact, assignments, later, tx } = setup();
    assignments.push(fact);
    await expect(service.assign('p', dto, access())).rejects.toMatchObject({
      code: 'COHORT_VERSION_EXISTS',
    });
    fact.version.id = 'v1';
    fact.fromSemester = later;
    await expect(service.assign('p', dto, access())).rejects.toMatchObject({
      code: 'ASSIGNMENT_START_CONFLICT',
    });
    expect(tx.cohortVersion.createMany).not.toHaveBeenCalled();
    expect(tx.cohortVersion.update).not.toHaveBeenCalled();
  });
  it('patches only the owned link semester and preserves identity and createdAt', async () => {
    const { service, fact, assignments, tx } = setup();
    assignments.push(fact);
    await service.update(
      'p',
      fact.id,
      { fromSemesterId: 's2', expectedRevision: revision },
      access(),
    );
    expect(tx.cohortVersion.update).toHaveBeenCalledExactlyOnceWith({
      where: { id: fact.id },
      data: { fromSemesterId: 's2' },
    });
    expect(tx.cohortVersion.createMany).not.toHaveBeenCalled();
  });
  it('treats same-semester patch as a no-op but refuses another program mapping', async () => {
    const { service, fact, assignments, tx, first } = setup();
    assignments.push(fact);
    tx.semester.findUnique.mockResolvedValue(first);
    await service.update(
      'p',
      fact.id,
      { fromSemesterId: 's1', expectedRevision: revision },
      access(),
    );
    expect(tx.cohortVersion.update).not.toHaveBeenCalled();
    await expect(
      service.update(
        'p',
        'foreign-link',
        { fromSemesterId: 's1', expectedRevision: revision },
        access(),
      ),
    ).rejects.toMatchObject({ code: 'COHORT_ASSIGNMENT_NOT_FOUND' });
  });
  it('delegates the diagnostic to the shared reader using the same authorized transaction', async () => {
    const { service, applied, tx } = setup();
    expect((await service.applied('p', 'c1', 's2', access())).state).toBe(
      'ASSIGNED',
    );
    expect(applied.forCohort).toHaveBeenCalledExactlyOnceWith(
      { programId: 'p', cohortId: 'c1', semesterId: 's2' },
      tx,
    );
  });
  it.each([
    ['P2002', 'COHORT_VERSION_EXISTS'],
    ['P2034', 'ASSIGNMENT_STATE_CHANGED'],
  ])('maps database error %s to %s', async (code, expected) => {
    const { service, tx } = setup();
    tx.cohortVersion.createMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('db', {
        code,
        clientVersion: '7',
      }),
    );
    await expect(service.assign('p', dto, access())).rejects.toMatchObject({
      code: expected,
    });
  });
  it('does not hide unrelated database failures', async () => {
    const { service, tx } = setup();
    const failure = new Error('unexpected');
    tx.cohortVersion.createMany.mockRejectedValue(failure);
    await expect(service.assign('p', dto, access())).rejects.toBe(failure);
  });
});
