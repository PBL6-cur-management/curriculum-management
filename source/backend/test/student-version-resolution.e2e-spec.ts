import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seedAccessControl } from '../prisma/seed-data/seed-access-control.js';
import { EnrollmentStatus } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import {
  startPostgres,
  startRedis,
  type TestPostgres,
  type TestRedis,
} from './containers.js';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import {
  assignCohorts,
  readCohortVersions,
} from './fixtures/cohort-versions.js';
import { createStudentWorld } from './fixtures/students.js';
import {
  releasedComparisonFixture,
  type ComparedVersionFixture,
} from './fixtures/version-comparison.js';
import { createCohort } from './fixtures/releases.js';
import { createTestApp } from './test-app.js';
import { setAppEnv } from './test-env.js';

type Agent = ReturnType<typeof request.agent>;

describe('Student applied-version resolution against real releases', () => {
  let postgres: TestPostgres;
  let redis: TestRedis;
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let fx: ComparedVersionFixture;
  let counter = 0;

  beforeAll(async () => {
    [postgres, redis] = await Promise.all([
      startPostgres({ vietnameseCollation: true }),
      startRedis(),
    ]);
    setAppEnv(postgres, redis);
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await seedAccessControl(prisma);
    admin = await loginAgent(app, await createAccount(app, 'stures', 'R1'));
    fx = await releasedComparisonFixture(app, admin, 'VRP');
  });

  afterAll(async () => {
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
  });

  async function student(cohortId: string) {
    counter += 1;
    return prisma.student.create({
      data: {
        studentCode: `VR${String(counter).padStart(4, '0')}`,
        fullName: `Sinh viên VR${counter}`,
        cohortId,
        admissionSemesterId: fx.firstSemesterId,
        statusSemesterId: fx.firstSemesterId,
        major: 'M01',
      },
    });
  }

  async function enrol(
    studentId: string,
    cohortId: string,
    input: {
      programId?: string;
      versionId: string;
      fromSemesterId: string;
      untilSemesterId?: string;
      assignmentId?: string | null;
      exception?: boolean;
      status?: EnrollmentStatus;
      type?: 'PRIMARY' | 'SECOND_MAJOR';
      previousId?: string;
    },
  ) {
    return prisma.programEnrollment.create({
      data: {
        studentId,
        programId: input.programId ?? fx.programId,
        cohortId,
        appliedVersionId: input.versionId,
        admissionVersionId: input.versionId,
        cohortAssignmentId: input.assignmentId ?? null,
        fromSemesterId: input.fromSemesterId,
        untilSemesterId: input.untilSemesterId ?? null,
        previousEnrollmentId: input.previousId ?? null,
        enrollmentType: input.type ?? 'PRIMARY',
        isException: input.exception ?? false,
        basisDecision: input.exception ? 'QD-TEST' : null,
        status: input.status ?? EnrollmentStatus.ACTIVE,
      },
    });
  }

  const resolve = (
    studentId: string,
    semesterId: string,
    programId = fx.programId,
  ) =>
    admin
      .get(`/api/students/${studentId}/applied-version`)
      .query({ semesterId, programId });

  async function assignmentOf(cohortId: string, versionId: string) {
    const list = await readCohortVersions(admin, fx.programId);
    return list.assignments.find(
      (row) => row.cohort.id === cohortId && row.version.id === versionId,
    )!;
  }

  it('follows the cohort schedule and leaves the stored admission version alone', async () => {
    const cohort = await createCohort(app, `VR-PIN-${Date.now()}`);
    const list = await readCohortVersions(admin, fx.programId);
    await assignCohorts(admin, fx.programId, {
      cohortIds: [cohort.id],
      programVersionId: fx.beforeVersionId,
      fromSemesterId: fx.firstSemesterId,
      expectedRevision: list.revision,
    });
    const pinned = await assignmentOf(cohort.id, fx.beforeVersionId);
    const row = await student(cohort.id);
    const enrollment = await enrol(row.id, cohort.id, {
      versionId: fx.beforeVersionId,
      fromSemesterId: fx.firstSemesterId,
      assignmentId: pinned.id,
    });

    const atFirst = await resolve(row.id, fx.firstSemesterId).expect(200);
    expect(atFirst.body).toMatchObject({
      programVersionId: fx.beforeVersionId,
      source: 'COHORT',
      cohortAssignmentId: pinned.id,
      enrollmentId: enrollment.id,
    });

    const next = await readCohortVersions(admin, fx.programId);
    await assignCohorts(admin, fx.programId, {
      cohortIds: [cohort.id],
      programVersionId: fx.intermediateVersionId,
      fromSemesterId: fx.middleSemesterId,
      expectedRevision: next.revision,
    });
    const atMiddle = await resolve(row.id, fx.middleSemesterId).expect(200);
    expect(atMiddle.body.programVersionId).toBe(fx.intermediateVersionId);
    expect(
      (await resolve(row.id, fx.firstSemesterId).expect(200)).body
        .programVersionId,
    ).toBe(fx.beforeVersionId);
    const stored = await prisma.programEnrollment.findUniqueOrThrow({
      where: { id: enrollment.id },
    });
    expect(stored.admissionVersionId).toBe(fx.beforeVersionId);
  });

  it('does not apply a pending version before its effective semester', async () => {
    const cohort = await createCohort(app, `VR-FUT-${Date.now()}`);
    const list = await readCohortVersions(admin, fx.programId);
    await assignCohorts(admin, fx.programId, {
      cohortIds: [cohort.id],
      programVersionId: fx.beforeVersionId,
      fromSemesterId: fx.firstSemesterId,
      expectedRevision: list.revision,
    });
    const current = await assignmentOf(cohort.id, fx.beforeVersionId);
    const next = await readCohortVersions(admin, fx.programId);
    await assignCohorts(admin, fx.programId, {
      cohortIds: [cohort.id],
      programVersionId: fx.afterVersionId,
      fromSemesterId: fx.lastSemesterId,
      expectedRevision: next.revision,
    });
    const row = await student(cohort.id);
    await enrol(row.id, cohort.id, {
      versionId: fx.beforeVersionId,
      fromSemesterId: fx.firstSemesterId,
      assignmentId: current.id,
    });
    expect(
      (await resolve(row.id, fx.middleSemesterId).expect(200)).body
        .programVersionId,
    ).toBe(fx.beforeVersionId);
    expect(
      (await resolve(row.id, fx.lastSemesterId).expect(200)).body
        .programVersionId,
    ).toBe(fx.afterVersionId);
  });

  it('uses the closed interval until the exact transfer semester and the new one from it', async () => {
    const cohort = await createCohort(app, `VR-TRF-${Date.now()}`);
    const list = await readCohortVersions(admin, fx.programId);
    await assignCohorts(admin, fx.programId, {
      cohortIds: [cohort.id],
      programVersionId: fx.beforeVersionId,
      fromSemesterId: fx.firstSemesterId,
      expectedRevision: list.revision,
    });
    const assignment = await assignmentOf(cohort.id, fx.beforeVersionId);
    const row = await student(cohort.id);
    const closed = await enrol(row.id, cohort.id, {
      versionId: fx.beforeVersionId,
      fromSemesterId: fx.firstSemesterId,
      untilSemesterId: fx.middleSemesterId,
      assignmentId: assignment.id,
      status: EnrollmentStatus.TRANSFERRED,
    });
    const open = await enrol(row.id, cohort.id, {
      versionId: fx.intermediateVersionId,
      fromSemesterId: fx.middleSemesterId,
      exception: true,
      previousId: closed.id,
    });

    expect(
      (await resolve(row.id, fx.firstSemesterId).expect(200)).body,
    ).toMatchObject({
      enrollmentId: closed.id,
      programVersionId: fx.beforeVersionId,
      source: 'COHORT',
    });
    expect(
      (await resolve(row.id, fx.middleSemesterId).expect(200)).body,
    ).toMatchObject({
      enrollmentId: open.id,
      programVersionId: fx.intermediateVersionId,
      source: 'EXCEPTION',
      cohortAssignmentId: null,
    });
    expect(
      (await resolve(row.id, fx.lastSemesterId).expect(200)).body.enrollmentId,
    ).toBe(open.id);
  });

  it('prefers an exception enrollment over the cohort schedule', async () => {
    const cohort = await createCohort(app, `VR-EXC-${Date.now()}`);
    const list = await readCohortVersions(admin, fx.programId);
    await assignCohorts(admin, fx.programId, {
      cohortIds: [cohort.id],
      programVersionId: fx.beforeVersionId,
      fromSemesterId: fx.firstSemesterId,
      expectedRevision: list.revision,
    });
    const row = await student(cohort.id);
    await enrol(row.id, cohort.id, {
      versionId: fx.intermediateVersionId,
      fromSemesterId: fx.middleSemesterId,
      exception: true,
    });
    const body = (await resolve(row.id, fx.lastSemesterId).expect(200)).body;
    expect(body.programVersionId).toBe(fx.intermediateVersionId);
    expect(body.source).toBe('EXCEPTION');
  });

  it('selects the second major by program and refuses a program the student is not in', async () => {
    const other = await createStudentWorld(app, admin, 'VR2');
    const cohort = await createCohort(app, `VR-2ND-${Date.now()}`);
    const list = await readCohortVersions(admin, fx.programId);
    await assignCohorts(admin, fx.programId, {
      cohortIds: [cohort.id],
      programVersionId: fx.beforeVersionId,
      fromSemesterId: fx.firstSemesterId,
      expectedRevision: list.revision,
    });
    const primary = await assignmentOf(cohort.id, fx.beforeVersionId);
    const row = await student(cohort.id);
    await enrol(row.id, cohort.id, {
      versionId: fx.beforeVersionId,
      fromSemesterId: fx.firstSemesterId,
      assignmentId: primary.id,
    });
    await enrol(row.id, cohort.id, {
      programId: other.programId,
      versionId: other.versionId,
      fromSemesterId: other.admissionSemesterId,
      exception: true,
      type: 'SECOND_MAJOR',
    });

    const first = await resolve(row.id, fx.lastSemesterId).expect(200);
    expect(first.body.programVersionId).toBe(fx.beforeVersionId);
    const second = await resolve(
      row.id,
      fx.lastSemesterId,
      other.programId,
    ).expect(200);
    expect(second.body.programVersionId).toBe(other.versionId);

    const stranger = await createStudentWorld(app, admin, 'VR3');
    const missing = await resolve(
      row.id,
      fx.lastSemesterId,
      stranger.programId,
    );
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('ENROLLMENT_NOT_FOUND');
  });

  it('fails explicitly when the cohort has no assignment', async () => {
    const cohort = await createCohort(app, `VR-NONE-${Date.now()}`);
    const row = await student(cohort.id);
    await enrol(row.id, cohort.id, {
      versionId: fx.beforeVersionId,
      fromSemesterId: fx.firstSemesterId,
    });
    const response = await resolve(row.id, fx.firstSemesterId);
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('APPLIED_VERSION_UNRESOLVED');
  });

  it('reads without writing anything', async () => {
    const cohort = await createCohort(app, `VR-RO-${Date.now()}`);
    const list = await readCohortVersions(admin, fx.programId);
    await assignCohorts(admin, fx.programId, {
      cohortIds: [cohort.id],
      programVersionId: fx.beforeVersionId,
      fromSemesterId: fx.firstSemesterId,
      expectedRevision: list.revision,
    });
    const assignment = await assignmentOf(cohort.id, fx.beforeVersionId);
    const row = await student(cohort.id);
    await enrol(row.id, cohort.id, {
      versionId: fx.beforeVersionId,
      fromSemesterId: fx.firstSemesterId,
      assignmentId: assignment.id,
    });
    const snapshot = async () => ({
      students: await prisma.student.findMany({ orderBy: { id: 'asc' } }),
      enrollments: await prisma.programEnrollment.findMany({
        orderBy: { id: 'asc' },
      }),
      results: await prisma.academicResult.count(),
      changes: await prisma.academicResultChange.count(),
      assignments: await prisma.cohortVersion.count(),
    });
    const before = await snapshot();
    await resolve(row.id, fx.firstSemesterId).expect(200);
    await resolve(row.id, fx.lastSemesterId).expect(200);
    await admin
      .get(`/api/students/${row.id}`)
      .query({ semesterId: fx.firstSemesterId, programId: fx.programId })
      .expect(200);
    await admin
      .get(`/api/students/${row.id}/enrollment-targets`)
      .query({ semesterId: fx.lastSemesterId, programId: fx.programId })
      .expect(200);
    expect(await snapshot()).toEqual(before);
  });
});
