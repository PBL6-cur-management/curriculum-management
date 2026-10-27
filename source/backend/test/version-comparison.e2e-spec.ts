import type { NestExpressApplication } from '@nestjs/platform-express';
import type request from 'supertest';
import { seedApprovalLevels } from '../prisma/seed-data/approval-levels.js';
import { seedAccessControl } from '../prisma/seed-data/seed-access-control.js';
import type {
  VersionComparisonDto,
  PinnedSyllabusComparisonDto,
} from '../src/features/releases/dto/version-comparison.dto.js';
import { PERMISSIONS } from '../src/shared/authz/permission-codes.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import { openRequest } from './fixtures/change-requests.js';
import { createForeignFaculty } from './fixtures/courses.js';
import { createProgram } from './fixtures/programs.js';
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
describe('issued version comparison', () => {
  let postgres: TestPostgres;
  let redis: TestRedis;
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let student: Agent;
  let fixture: ComparedVersionFixture;
  const staff: Agent[] = [];

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
    admin = await loginAgent(app, await createAccount(app, 'cmpadmin', 'R1'));
    student = await loginAgent(
      app,
      await createAccount(app, 'cmpstudent', 'R6', { unitCode: 'PDT' }),
    );
    for (const role of ['R2', 'R3', 'R4', 'R5'])
      staff.push(
        await loginAgent(
          app,
          await createAccount(app, `cmp${role.toLowerCase()}`, role, {
            unitCode: 'KHOA_CNTT',
          }),
        ),
      );
    fixture = await releasedComparisonFixture(app, admin);
  });
  afterAll(async () => {
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
  });

  const path = () => `/api/programs/${fixture.programId}/version-comparison`;
  const query = () => ({
    beforeVersionId: fixture.beforeVersionId,
    afterVersionId: fixture.afterVersionId,
  });
  const compare = async (agent = admin, input = query()) =>
    (await agent.get(path()).query(input).expect(200))
      .body as VersionComparisonDto;

  it('compares non-adjacent frozen endpoints in six sections, not copied row ids or live course values', async () => {
    const original = await prisma.curriculumItem.findFirstOrThrow({
      where: { versionId: fixture.beforeVersionId, courseId: fixture.courseId },
    });
    const copied = await prisma.curriculumItem.findFirstOrThrow({
      where: { versionId: fixture.afterVersionId, courseId: fixture.courseId },
    });
    expect(copied.id).not.toBe(original.id);
    const result = await compare();
    expect(result.before).toMatchObject({
      id: fixture.beforeVersionId,
      status: 'HISTORICAL',
      versionNumber: '1.0',
      decisionNumber: 'QD-TEST',
    });
    expect(result.after).toMatchObject({
      id: fixture.afterVersionId,
      status: 'PENDING',
      decisionNumber: 'QD-CMP-3',
    });
    expect(result.sections.map((section) => section.key)).toEqual([
      'INFO',
      'CURRICULUM',
      'ELECTIVE_GROUPS',
      'PLOS',
      'MATRICES',
      'SYLLABI',
    ]);
    expect(result.sections.every((section) => section.rows.length > 0)).toBe(
      true,
    );
    const moved = result.sections[1].rows.find((row) =>
      row.fields.some((field) => field.name === 'plannedSemester'),
    )!;
    expect(moved).toMatchObject({
      change: 'CHANGED',
      label: expect.stringContaining(original.courseNameSnapshot!),
    });
    expect(moved.fields).toContainEqual({
      name: 'plannedSemester',
      label: 'Học kỳ',
      before: '2',
      after: '3',
    });
    expect(result.sections[1].rows.flatMap((row) => row.fields)).toContainEqual(
      { name: 'minScore', label: 'Ngưỡng điểm', before: '4', after: '3' },
    );
    expect(result.sections[4].rows.flatMap((row) => row.fields)).toContainEqual(
      { name: 'weight', label: 'Trọng số', before: '0.25', after: '0.5' },
    );
    expect(
      result.sections[4].rows.some((row) => row.change === 'REMOVED'),
    ).toBe(true);
    expect(result.after.effectiveSemester.startDate).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
    await prisma.course.update({
      where: { id: fixture.courseId },
      data: { courseName: 'Tên danh mục đã đổi', credits: '4' },
    });
    expect((await compare()).sections).toEqual(result.sections);
  });

  it('retains six empty groups for the same issued version and unchanged academic groups for a pins-only release', async () => {
    const same = await compare(admin, {
      beforeVersionId: fixture.beforeVersionId,
      afterVersionId: fixture.beforeVersionId,
    });
    expect(same.sections).toHaveLength(6);
    expect(same.sections.every((section) => section.rows.length === 0)).toBe(
      true,
    );
    const pinsOnly = await compare(admin, {
      beforeVersionId: fixture.intermediateVersionId,
      afterVersionId: fixture.afterVersionId,
    });
    expect(
      pinsOnly.sections
        .slice(0, 5)
        .every((section) => section.rows.length === 0),
    ).toBe(true);
    expect(pinsOnly.sections[5].rows[0].syllabusComparison).toEqual({
      courseId: fixture.courseId,
      beforeSyllabusId: fixture.beforeSyllabusId,
      afterSyllabusId: fixture.afterSyllabusId,
    });
  });

  it('derives the two real pins and returns plain-text text/weeks/CLO differences; equal pins are valid', async () => {
    const response = await admin
      .get(`${path()}/syllabi/${fixture.courseId}`)
      .query(query())
      .expect(200);
    const result = response.body as PinnedSyllabusComparisonDto;
    expect(result.before).toMatchObject({
      id: fixture.beforeSyllabusId,
      revisionNumber: 1,
      status: 'HISTORICAL',
    });
    expect(result.after).toMatchObject({
      id: fixture.afterSyllabusId,
      revisionNumber: 2,
    });
    expect(result.sections.map((section) => section.entityType)).toEqual([
      'SYLLABUS_FIELD',
      'WEEKLY_CONTENTS',
      'CLO',
    ]);
    expect(result.sections.every((section) => section.rows.length > 0)).toBe(
      true,
    );
    expect(JSON.stringify(result.sections)).not.toContain('<p>');
    const equal = await admin
      .get(`${path()}/syllabi/${fixture.courseId}`)
      .query({
        beforeVersionId: fixture.beforeVersionId,
        afterVersionId: fixture.beforeVersionId,
      })
      .expect(200);
    expect(
      equal.body.sections.every(
        (section: { rows: unknown[] }) => section.rows.length === 0,
      ),
    ).toBe(true);
    await admin
      .get(`${path()}/syllabi/unknown-course`)
      .query(query())
      .expect(404);
    await admin
      .get(`${path()}/syllabi/${fixture.courseId}`)
      .query({ ...query(), beforeSyllabusId: fixture.afterSyllabusId })
      .expect(400);
  });

  it('does not write snapshots, change items, assignments or version timestamps during reads', async () => {
    const snapshot = async () => ({
      items: await prisma.changeItem.count(),
      assignments: await prisma.cohortVersion.findMany({
        orderBy: { id: 'asc' },
      }),
      versions: await prisma.programVersion.findMany({
        where: { programId: fixture.programId },
        select: { id: true, updatedAt: true },
        orderBy: { id: 'asc' },
      }),
    });
    const before = await snapshot();
    await compare();
    await admin
      .get(`${path()}/syllabi/${fixture.courseId}`)
      .query(query())
      .expect(200);
    expect(await snapshot()).toEqual(before);
  });

  it('preserves history, origin links and immutable detail pins', async () => {
    const history = await admin
      .get(`/api/programs/${fixture.programId}/versions`)
      .expect(200);
    expect(
      history.body.versions.map((version: { id: string }) => version.id),
    ).toEqual(
      expect.arrayContaining([
        fixture.beforeVersionId,
        fixture.intermediateVersionId,
        fixture.afterVersionId,
      ]),
    );
    const detail = await admin
      .get(
        `/api/programs/${fixture.programId}/versions/${fixture.afterVersionId}`,
      )
      .expect(200);
    expect(detail.body.originRequest).toBeTruthy();
    const old = await admin
      .get(
        `/api/programs/${fixture.programId}/versions/${fixture.beforeVersionId}`,
      )
      .expect(200);
    expect(
      old.body.rows.find(
        (row: { courseId: string }) => row.courseId === fixture.courseId,
      ).syllabus.id,
    ).toBe(fixture.beforeSyllabusId);
    await admin
      .patch(`/api/curriculum-items/${old.body.rows[0].itemId}`)
      .set(CSRF)
      .send({ plannedSemester: 4 })
      .expect(409);
  });

  it('allows seeded staff permissions and denies R6, missing queries, drafts, correction drafts, working copies and foreign versions', async () => {
    for (const agent of staff) await compare(agent);
    await student.get(path()).query(query()).expect(403);
    await admin.get(path()).expect(400);
    await admin.get(path()).query({ beforeVersionId: '' }).expect(400);
    const draft = await createProgram(app, { programCode: 'CMPDRAFT' });
    await admin
      .get(`/api/programs/${draft.id}/version-comparison`)
      .query({
        beforeVersionId: draft.versions[0].id,
        afterVersionId: draft.versions[0].id,
      })
      .expect(409);
    await admin
      .get(path())
      .query({ ...query(), afterVersionId: draft.versions[0].id })
      .expect(404);
    const correction = await admin
      .post(
        `/api/programs/${fixture.programId}/versions/${fixture.afterVersionId}/corrections`,
      )
      .set(CSRF)
      .expect(201);
    await admin
      .get(path())
      .query({ ...query(), afterVersionId: correction.body.id })
      .expect(409);
    const workingRequest = await openRequest(admin, {
      requestType: 'CURRICULUM',
      targetType: 'PROGRAM',
      targetId: fixture.programId,
    });
    await admin
      .get(path())
      .query({ ...query(), afterVersionId: workingRequest.workspace!.copyId })
      .expect(409);
  });

  it('enforces custom program and syllabus scopes without accidental SYSTEM assignments', async () => {
    await createForeignFaculty(app, 'CMP_OUTSIDE');
    const role = await prisma.role.create({
      data: {
        roleCode: 'CMP_SCOPED',
        roleName: 'Scoped comparison',
        scopeSource: 'NONE',
        rolePermissions: {
          create: [
            PERMISSIONS.PROGRAM_VIEW,
            PERMISSIONS.VERSION_COMPARE,
            PERMISSIONS.SYLLABUS_VIEW,
          ].map((permissionCode) => ({
            permission: { connect: { permissionCode } },
            mode: 'DIRECT',
            scope: 'SCOPED',
          })),
        },
      },
    });
    const outsider = await loginAgent(
      app,
      await createAccount(app, 'cmpoutside', role.roleCode, {
        unitCode: 'CMP_OUTSIDE',
      }),
    );
    await outsider.get(path()).query(query()).expect(403);
    await prisma.rolePermission.updateMany({
      where: {
        roleId: role.id,
        permission: {
          permissionCode: {
            in: [PERMISSIONS.PROGRAM_VIEW, PERMISSIONS.VERSION_COMPARE],
          },
        },
      },
      data: { scope: 'ALL' },
    });
    await outsider.get(path()).query(query()).expect(200);
    await outsider
      .get(`${path()}/syllabi/${fixture.courseId}`)
      .query(query())
      .expect(403);
  });
});
