import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seedAccessControl } from '../prisma/seed-data/seed-access-control.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { RegistrationEligibilityReader } from '../src/shared/registration-eligibility/registration-eligibility.reader.js';
import { ScopeService } from '../src/shared/authz/scope.service.js';
import {
  startPostgres,
  startRedis,
  type TestPostgres,
  type TestRedis,
} from './containers.js';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import { assignDirector } from './fixtures/programs.js';
import { createSyntheticStudentFixture } from './fixtures/students.js';
import { createSemester } from './fixtures/releases.js';
import { createCourse } from './fixtures/courses.js';
import {
  createEligibilityFixture,
  getEligibility,
  setEligibilityResult,
  type EligibilityFixture,
} from './fixtures/registration-eligibility.js';
import { createTestApp } from './test-app.js';
import { setAppEnv } from './test-env.js';

type Agent = ReturnType<typeof request.agent>;
describe('registration eligibility API', () => {
  let postgres: TestPostgres;
  let redis: TestRedis;
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let office: Agent;
  let own: Agent;
  let director: Agent;
  let fixture: EligibilityFixture;
  let other: EligibilityFixture;
  let officeId: string;
  let sameProgramStudentId: string;
  beforeAll(async () => {
    [postgres, redis] = await Promise.all([
      startPostgres({ vietnameseCollation: true }),
      startRedis(),
    ]);
    setAppEnv(postgres, redis);
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await seedAccessControl(prisma);
    const account = await createAccount(app, 'eligoffice', 'R1');
    officeId = account.id;
    office = await loginAgent(app, account);
    fixture = await createEligibilityFixture(app, office, 'API');
    sameProgramStudentId = (
      await createSyntheticStudentFixture(app, 'ELIGSAME', fixture.world)
    ).studentId;
    other = await createEligibilityFixture(app, office, 'OTHER');
    const student = await prisma.user.findUniqueOrThrow({
      where: { id: fixture.studentUserId },
    });
    own = await loginAgent(app, {
      id: student.id,
      username: student.username,
      password: `${student.username}Pass1`,
    });
    const directorAccount = await createAccount(app, 'eligdirector', 'R3', {
      unitCode: 'KHOA_CNTT',
    });
    await assignDirector(app, {
      programId: fixture.programId,
      userId: directorAccount.id,
    });
    director = await loginAgent(app, directorAccount);
  });
  afterAll(async () => {
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
  });
  const path = (target: EligibilityFixture) =>
    `/api/students/${target.studentId}/registration-eligibility`;
  const query = (target: EligibilityFixture) => ({
    programId: target.programId,
    semesterId: target.semesterId,
  });

  it('returns all frozen items with own and propagated blockers, not empty success', async () => {
    const answer = await getEligibility(office, fixture);
    expect(answer.context.programVersionId).toBe(fixture.versionId);
    expect(answer.items).toHaveLength(4);
    const target = answer.items.find(
      (item) => item.itemId === fixture.itemIds.get('0'),
    )!;
    expect(target.eligibility).toBe('INELIGIBLE');
    expect(target.reasons.map((reason) => reason.code)).toEqual([
      'PREREQUISITE_NOT_PASSED',
      'COREQUISITE_INELIGIBLE',
    ]);
    expect(target.reasons[1]).toMatchObject({
      causeCode: 'PRIOR_RESULT_MISSING',
      requiredCourse: { id: fixture.courseIds.get('3') },
      viaCourse: { id: fixture.courseIds.get('2') },
    });
    expect(target.requiredConcurrentCourses).toEqual([]);
  });
  it('enforces subject ownership and scoped staff picker', async () => {
    await getEligibility(own, fixture);
    await getEligibility(director, fixture);
    await own.get(path(other)).query(query(other)).expect(404);
    await own
      .get(`/api/students/${sameProgramStudentId}/registration-eligibility`)
      .query(query(fixture))
      .expect(404);
    await director.get(path(other)).query(query(other)).expect(404);
    await own
      .get(
        `/api/programs/${fixture.programId}/registration-eligibility/students`,
      )
      .query({ semesterId: fixture.semesterId })
      .expect(403);
    const picker = await director
      .get(
        `/api/programs/${fixture.programId}/registration-eligibility/students`,
      )
      .query({ semesterId: fixture.semesterId, q: 'SYNELIGAPI' })
      .expect(200);
    expect(picker.body.items.map((row: { id: string }) => row.id)).toEqual([
      fixture.studentId,
    ]);
    expect(Object.keys(picker.body.items[0]).sort()).toEqual([
      'fullName',
      'id',
      'studentCode',
    ]);
    await director
      .get(`/api/programs/${other.programId}/registration-eligibility/students`)
      .query({ semesterId: other.semesterId })
      .expect(403);
  });
  it('rejects anonymous, arbitrary override fields and absent context', async () => {
    await request(app.getHttpServer())
      .get(path(fixture))
      .query(query(fixture))
      .expect(401);
    await office
      .get(path(fixture))
      .query({ ...query(fixture), maxDepth: 100 })
      .expect(400);
    await office
      .get(path(fixture))
      .query({ semesterId: fixture.semesterId })
      .expect(400);
  });
  it('uses final FAILED prior evidence and inclusive passed thresholds, then exemption semantics', async () => {
    await setEligibilityResult(app, fixture, '3', 'FAILED', '0', officeId);
    await setEligibilityResult(app, fixture, '1', 'PASSED', '2.49', officeId);
    let answer = await getEligibility(office, fixture);
    expect(answer.items[0].reasons[0]).toMatchObject({
      code: 'PREREQUISITE_SCORE_TOO_LOW',
      actualScore4: '2.49',
      requiredScore4: '2.5',
    });
    await setEligibilityResult(app, fixture, '1', 'PASSED', '2.5', officeId);
    answer = await getEligibility(office, fixture);
    expect(answer.items[0].eligibility).toBe('CONDITIONAL');
    expect(
      answer.items[0].requiredConcurrentCourses.map((course) => course.id),
    ).toEqual([fixture.courseIds.get('2')]);
    await setEligibilityResult(app, fixture, '1', 'EXEMPT', null, officeId);
    expect(
      (await getEligibility(office, fixture)).items[0].reasons[0].code,
    ).toBe('PREREQUISITE_SCORE_MISSING');
    await setEligibilityResult(app, fixture, '0', 'EXEMPT', null, officeId);
    expect((await getEligibility(office, fixture)).items[0]).toMatchObject({
      completed: true,
      eligibility: null,
      requiredConcurrentCourses: [],
    });
  });
  it('does not write business rows during repeat evaluation', async () => {
    const snapshot = async () => ({
      student: await prisma.student.findUnique({
        where: { id: fixture.studentId },
      }),
      enrollments: await prisma.programEnrollment.findMany({
        where: { studentId: fixture.studentId },
        orderBy: { id: 'asc' },
      }),
      results: await prisma.academicResult.findMany({
        where: { studentId: fixture.studentId },
        orderBy: { id: 'asc' },
      }),
      items: await prisma.curriculumItem.findMany({
        where: { versionId: fixture.versionId },
        orderBy: { id: 'asc' },
      }),
    });
    const before = await snapshot();
    await getEligibility(office, fixture);
    await getEligibility(office, fixture);
    expect(await snapshot()).toEqual(before);
  });
  it('uses the same answer for HTTP and an authorized supplied-transaction consumer', async () => {
    const access = await app.get(ScopeService).loadAccess(officeId);
    const direct = await prisma.$transaction((tx) =>
      app
        .get(RegistrationEligibilityReader)
        .forAccess(access)
        .evaluate(fixture, tx),
    );
    const http = await getEligibility(office, fixture);
    expect({ ...http, evaluatedAt: direct.evaluatedAt }).toEqual(direct);
  });
  it('fails closed on explicit snapshot corruption', async () => {
    const itemId = other.itemIds.get('0')!;
    await prisma.curriculumItem.update({
      where: { id: itemId },
      data: { creditsSnapshot: null },
    });
    const response = await office
      .get(path(other))
      .query(query(other))
      .expect(409);
    expect(response.body.code).toBe('ELIGIBILITY_SNAPSHOT_INCOMPLETE');
  });
  it('keeps unknown enrollment ends out of the picker and fails direct resolution closed under explicit corruption', async () => {
    const unknown = await createSemester(app, null, 'ELIG-UNKNOWN');
    const enrollment = await prisma.programEnrollment.findFirstOrThrow({
      where: { studentId: fixture.studentId },
    });
    await prisma.programEnrollment.update({
      where: { id: enrollment.id },
      data: { untilSemesterId: unknown.id, status: 'ENDED' },
    });
    try {
      const response = await office
        .get(path(fixture))
        .query(query(fixture))
        .expect(409);
      expect(response.body.code).toBe('INVALID_ENROLLMENT_INTERVAL');
      const picker = await office
        .get(
          `/api/programs/${fixture.programId}/registration-eligibility/students`,
        )
        .query({ semesterId: fixture.semesterId, q: 'SYNELIGAPI' })
        .expect(200);
      expect(picker.body.items).toEqual([]);
    } finally {
      await prisma.programEnrollment.update({
        where: { id: enrollment.id },
        data: { untilSemesterId: null, status: 'ACTIVE' },
      });
    }
  });
  it('recognizes equivalent evidence outside the frozen framework through the actual group API', async () => {
    const external = await createCourse(app, {
      courseCode: 'SYN-ELIG-OUTSIDE',
    });
    await office
      .post('/api/equivalence-groups')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        groupCode: 'SYN-ELIG-EQUIV',
        courseIds: [fixture.courseIds.get('2'), external.id],
      })
      .expect(201);
    const courseIds = new Map(fixture.courseIds);
    courseIds.set('outside', external.id);
    await setEligibilityResult(
      app,
      { ...fixture, courseIds },
      'outside',
      'EXEMPT',
      null,
      officeId,
    );
    const answer = await getEligibility(office, fixture);
    const completed = answer.items.find(
      (item) => item.itemId === fixture.itemIds.get('2'),
    )!;
    expect(completed).toMatchObject({ completed: true, eligibility: null });
    expect(completed.reasons[0]).toMatchObject({
      code: 'EQUIVALENT_COMPLETED',
      actualStatus: 'EXEMPT',
      actualScore4: null,
      evidenceCourse: { id: external.id, nameSource: 'CATALOG' },
    });
  });
});
