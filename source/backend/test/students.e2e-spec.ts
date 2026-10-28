import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seedAccessControl } from '../prisma/seed-data/seed-access-control.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import {
  startPostgres,
  startRedis,
  type TestPostgres,
  type TestRedis,
} from './containers.js';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import { assignDirector } from './fixtures/programs.js';
import {
  createStudentWorld,
  createSyntheticStudentFixture,
  type StudentWorld,
  type SyntheticStudentFixture,
} from './fixtures/students.js';
import { createTestApp } from './test-app.js';
import { setAppEnv } from './test-env.js';

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };
type Agent = ReturnType<typeof request.agent>;

const SUMMARY_KEYS = [
  'cohort',
  'dataSource',
  'fullName',
  'id',
  'major',
  'status',
  'studentCode',
  'updatedAt',
];
const DETAIL_KEYS = [
  ...SUMMARY_KEYS,
  'admissionSemester',
  'canManageEnrollments',
  'enrollmentWarnings',
  'enrollments',
  'statusSemester',
  'userId',
];
const RESULT_KEYS = [
  'course',
  'dataSource',
  'id',
  'letterGrade',
  'revision',
  'score10',
  'score4',
  'semester',
  'status',
  'studentId',
  'updatedAt',
];

describe('Students API', () => {
  let postgres: TestPostgres;
  let redis: TestRedis;
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let director: Agent;
  let directorOfB: Agent;
  let worldA: StudentWorld;
  let worldB: StudentWorld;
  const inA: SyntheticStudentFixture[] = [];
  const inB: SyntheticStudentFixture[] = [];

  beforeAll(async () => {
    [postgres, redis] = await Promise.all([
      startPostgres({ vietnameseCollation: true }),
      startRedis(),
    ]);
    setAppEnv(postgres, redis);
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await seedAccessControl(prisma);
    admin = await loginAgent(app, await createAccount(app, 'stuapi', 'R1'));
    worldA = await createStudentWorld(app, admin, 'APA');
    worldB = await createStudentWorld(app, admin, 'APB');
    for (const suffix of ['A1', 'A2', 'A3']) {
      inA.push(await createSyntheticStudentFixture(app, suffix, worldA));
    }
    for (const suffix of ['B1', 'B2']) {
      inB.push(await createSyntheticStudentFixture(app, suffix, worldB));
    }
    const directorAccount = await createAccount(app, 'stuapidir', 'R3', {
      unitCode: 'KHOA_CNTT',
    });
    await assignDirector(app, {
      programId: worldA.programId,
      userId: directorAccount.id,
    });
    director = await loginAgent(app, directorAccount);
    const directorBAccount = await createAccount(app, 'stuapidirb', 'R3', {
      unitCode: 'KHOA_CNTT',
    });
    await assignDirector(app, {
      programId: worldB.programId,
      userId: directorBAccount.id,
    });
    directorOfB = await loginAgent(app, directorBAccount);
  });

  afterAll(async () => {
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
  });

  const semester = () => ({ semesterId: worldA.admissionSemesterId });
  const inProgram = (world: StudentWorld) => ({
    ...semester(),
    programId: world.programId,
  });

  async function asStudent(fixture: SyntheticStudentFixture): Promise<Agent> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: fixture.userId },
    });
    return loginAgent(app, {
      id: user.id,
      username: user.username,
      password: `${user.username}Pass1`,
    });
  }

  describe('list', () => {
    it('gives the office every enrolled student and filters by program', async () => {
      const all = await admin
        .get('/api/students')
        .query(semester())
        .expect(200);
      expect(all.body.total).toBe(inA.length + inB.length);
      const onlyA = await admin
        .get('/api/students')
        .query(inProgram(worldA))
        .expect(200);
      expect(onlyA.body.total).toBe(inA.length);
      expect(
        onlyA.body.items.map((row: { id: string }) => row.id).sort(),
      ).toEqual(inA.map((row) => row.studentId).sort());
    });

    it('scopes a director and shares the scope between count and items', async () => {
      const seen = await director
        .get('/api/students')
        .query(semester())
        .expect(200);
      expect(seen.body.total).toBe(inA.length);
      expect(seen.body.items).toHaveLength(inA.length);
      const foreign = await director
        .get('/api/students')
        .query(inProgram(worldB))
        .expect(200);
      expect(foreign.body.total).toBe(0);
      expect(foreign.body.items).toEqual([]);

      inB.push(await createSyntheticStudentFixture(app, 'B9', worldB));
      const again = await director
        .get('/api/students')
        .query(semester())
        .expect(200);
      expect(again.body.total).toBe(inA.length);
    });

    it('paginates in a stable order and filters by search, status and cohort', async () => {
      const first = await admin
        .get('/api/students')
        .query({ ...semester(), pageSize: 2, page: 1 })
        .expect(200);
      const second = await admin
        .get('/api/students')
        .query({ ...semester(), pageSize: 2, page: 2 })
        .expect(200);
      const items = [...first.body.items, ...second.body.items] as {
        id: string;
        fullName: string;
      }[];
      expect(new Set(items.map((row) => row.id)).size).toBe(items.length);
      const names = items.map((row) => row.fullName);
      expect(names).toEqual(
        [...names].sort((a, b) => a.localeCompare(b, 'vi')),
      );

      const search = await admin
        .get('/api/students')
        .query({ ...semester(), q: 'SYNA2' })
        .expect(200);
      expect(
        search.body.items.map(
          (row: { studentCode: string }) => row.studentCode,
        ),
      ).toEqual(['SYNA2']);

      const none = await admin
        .get('/api/students')
        .query({ ...semester(), status: 'GRADUATED' })
        .expect(200);
      expect(none.body.total).toBe(0);

      const cohort = await admin
        .get('/api/students')
        .query({ ...semester(), cohortId: worldB.cohortId })
        .expect(200);
      expect(cohort.body.total).toBe(inB.length);
    });

    it('exposes only the documented keys', async () => {
      const page = await admin
        .get('/api/students')
        .query(semester())
        .expect(200);
      expect(Object.keys(page.body.items[0]).sort()).toEqual(SUMMARY_KEYS);
    });
  });

  describe('detail, results, applied version and targets', () => {
    it('shows the office a full profile with the documented keys', async () => {
      const detail = await admin
        .get(`/api/students/${inA[0]!.studentId}`)
        .query(semester())
        .expect(200);
      expect(Object.keys(detail.body).sort()).toEqual([...DETAIL_KEYS].sort());
      expect(detail.body.canManageEnrollments).toBe(true);
      expect(detail.body.enrollments).toHaveLength(1);
    });

    it('requires a program for a director and hides foreign students', async () => {
      const noProgram = await director
        .get(`/api/students/${inA[0]!.studentId}`)
        .query(semester());
      expect(noProgram.status).toBe(400);
      expect(noProgram.body.code).toBe('PROGRAM_CONTEXT_REQUIRED');

      const own = await director
        .get(`/api/students/${inA[0]!.studentId}`)
        .query(inProgram(worldA))
        .expect(200);
      expect(own.body.canManageEnrollments).toBe(false);

      const foreign = await director
        .get(`/api/students/${inB[0]!.studentId}`)
        .query(inProgram(worldA));
      expect(foreign.status).toBe(404);
      expect(foreign.body.code).toBe('STUDENT_NOT_FOUND');
    });

    it('hides enrollments of other programs from a director', async () => {
      const shared = inA[2]!;
      await prisma.programEnrollment.create({
        data: {
          studentId: shared.studentId,
          programId: worldB.programId,
          cohortId: worldA.cohortId,
          appliedVersionId: worldB.versionId,
          admissionVersionId: worldB.versionId,
          fromSemesterId: worldB.admissionSemesterId,
          enrollmentType: 'SECOND_MAJOR',
          isException: true,
          basisDecision: 'QD-RIENG-TU',
        },
      });
      try {
        const seenByA = await director
          .get(`/api/students/${shared.studentId}`)
          .query(inProgram(worldA))
          .expect(200);
        expect(seenByA.body.enrollments).toHaveLength(1);
        expect(JSON.stringify(seenByA.body)).not.toContain('QD-RIENG-TU');
        const seenByOffice = await admin
          .get(`/api/students/${shared.studentId}`)
          .query(semester())
          .expect(200);
        expect(seenByOffice.body.enrollments).toHaveLength(2);
      } finally {
        await prisma.programEnrollment.deleteMany({
          where: { studentId: shared.studentId, programId: worldB.programId },
        });
      }
    });

    it('serves results to staff in scope and hides the student from a foreign director', async () => {
      await prisma.academicResult.create({
        data: {
          studentId: inA[0]!.studentId,
          courseId: worldA.courseId,
          semesterId: worldA.admissionSemesterId,
          score10: '8.5',
          score4: '3.5',
          letterGrade: 'B+',
          status: 'PASSED',
        },
      });
      const query = inProgram(worldA);
      const office = await admin
        .get(`/api/students/${inA[0]!.studentId}/results`)
        .query(query)
        .expect(200);
      expect(office.body.total).toBe(1);
      expect(Object.keys(office.body.items[0]).sort()).toEqual(RESULT_KEYS);
      await director
        .get(`/api/students/${inA[0]!.studentId}/results`)
        .query(query)
        .expect(200);
      const denied = await directorOfB
        .get(`/api/students/${inA[0]!.studentId}/results`)
        .query(query);
      expect(denied.status).toBe(404);
      expect(denied.body.code).toBe('STUDENT_NOT_FOUND');
    });

    it('resolves the applied version for staff', async () => {
      const response = await admin
        .get(`/api/students/${inA[0]!.studentId}/applied-version`)
        .query(inProgram(worldA))
        .expect(200);
      expect(response.body).toMatchObject({
        programId: worldA.programId,
        programVersionId: worldA.versionId,
        source: 'COHORT',
      });
    });

    it('lists issued targets for the office only', async () => {
      const query = inProgram(worldB);
      const response = await admin
        .get(`/api/students/${inA[0]!.studentId}/enrollment-targets`)
        .query(query)
        .expect(200);
      expect(
        response.body.map((row: { version: { id: string } }) => row.version.id),
      ).toContain(worldB.versionId);
      await director
        .get(`/api/students/${inA[0]!.studentId}/enrollment-targets`)
        .query(query)
        .expect(403);
    });

    it('lists the program options by scope', async () => {
      const office = await admin
        .get('/api/students/program-options')
        .query(semester())
        .expect(200);
      expect(office.body.length).toBeGreaterThanOrEqual(2);
      const scoped = await director
        .get('/api/students/program-options')
        .query(semester())
        .expect(200);
      expect(scoped.body.map((row: { id: string }) => row.id)).toEqual([
        worldA.programId,
      ]);
    });
  });

  describe('a student account', () => {
    it('reads its own results and applied version only', async () => {
      const own = await asStudent(inA[0]!);
      const query = inProgram(worldA);
      await own
        .get(`/api/students/${inA[0]!.studentId}/results`)
        .query(query)
        .expect(200);
      await own
        .get(`/api/students/${inA[0]!.studentId}/applied-version`)
        .query(query)
        .expect(200);

      const otherResults = await own
        .get(`/api/students/${inA[1]!.studentId}/results`)
        .query(query);
      expect([403, 404]).toContain(otherResults.status);
      const otherVersion = await own
        .get(`/api/students/${inA[1]!.studentId}/applied-version`)
        .query(query);
      expect([403, 404]).toContain(otherVersion.status);
    });

    it('is refused every staff endpoint', async () => {
      const own = await asStudent(inA[0]!);
      const id = inA[0]!.studentId;
      const calls = [
        own.get('/api/students').query(semester()),
        own.get('/api/students/program-options').query(semester()),
        own.get(`/api/students/${id}`).query(inProgram(worldA)),
        own
          .get(`/api/students/${id}/enrollment-targets`)
          .query(inProgram(worldA)),
        own
          .post(`/api/students/${id}/reconcile-enrollments`)
          .set(CSRF)
          .send({ expectedStudentUpdatedAt: new Date().toISOString() }),
      ];
      for (const response of await Promise.all(calls)) {
        expect(response.status).toBe(403);
      }
    });
  });

  describe('enrollment commands', () => {
    function bareStudent(code: string) {
      return prisma.student.create({
        data: {
          studentCode: code,
          fullName: `Sinh viên ${code}`,
          cohortId: worldA.cohortId,
          admissionSemesterId: worldA.admissionSemesterId,
          statusSemesterId: worldA.admissionSemesterId,
          major: 'M01',
        },
      });
    }

    async function revision(studentId: string) {
      const response = await admin
        .get(`/api/students/${studentId}`)
        .query(semester())
        .expect(200);
      return response.body as {
        updatedAt: string;
        enrollments: { id: string; updatedAt: string }[];
      };
    }

    const command = (studentId: string, body: Record<string, unknown>) =>
      admin.post(`/api/students/${studentId}/enrollments`).set(CSRF).send(body);

    it('assigns an exception once and refuses a second primary', async () => {
      const row = await bareStudent('CMDEXC1');
      const body = {
        operation: 'ASSIGN_EXCEPTION',
        targetVersionId: worldA.versionId,
        fromSemesterId: worldA.admissionSemesterId,
        basisDecision: 'QD-GAN-NGOAI-LE',
        expectedStudentUpdatedAt: row.updatedAt.toISOString(),
      };
      const created = await command(row.id, body).expect(201);
      expect(created.body).toMatchObject({
        isException: true,
        enrollmentType: 'PRIMARY',
        basisDecision: 'QD-GAN-NGOAI-LE',
      });
      const stale = await command(row.id, body);
      expect(stale.status).toBe(409);
      expect(stale.body.code).toBe('ENROLLMENT_STATE_CHANGED');

      const second = await command(row.id, {
        ...body,
        expectedStudentUpdatedAt: (await revision(row.id)).updatedAt,
      });
      expect(second.status).toBe(409);
      expect(second.body.code).toBe('INVALID_ENROLLMENT_INTERVAL');
    });

    it('rejects a command shape that does not fit the operation', async () => {
      const row = await bareStudent('CMDSHAPE1');
      const response = await command(row.id, {
        operation: 'TRANSFER',
        targetVersionId: worldA.versionId,
        fromSemesterId: worldA.admissionSemesterId,
        basisDecision: 'QD-X',
        expectedStudentUpdatedAt: row.updatedAt.toISOString(),
      });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ENROLLMENT_COMMAND_INVALID');
    });

    it('transfers between programs and adds a second major', async () => {
      const moving = inA[1]!;
      const detail = await revision(moving.studentId);
      const transferred = await command(moving.studentId, {
        operation: 'TRANSFER',
        targetVersionId: worldB.versionId,
        fromSemesterId: worldB.admissionSemesterId,
        basisDecision: 'QD-CHUYEN',
        sourceEnrollmentId: detail.enrollments[0]!.id,
        expectedStudentUpdatedAt: detail.updatedAt,
        expectedEnrollmentUpdatedAt: detail.enrollments[0]!.updatedAt,
      }).expect(201);
      expect(transferred.body.program.id).toBe(worldB.programId);
      const rows = await prisma.programEnrollment.findMany({
        where: { studentId: moving.studentId },
        orderBy: { createdAt: 'asc' },
      });
      expect(rows.map((row) => row.status)).toEqual(['TRANSFERRED', 'ACTIVE']);
      expect(rows[1]!.previousEnrollmentId).toBe(rows[0]!.id);

      const adding = inA[2]!;
      const added = await command(adding.studentId, {
        operation: 'ADD_SECOND_MAJOR',
        targetVersionId: worldB.versionId,
        fromSemesterId: worldB.admissionSemesterId,
        basisDecision: 'QD-NGANH-2',
        expectedStudentUpdatedAt: (await revision(adding.studentId)).updatedAt,
      }).expect(201);
      expect(added.body.enrollmentType).toBe('SECOND_MAJOR');
    });

    it('reconciles with the student revision token', async () => {
      const row = inA[0]!;
      const detail = await revision(row.studentId);
      const done = await admin
        .post(`/api/students/${row.studentId}/reconcile-enrollments`)
        .set(CSRF)
        .send({ expectedStudentUpdatedAt: detail.updatedAt })
        .expect(200);
      expect(done.body).toEqual({ transitioned: 0, unchanged: 1, blocked: 0 });

      const stale = await admin
        .post(`/api/students/${row.studentId}/reconcile-enrollments`)
        .set(CSRF)
        .send({ expectedStudentUpdatedAt: '2000-01-01T00:00:00.000Z' });
      expect(stale.status).toBe(409);
      expect(stale.body.code).toBe('ENROLLMENT_STATE_CHANGED');
    });

    it('refuses a director every write and changes nothing', async () => {
      const before = await prisma.programEnrollment.count();
      const detail = await revision(inA[0]!.studentId);
      const response = await director
        .post(`/api/students/${inA[0]!.studentId}/enrollments`)
        .set(CSRF)
        .send({
          operation: 'ADD_SECOND_MAJOR',
          targetVersionId: worldB.versionId,
          fromSemesterId: worldB.admissionSemesterId,
          basisDecision: 'QD-X',
          expectedStudentUpdatedAt: detail.updatedAt,
        });
      expect(response.status).toBe(403);
      expect(await prisma.programEnrollment.count()).toBe(before);
    });
  });
});
