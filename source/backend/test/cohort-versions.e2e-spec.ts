import type { NestExpressApplication } from '@nestjs/platform-express';
import type request from 'supertest';
import { seedApprovalLevels } from '../prisma/seed-data/approval-levels.js';
import { seedAccessControl } from '../prisma/seed-data/seed-access-control.js';
import { ReleaseActivationProcessor } from '../src/features/releases/release-activation.processor.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { AppliedProgramVersionReader } from '../src/shared/releases/applied-program-version.reader.js';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import { addCurriculumItem } from './fixtures/curriculum.js';
import {
  appliedVersion,
  assignCohorts,
  readCohortVersions,
} from './fixtures/cohort-versions.js';
import { createProgram } from './fixtures/programs.js';
import {
  createCohort,
  createSemester,
  releaseViaApi,
} from './fixtures/releases.js';
import {
  releasedComparisonFixture,
  type ComparedVersionFixture,
} from './fixtures/version-comparison.js';
import {
  startPostgres,
  startRedis,
  type TestPostgres,
  type TestRedis,
} from './containers.js';
import { createTestApp } from './test-app.js';
import { setAppEnv } from './test-env.js';

type Agent = ReturnType<typeof request.agent>;
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };
describe('explicit semester-effective cohort versions with PostgreSQL transactions', () => {
  let postgres: TestPostgres;
  let redis: TestRedis;
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let otherAdmin: Agent;
  let fixture: ComparedVersionFixture;
  const denied: Agent[] = [];
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
    await seedApprovalLevels(prisma);
    admin = await loginAgent(
      app,
      await createAccount(app, 'cohortadmin', 'R1'),
    );
    otherAdmin = await loginAgent(
      app,
      await createAccount(app, 'cohortadmin2', 'R1'),
    );
    for (const role of ['R2', 'R3', 'R4', 'R5', 'R6'])
      denied.push(
        await loginAgent(
          app,
          await createAccount(app, `cohort${role.toLowerCase()}`, role, {
            unitCode: 'PDT',
          }),
        ),
      );
    fixture = await releasedComparisonFixture(app, admin, '1024034');
  });
  afterAll(async () => {
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
  });
  const path = () => `/api/programs/${fixture.programId}/cohort-versions`;
  const cohort = () => createCohort(app, `K-TEST-${++counter}`);
  const schedule = () => readCohortVersions(admin, fixture.programId);
  const mappings = () =>
    prisma.cohortVersion.findMany({
      where: { programVersion: { programId: fixture.programId } },
      orderBy: { id: 'asc' },
    });
  const lookup = (cohortId: string, semesterId = fixture.lastSemesterId) => ({
    programId: fixture.programId,
    cohortId,
    semesterId,
  });
  async function assign(
    cohortIds: string[],
    programVersionId = fixture.beforeVersionId,
    fromSemesterId = fixture.firstSemesterId,
  ) {
    return assignCohorts(admin, fixture.programId, {
      cohortIds,
      programVersionId,
      fromSemesterId,
      expectedRevision: (await schedule()).revision,
    });
  }

  it('publication preserves the selected admission version and leaves unselected cohorts alone; synthetic 1024034 keeps K2023/K2024/K2025 independent', async () => {
    expect(await mappings()).toEqual([
      expect.objectContaining({
        cohortId: fixture.preservedCohortId,
        programVersionId: fixture.beforeVersionId,
        fromSemesterId: fixture.firstSemesterId,
      }),
    ]);
    expect(
      (await appliedVersion(admin, lookup(fixture.preservedCohortId)))
        .assignment!.version.id,
    ).toBe(fixture.beforeVersionId);
    expect(
      (await appliedVersion(admin, lookup(fixture.unselectedCohortId)))
        .assignment,
    ).toBeNull();
    const [k23, k24, k25] = await Promise.all(
      [2023, 2024, 2025].map((intakeYear) =>
        prisma.cohort.create({
          data: { cohortCode: `K${intakeYear}`, intakeYear },
        }),
      ),
    );
    expect((await appliedVersion(admin, lookup(k23.id))).state).toBe(
      'UNASSIGNED',
    );
    await assign([k23.id, k24.id]);
    const old = await mappings();
    await assign(
      [k25.id],
      fixture.intermediateVersionId,
      fixture.middleSemesterId,
    );
    expect((await mappings()).filter((row) => row.cohortId !== k25.id)).toEqual(
      old,
    );
    await assign(
      [k23.id, k24.id],
      fixture.afterVersionId,
      fixture.lastSemesterId,
    );
    for (const id of [k23.id, k24.id]) {
      const middle = await appliedVersion(
        admin,
        lookup(id, fixture.middleSemesterId),
      );
      expect(middle).toMatchObject({
        state: 'ASSIGNED',
        assignment: {
          version: { id: fixture.beforeVersionId, status: 'HISTORICAL' },
        },
      });
      const future = await appliedVersion(admin, lookup(id));
      expect(future).toMatchObject({
        state: 'ASSIGNED',
        assignment: {
          version: { id: fixture.afterVersionId, status: 'PENDING' },
        },
      });
      expect(future.assignment!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
    expect(
      (await appliedVersion(admin, lookup(k25.id))).assignment!.version.id,
    ).toBe(fixture.intermediateVersionId);
    const beforeAdmission = await createSemester(app, -500, 'BEFORE');
    const noAssignment = await appliedVersion(
      admin,
      lookup(k23.id, beforeAdmission.id),
    );
    expect(noAssignment).toMatchObject({
      state: 'UNASSIGNED',
      assignment: null,
    });
    const shared = await app.get(AppliedProgramVersionReader).forCohorts({
      programId: fixture.programId,
      cohortIds: [k25.id, k23.id],
      semesterId: fixture.lastSemesterId,
    });
    expect(shared.map((row) => row.assignment!.version.id)).toEqual([
      fixture.intermediateVersionId,
      fixture.afterVersionId,
    ]);
  });

  it('rolls back an invalid batch, rejects duplicates, Draft, unknown/foreign target and before-effective starts', async () => {
    const target = await cohort();
    const input = {
      cohortIds: [target.id, 'missing-cohort'],
      programVersionId: fixture.beforeVersionId,
      fromSemesterId: fixture.firstSemesterId,
      expectedRevision: (await schedule()).revision,
    };
    const before = await mappings();
    expect(
      (await admin.post(path()).set(CSRF).send(input).expect(404)).body.code,
    ).toBe('COHORT_NOT_FOUND');
    expect(await mappings()).toEqual(before);
    await admin
      .post(path())
      .set(CSRF)
      .send({ ...input, cohortIds: [] })
      .expect(400);
    await admin
      .post(path())
      .set(CSRF)
      .send({ ...input, cohortIds: [target.id, target.id] })
      .expect(400);
    expect(
      (
        await admin
          .post(path())
          .set(CSRF)
          .send({
            ...input,
            cohortIds: [target.id],
            programVersionId: fixture.afterVersionId,
          })
          .expect(409)
      ).body.code,
    ).toBe('ASSIGNMENT_BEFORE_VERSION');
    const foreign = await createProgram(app, { programCode: 'COHORTFOREIGN' });
    await admin
      .post(path())
      .set(CSRF)
      .send({
        ...input,
        cohortIds: [target.id],
        programVersionId: foreign.versions[0].id,
      })
      .expect(404);
    const draft = await admin
      .post(
        `/api/programs/${fixture.programId}/versions/${fixture.afterVersionId}/corrections`,
      )
      .set(CSRF)
      .expect(201);
    expect(
      (
        await admin
          .post(path())
          .set(CSRF)
          .send({
            ...input,
            cohortIds: [target.id],
            programVersionId: draft.body.id,
          })
          .expect(409)
      ).body.code,
    ).toBe('VERSION_NOT_ISSUED');
    const assigned = await assign([target.id]);
    expect(
      (
        await admin
          .post(path())
          .set(CSRF)
          .send({
            ...input,
            cohortIds: [target.id],
            expectedRevision: assigned.revision,
          })
          .expect(409)
      ).body.code,
    ).toBe('COHORT_VERSION_EXISTS');
    const sameStart = await cohort();
    const atLast = await assign(
      [sameStart.id],
      fixture.beforeVersionId,
      fixture.lastSemesterId,
    );
    expect(
      (
        await admin
          .post(path())
          .set(CSRF)
          .send({
            cohortIds: [sameStart.id],
            programVersionId: fixture.intermediateVersionId,
            fromSemesterId: fixture.lastSemesterId,
            expectedRevision: atLast.revision,
          })
          .expect(409)
      ).body.code,
    ).toBe('ASSIGNMENT_START_CONFLICT');
  });

  it('patches only an owned starting semester, preserves identity/createdAt and treats an unchanged patch as a no-op', async () => {
    const target = await cohort();
    const created = await assign([target.id]);
    const row = created.assignments.find(
      (assignment) => assignment.cohort.id === target.id,
    )!;
    const before = await mappings();
    const response = await admin
      .patch(`${path()}/${row.id}`)
      .set(CSRF)
      .send({
        fromSemesterId: fixture.middleSemesterId,
        expectedRevision: created.revision,
      })
      .expect(200);
    expect(response.body.revision).not.toBe(created.revision);
    expect(
      response.body.assignments.find(
        (assignment: { id: string }) => assignment.id === row.id,
      ),
    ).toMatchObject({
      id: row.id,
      cohort: row.cohort,
      version: row.version,
      createdAt: row.createdAt,
      fromSemester: { id: fixture.middleSemesterId },
    });
    expect(
      (await mappings()).filter((mapping) => mapping.id !== row.id),
    ).toEqual(before.filter((mapping) => mapping.id !== row.id));
    expect(
      (await appliedVersion(admin, lookup(target.id, fixture.firstSemesterId)))
        .assignment,
    ).toBeNull();
    const noChange = await admin
      .patch(`${path()}/${row.id}`)
      .set(CSRF)
      .send({
        fromSemesterId: fixture.middleSemesterId,
        expectedRevision: response.body.revision,
      })
      .expect(200);
    expect(noChange.body.revision).toBe(response.body.revision);
    await admin
      .patch(`${path()}/foreign-assignment`)
      .set(CSRF)
      .send({
        fromSemesterId: fixture.middleSemesterId,
        expectedRevision: response.body.revision,
      })
      .expect(404);
    const foreign = await createProgram(app, {
      programCode: 'COHORTPATCHOTHER',
    });
    const otherSchedule = await readCohortVersions(admin, foreign.id);
    await admin
      .patch(`/api/programs/${foreign.id}/cohort-versions/${row.id}`)
      .set(CSRF)
      .send({
        fromSemesterId: fixture.middleSemesterId,
        expectedRevision: otherSchedule.revision,
      })
      .expect(404);
    await admin
      .patch(`${path()}/${row.id}`)
      .set(CSRF)
      .send({
        fromSemesterId: fixture.lastSemesterId,
        expectedRevision: response.body.revision,
        cohortId: 'other',
      })
      .expect(400);
    await admin.delete(`${path()}/${row.id}`).set(CSRF).expect(404);
    const current = await schedule();
    const conflicting = current.assignments.find(
      (assignment) =>
        assignment.cohort.cohortCode === 'K2023' &&
        assignment.version.id === fixture.beforeVersionId,
    )!;
    expect(
      (
        await admin
          .patch(`${path()}/${conflicting.id}`)
          .set(CSRF)
          .send({
            fromSemesterId: fixture.lastSemesterId,
            expectedRevision: current.revision,
          })
          .expect(409)
      ).body.code,
    ).toBe('ASSIGNMENT_START_CONFLICT');
  });

  it('requires explicit known evaluation dates and never falls back to currentVersion', async () => {
    const target = await cohort();
    const endpoint = `/api/programs/${fixture.programId}/cohorts/${target.id}/applied-version`;
    await admin.get(endpoint).expect(400);
    await admin.get(endpoint).query({ semesterId: 'missing' }).expect(404);
    const unknown = await createSemester(app, null, 'UNKNOWN');
    expect(
      (await admin.get(endpoint).query({ semesterId: unknown.id }).expect(409))
        .body.code,
    ).toBe('SEMESTER_START_UNKNOWN');
    await admin
      .get(`/api/programs/${fixture.programId}/cohorts/missing/applied-version`)
      .query({ semesterId: fixture.firstSemesterId })
      .expect(404);
    expect(await appliedVersion(admin, lookup(target.id))).toMatchObject({
      state: 'UNASSIGNED',
      assignment: null,
    });
  });

  it('invalidates a stale revision for any calendar edit, including a previously unknown target', async () => {
    const target = await cohort();
    const unknown = await createSemester(app, null, 'EDITED');
    const revision = (await schedule()).revision;
    await admin
      .patch(`/api/semesters/${unknown.id}`)
      .set(CSRF)
      .send({ startDate: '2090-01-01' })
      .expect(200);
    const before = await mappings();
    const refused = await admin
      .post(path())
      .set(CSRF)
      .send({
        cohortIds: [target.id],
        programVersionId: fixture.beforeVersionId,
        fromSemesterId: fixture.firstSemesterId,
        expectedRevision: revision,
      })
      .expect(409);
    expect(refused.body.code).toBe('ASSIGNMENT_STATE_CHANGED');
    expect(await mappings()).toEqual(before);
  });

  it('allows at most one administrator to commit the same revision, with no partial batches', async () => {
    const targets = [
      await cohort(),
      await cohort(),
      await cohort(),
      await cohort(),
    ];
    const revision = (await schedule()).revision;
    const responses = await Promise.all(
      [admin, otherAdmin].map((agent, index) =>
        agent
          .post(path())
          .set(CSRF)
          .send({
            cohortIds: targets
              .slice(index * 2, index * 2 + 2)
              .map((row) => row.id),
            programVersionId: fixture.beforeVersionId,
            fromSemesterId: fixture.firstSemesterId,
            expectedRevision: revision,
          }),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      responses.find((response) => response.status === 409)!.body.code,
    ).toBe('ASSIGNMENT_STATE_CHANGED');
    const inserted = (await mappings()).filter((row) =>
      targets.some((target) => target.id === row.cohortId),
    );
    expect(inserted).toHaveLength(2);
    const winner = responses.findIndex((response) => response.status === 201);
    expect(inserted.map((row) => row.cohortId).sort()).toEqual(
      targets
        .slice(winner * 2, winner * 2 + 2)
        .map((row) => row.id)
        .sort(),
    );
  });

  it('denies staff without assignment permission and missing CSRF without changing complete mapping values', async () => {
    const target = await cohort();
    const created = await assign([target.id]);
    const row = created.assignments.find(
      (assignment) => assignment.cohort.id === target.id,
    )!;
    const before = await mappings();
    const input = {
      cohortIds: [target.id],
      programVersionId: fixture.afterVersionId,
      fromSemesterId: fixture.lastSemesterId,
      expectedRevision: created.revision,
    };
    for (const agent of denied) {
      await agent.get(path()).expect(403);
      await agent.post(path()).set(CSRF).send(input).expect(403);
      await agent
        .patch(`${path()}/${row.id}`)
        .set(CSRF)
        .send({
          fromSemesterId: fixture.middleSemesterId,
          expectedRevision: created.revision,
        })
        .expect(403);
      await agent
        .get(
          `/api/programs/${fixture.programId}/cohorts/${target.id}/applied-version`,
        )
        .query({ semesterId: fixture.lastSemesterId })
        .expect(403);
    }
    await admin.post(path()).send(input).expect(403);
    await admin
      .patch(`${path()}/${row.id}`)
      .send({
        fromSemesterId: fixture.middleSemesterId,
        expectedRevision: created.revision,
      })
      .expect(403);
    expect(await mappings()).toEqual(before);
  });

  it('reads legacy same-date ties deterministically and refuses malformed legacy timelines rather than skipping them', async () => {
    const target = await cohort();
    const createdAt = new Date('2025-01-01');
    // The release writer permits ties, while the new assignment API intentionally cannot create this state.
    const rows = await Promise.all(
      [fixture.beforeVersionId, fixture.intermediateVersionId].map(
        (programVersionId) =>
          prisma.cohortVersion.create({
            data: {
              cohortId: target.id,
              programVersionId,
              fromSemesterId: fixture.lastSemesterId,
              createdAt,
            },
          }),
      ),
    );
    const winner = [...rows].sort((left, right) =>
      left.id < right.id ? 1 : -1,
    )[0];
    expect(
      (await appliedVersion(admin, lookup(target.id))).assignment!.id,
    ).toBe(winner.id);
    const invalid = await cohort();
    // Only an integrity fixture can represent a link preceding release eligibility; public writes reject it.
    const malformed = await prisma.cohortVersion.create({
      data: {
        cohortId: invalid.id,
        programVersionId: fixture.afterVersionId,
        fromSemesterId: fixture.firstSemesterId,
      },
    });
    const response = await admin
      .get(
        `/api/programs/${fixture.programId}/cohorts/${invalid.id}/applied-version`,
      )
      .query({ semesterId: fixture.lastSemesterId })
      .expect(409);
    expect(response.body.code).toBe('INVALID_COHORT_ASSIGNMENT');
    await prisma.cohortVersion.delete({ where: { id: malformed.id } });
  });

  it('isolates the same cohort assignments across two programs', async () => {
    const target = await cohort();
    const other = await createProgram(app, { programCode: 'COHORTISOLATED' });
    const versionId = other.versions[0].id;
    await addCurriculumItem(admin, versionId, {
      courseId: fixture.courseId,
      plannedSemester: 1,
    });
    await releaseViaApi(app, admin, {
      programId: other.id,
      versionId,
      semesterId: fixture.firstSemesterId,
    });
    const otherSchedule = await readCohortVersions(admin, other.id);
    await assignCohorts(admin, other.id, {
      cohortIds: [target.id],
      programVersionId: versionId,
      fromSemesterId: fixture.firstSemesterId,
      expectedRevision: otherSchedule.revision,
    });
    expect(
      (await appliedVersion(admin, lookup(target.id))).assignment,
    ).toBeNull();
    expect(
      (
        await appliedVersion(admin, {
          ...lookup(target.id),
          programId: other.id,
        })
      ).assignment!.version.id,
    ).toBe(versionId);
  });

  it('activation changes only lifecycle metadata, never mappings, schedule revisions or comparison content', async () => {
    const semester = await prisma.semester.findUniqueOrThrow({
      where: { id: fixture.lastSemesterId },
    });
    const endpoint = `/api/programs/${fixture.programId}/version-comparison`;
    const query = {
      beforeVersionId: fixture.beforeVersionId,
      afterVersionId: fixture.afterVersionId,
    };
    const comparison = (await admin.get(endpoint).query(query).expect(200))
      .body;
    const before = await mappings();
    const revision = (await schedule()).revision;
    await app.get(ReleaseActivationProcessor).reconcile(semester.startDate!);
    expect(
      (
        await prisma.programVersion.findUniqueOrThrow({
          where: { id: fixture.afterVersionId },
        })
      ).status,
    ).toBe('ACTIVE');
    expect(await mappings()).toEqual(before);
    expect((await schedule()).revision).toBe(revision);
    expect(
      (await admin.get(endpoint).query(query).expect(200)).body.sections,
    ).toEqual(comparison.sections);
  });

  it('shares the Program lock with an existing correction writer without moving unselected cohorts', async () => {
    const draft = await admin
      .post(
        `/api/programs/${fixture.programId}/versions/${fixture.afterVersionId}/corrections`,
      )
      .set(CSRF)
      .expect(201);
    const targets = [await cohort(), await cohort()];
    const before = await mappings();
    const revision = (await schedule()).revision;
    const [correction, assignment] = await Promise.all([
      admin
        .post(
          `/api/programs/${fixture.programId}/versions/${fixture.afterVersionId}/corrections/${draft.body.id}/issue`,
        )
        .set(CSRF)
        .send({
          reason: 'Đính chính song song với phân bổ khóa.',
          moveCohorts: false,
        }),
      otherAdmin
        .post(path())
        .set(CSRF)
        .send({
          cohortIds: targets.map((row) => row.id),
          programVersionId: fixture.beforeVersionId,
          fromSemesterId: fixture.middleSemesterId,
          expectedRevision: revision,
        }),
    ]);
    expect(correction.status).toBe(201);
    expect([201, 409]).toContain(assignment.status);
    if (assignment.status === 409)
      expect(assignment.body.code).toBe('ASSIGNMENT_STATE_CHANGED');
    const after = await mappings();
    expect(
      after.filter(
        (row) => !targets.some((target) => target.id === row.cohortId),
      ),
    ).toEqual(before);
    expect(
      after.filter((row) =>
        targets.some((target) => target.id === row.cohortId),
      ),
    ).toHaveLength(assignment.status === 201 ? 2 : 0);
  });
});
