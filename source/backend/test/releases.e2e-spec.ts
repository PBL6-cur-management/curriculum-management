import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seedAccessControl } from '../prisma/seed-data/seed-access-control.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import { createCourse } from './fixtures/courses.js';
import { addCurriculumItem, readCurriculum } from './fixtures/curriculum.js';
import { createPlo, setPloWeight } from './fixtures/outcomes.js';
import { createProgram } from './fixtures/programs.js';
import {
  createCohort,
  createSemester,
  isoDay,
  makeSyllabusReady,
  postRelease,
  releaseViaApi,
  type ReleasedVersion,
} from './fixtures/releases.js';
import { createSyllabusDraft } from './fixtures/syllabi.js';
import { startPostgres, startRedis } from './containers.js';
import type { TestPostgres, TestRedis } from './containers.js';
import { createTestApp } from './test-app.js';
import { setAppEnv } from './test-env.js';

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

type Agent = ReturnType<typeof request.agent>;

describe('semesters, cohorts and the first release (F-15)', () => {
  let postgres: TestPostgres;
  let redis: TestRedis;
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let director: Agent;
  let viewer: Agent;
  let student: Agent;
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
    admin = await loginAgent(app, await createAccount(app, 'reladmin', 'R1'));
    director = await loginAgent(app, await createAccount(app, 'reldir', 'R3'));
    viewer = await loginAgent(
      app,
      await createAccount(app, 'relviewer', 'R2', { unitCode: 'KHOA_CNTT' }),
    );
    student = await loginAgent(
      app,
      await createAccount(app, 'relstudent', 'R6', { unitCode: 'PDT' }),
    );
  });

  afterAll(async () => {
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
  });

  // A Draft program with `count` courses of 3 credits, each with a Draft syllabus (complete unless told otherwise).
  async function draft(count = 2, options: { ready?: boolean } = {}) {
    counter += 1;
    const program = await createProgram(app, { programCode: `REL${counter}` });
    const versionId = program.versions[0].id;
    const courses = [];
    for (let index = 0; index < count; index += 1) {
      const course = await createCourse(app, {
        courseCode: `REL${counter}_C${index}`,
      });
      await addCurriculumItem(admin, versionId, {
        courseId: course.id,
        plannedSemester: 1,
      });
      if (options.ready !== false) await makeSyllabusReady(admin, course.id);
      courses.push(course);
    }
    return { programId: program.id, versionId, courses };
  }

  const detail = async (
    agent: Agent,
    programId: string,
    versionId: string,
    status = 200,
  ) =>
    (
      await agent
        .get(`/api/programs/${programId}/versions/${versionId}`)
        .expect(status)
    ).body;

  describe('semesters and cohorts (MH-10)', () => {
    it('lets R1 define them and everyone signed in read them; R3 cannot write', async () => {
      const created = await admin
        .post('/api/semesters')
        .set(CSRF)
        .send({
          semesterCode: 'HK1-2027',
          academicYear: '2027-2028',
          termInYear: 1,
          startDate: '2027-09-06',
        })
        .expect(201);
      expect(created.body).toMatchObject({
        semesterCode: 'HK1-2027',
        termInYear: 1,
        startDate: '2027-09-06',
      });
      const noDate = await admin
        .post('/api/semesters')
        .set(CSRF)
        .send({
          semesterCode: 'HK2-2027',
          academicYear: '2027-2028',
          termInYear: 2,
        })
        .expect(201);
      expect(noDate.body.startDate).toBeNull();

      await director
        .post('/api/semesters')
        .set(CSRF)
        .send({ semesterCode: 'X', academicYear: '2030-2031', termInYear: 1 })
        .expect(403);
      const listed = await student.get('/api/semesters').expect(200);
      expect(
        listed.body.map((row: { semesterCode: string }) => row.semesterCode),
      ).toEqual(expect.arrayContaining(['HK1-2027', 'HK2-2027']));

      const cohort = await admin
        .post('/api/cohorts')
        .set(CSRF)
        .send({ cohortCode: 'K2027', intakeYear: 2027 })
        .expect(201);
      expect(cohort.body).toMatchObject({
        cohortCode: 'K2027',
        intakeYear: 2027,
      });
      const cohorts = await viewer.get('/api/cohorts').expect(200);
      expect(cohorts.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ cohortCode: 'K2027' }),
        ]),
      );
    });

    it('refuses a repeated code, year-term or cohort code', async () => {
      const twin = await admin
        .post('/api/semesters')
        .set(CSRF)
        .send({
          semesterCode: 'HK1-2027',
          academicYear: '2031-2032',
          termInYear: 1,
        })
        .expect(409);
      expect(twin.body.code).toBe('SEMESTER_EXISTS');
      const sameTerm = await admin
        .post('/api/semesters')
        .set(CSRF)
        .send({
          semesterCode: 'OTHER',
          academicYear: '2027-2028',
          termInYear: 1,
        })
        .expect(409);
      expect(sameTerm.body.code).toBe('SEMESTER_EXISTS');
      const cohort = await admin
        .post('/api/cohorts')
        .set(CSRF)
        .send({ cohortCode: 'K2027', intakeYear: 2027 })
        .expect(409);
      expect(cohort.body.code).toBe('COHORT_EXISTS');
    });

    it('moves the start date of a semester only Pending versions wait on, but not one a released version stands on (US-071 AC2)', async () => {
      const waiting = await createSemester(app, 120);
      const { programId, versionId } = await draft(1);
      await releaseViaApi(app, admin, {
        programId,
        versionId,
        semesterId: waiting.id,
      });

      const moved = await admin
        .patch(`/api/semesters/${waiting.id}`)
        .set(CSRF)
        .send({ startDate: isoDay(150) })
        .expect(200);
      expect(moved.body.startDate).toBe(isoDay(150));

      // The semester reaches today: the Pending version is activated by the edit, and the date is then frozen.
      await admin
        .patch(`/api/semesters/${waiting.id}`)
        .set(CSRF)
        .send({ startDate: isoDay(-1) })
        .expect(200);
      expect((await detail(admin, programId, versionId)).status).toBe('ACTIVE');
      const frozen = await admin
        .patch(`/api/semesters/${waiting.id}`)
        .set(CSRF)
        .send({ startDate: isoDay(30) })
        .expect(409);
      expect(frozen.body.code).toBe('SEMESTER_IN_USE');
      await admin
        .patch(`/api/semesters/${waiting.id}`)
        .set(CSRF)
        .send({ academicYear: '2090-2091' })
        .expect(200);
    });
  });

  describe('the initial release (MH-45, KB-037..039)', () => {
    it('freezes the first version: number, decision, semester, cohorts, names, credits and published syllabi (NT-B4-01)', async () => {
      const semester = await createSemester(app, 90);
      const cohort = await createCohort(app, 'K-REL-1');
      const { programId, versionId, courses } = await draft(2);

      const check = await admin
        .get(`/api/programs/${programId}/versions/${versionId}/release-check`)
        .expect(200);
      expect(check.body).toMatchObject({
        versionId,
        canRelease: true,
        syllabusIssues: [],
      });

      const released: ReleasedVersion = await releaseViaApi(app, admin, {
        programId,
        versionId,
        semesterId: semester.id,
        cohortIds: [cohort.id],
        decisionNumber: 'QD-100/2026',
        signedDate: '2026-10-01',
        prepareSyllabi: false,
      });

      expect(released).toMatchObject({
        id: versionId,
        versionNumber: '1.0',
        status: 'PENDING',
        decisionNumber: 'QD-100/2026',
        signedDate: '2026-10-01',
        effectiveSemester: { id: semester.id },
        cohorts: [{ cohortCode: 'K-REL-1' }],
        originRequest: null,
      });
      const stored = await prisma.programVersion.findUniqueOrThrow({
        where: { id: versionId },
        include: { curriculumItems: true },
      });
      expect(stored.publishedAt).not.toBeNull();
      expect(stored.publishedById).not.toBeNull();
      expect(stored.sourceRequestId).toBeNull();
      expect(
        stored.curriculumItems.every(
          (item) =>
            item.syllabusId !== null &&
            item.courseNameSnapshot !== null &&
            item.creditsSnapshot !== null,
        ),
      ).toBe(true);
      const published = await prisma.syllabus.findMany({
        where: { courseId: { in: courses.map((course) => course.id) } },
      });
      expect(published.map((row) => row.status)).toEqual([
        'PUBLISHED',
        'PUBLISHED',
      ]);
      expect(published.every((row) => row.publishedAt !== null)).toBe(true);
      expect(
        await prisma.cohortVersion.count({
          where: { programVersionId: versionId },
        }),
      ).toBe(1);

      // A later catalog edit does not reach the released version (US-074 AC1, DC: frozen rows).
      await prisma.course.update({
        where: { id: courses[0].id },
        data: {
          courseName: 'Tên đã đổi sau ban hành',
          credits: new Prisma.Decimal('5'),
        },
      });
      const after = await detail(admin, programId, versionId);
      expect(after.rows[0]).toMatchObject({
        courseName: `Học phần ${courses[0].courseCode}`,
        credits: '3',
        syllabus: { revisionNumber: 1, status: 'PUBLISHED' },
      });
      const curriculum = await readCurriculum(admin, versionId);
      expect(curriculum.items[0].course).toMatchObject({
        courseName: `Học phần ${courses[0].courseCode}`,
        credits: '3',
      });
      expect(curriculum.programCredits.computed.total).toBe('6');
    });

    it('is Active at once when the semester has already begun, and replaces nothing before it (PB-04, KB-038)', async () => {
      const { programId, versionId } = await draft(1);
      await createCohort(app, `K-UNSELECTED-${counter}`);
      const mappingsBefore = await prisma.cohortVersion.findMany({
        orderBy: { id: 'asc' },
      });

      const released = await releaseViaApi(app, admin, {
        programId,
        versionId,
        semesterId: (await createSemester(app, -200)).id,
      });

      expect(released.status).toBe('ACTIVE');
      expect(
        await prisma.cohortVersion.findMany({ orderBy: { id: 'asc' } }),
      ).toEqual(mappingsBefore);
      const program = await admin.get(`/api/programs/${programId}`).expect(200);
      expect(program.body.currentVersion).toMatchObject({
        versionNumber: '1.0',
        status: 'ACTIVE',
      });
    });

    it('lets R1 type the number and refuses a malformed one', async () => {
      const { programId, versionId } = await draft(1);
      const semester = await createSemester(app, -5);
      const bad = await postRelease(app, admin, {
        programId,
        versionId,
        semesterId: semester.id,
        versionNumber: '1',
      }).expect(400);
      expect(bad.body.code).toBe('VALIDATION_FAILED');

      const released = await releaseViaApi(app, admin, {
        programId,
        versionId,
        semesterId: semester.id,
        versionNumber: '3.2',
        prepareSyllabi: false,
      });

      expect(released.versionNumber).toBe('3.2');
    });

    it('refuses without changing anything when a course has no syllabus (MISSING_SYLLABUS, KB-039)', async () => {
      const { programId, versionId, courses } = await draft(2, {
        ready: false,
      });
      await makeSyllabusReady(admin, courses[0].id);
      const semester = await createSemester(app, -5);

      const check = await admin
        .get(`/api/programs/${programId}/versions/${versionId}/release-check`)
        .expect(200);
      expect(check.body.canRelease).toBe(false);
      expect(check.body.syllabusIssues).toEqual([
        expect.objectContaining({
          courseCode: courses[1].courseCode,
          code: 'MISSING_SYLLABUS',
        }),
      ]);
      expect(
        check.body.consistencyIssues.map(
          (issue: { code: string }) => issue.code,
        ),
      ).toContain('MISSING_SYLLABUS');

      const refused = await postRelease(app, admin, {
        programId,
        versionId,
        semesterId: semester.id,
      }).expect(409);
      expect(refused.body.code).toBe('CONSISTENCY_FAILED');
      expect(
        (
          await prisma.programVersion.findUniqueOrThrow({
            where: { id: versionId },
          })
        ).status,
      ).toBe('DRAFT');
      expect(
        await prisma.syllabus.count({
          where: { courseId: courses[0].id, status: 'PUBLISHED' },
        }),
      ).toBe(0);
    });

    it('names every incomplete syllabus (DC-03) and publishes none of them', async () => {
      const { programId, versionId, courses } = await draft(3, {
        ready: false,
      });
      await makeSyllabusReady(admin, courses[0].id);
      await createSyllabusDraft(admin, courses[1].id);
      const half = await createSyllabusDraft(admin, courses[2].id);
      await admin
        .patch(`/api/syllabi/${half.id}`)
        .set(CSRF)
        .send({ objectives: '<p>Có mục tiêu</p>' })
        .expect(200);
      const semester = await createSemester(app, -5);

      const check = (
        await admin
          .get(`/api/programs/${programId}/versions/${versionId}/release-check`)
          .expect(200)
      ).body;
      expect(check.canRelease).toBe(false);
      expect(check.syllabusIssues).toEqual([
        expect.objectContaining({
          courseCode: courses[1].courseCode,
          code: 'SYLLABUS_INCOMPLETE',
          details: [
            'COURSE_DESCRIPTION_EMPTY',
            'OBJECTIVES_EMPTY',
            'ASSESSMENT_FORMULA_EMPTY',
          ],
        }),
        expect.objectContaining({
          courseCode: courses[2].courseCode,
          details: ['COURSE_DESCRIPTION_EMPTY', 'ASSESSMENT_FORMULA_EMPTY'],
        }),
      ]);

      const refused = await postRelease(app, admin, {
        programId,
        versionId,
        semesterId: semester.id,
      }).expect(409);
      expect(refused.body.code).toBe('SYLLABUS_INCOMPLETE');
      expect(refused.body.details).toHaveLength(2);
      expect(
        await prisma.syllabus.count({
          where: { status: 'PUBLISHED', courseId: courses[0].id },
        }),
      ).toBe(0);
    });

    it('refuses a consistency Error, a missing start date, unknown semester or cohort, R3, and a second release', async () => {
      const { programId, versionId, courses } = await draft(1);
      const semester = await createSemester(app, -5);
      const group = await admin
        .post(`/api/program-versions/${versionId}/elective-groups`)
        .set(CSRF)
        .send({ groupCode: 'TC9', groupName: 'Không đạt nổi', minCourses: 4 })
        .expect(201);
      expect(group.status).toBe(201);
      const inconsistent = await postRelease(app, admin, {
        programId,
        versionId,
        semesterId: semester.id,
      }).expect(409);
      expect(inconsistent.body.code).toBe('CONSISTENCY_FAILED');
      await admin
        .delete(`/api/elective-groups/${group.body.id}`)
        .set(CSRF)
        .expect(204);

      const undated = await createSemester(app, null);
      const noStart = await postRelease(app, admin, {
        programId,
        versionId,
        semesterId: undated.id,
      }).expect(409);
      expect(noStart.body.code).toBe('SEMESTER_START_UNKNOWN');
      const unknown = await postRelease(app, admin, {
        programId,
        versionId,
        semesterId: 'no-such-semester',
      }).expect(404);
      expect(unknown.body.code).toBe('SEMESTER_NOT_FOUND');
      const noCohort = await postRelease(app, admin, {
        programId,
        versionId,
        semesterId: semester.id,
        cohortIds: ['no-such-cohort'],
      }).expect(404);
      expect(noCohort.body.code).toBe('COHORT_NOT_FOUND');
      await postRelease(app, director, {
        programId,
        versionId,
        semesterId: semester.id,
      }).expect(403);

      await releaseViaApi(app, admin, {
        programId,
        versionId,
        semesterId: semester.id,
        prepareSyllabi: false,
      });
      const again = await postRelease(app, admin, {
        programId,
        versionId,
        semesterId: semester.id,
      }).expect(409);
      expect(again.body.code).toBe('ALREADY_RELEASED');
      expect(courses).toHaveLength(1);
    });

    it('lets exactly one of two parallel releases win', async () => {
      const { programId, versionId } = await draft(1);
      const semester = await createSemester(app, -5);

      const results = await Promise.all([
        postRelease(app, admin, {
          programId,
          versionId,
          semesterId: semester.id,
        }),
        postRelease(app, admin, {
          programId,
          versionId,
          semesterId: semester.id,
        }),
      ]);

      expect(
        results.map((result) => result.status).sort((a, b) => a - b),
      ).toEqual([201, 409]);
      expect(
        await prisma.programVersion.count({
          where: { programId, status: 'ACTIVE' },
        }),
      ).toBe(1);
    });

    it('keeps the pin of a row on the revision it was released with when a new revision is published later', async () => {
      const { programId, versionId, courses } = await draft(1);
      await releaseViaApi(app, admin, {
        programId,
        versionId,
        prepareSyllabi: false,
      });
      const first = await prisma.syllabus.findFirstOrThrow({
        where: { courseId: courses[0].id },
      });
      // A later revision for the course: older one becomes Historical, but the row still reads revision 1.
      await prisma.syllabus.update({
        where: { id: first.id },
        data: { status: 'HISTORICAL' },
      });
      const second = await prisma.syllabus.create({
        data: {
          courseId: courses[0].id,
          revisionNumber: 2,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          objectives: '<p>Bản 2</p>',
          previousVersionId: first.id,
        },
      });

      const pinned = await detail(admin, programId, versionId);
      expect(pinned.rows[0].syllabus).toMatchObject({
        id: first.id,
        revisionNumber: 1,
        status: 'HISTORICAL',
      });
      const view = await admin
        .get(`/api/courses/${courses[0].id}/syllabus?versionId=${versionId}`)
        .expect(200);
      expect(view.body.published).toMatchObject({
        id: first.id,
        status: 'HISTORICAL',
      });
      expect(view.body.version).toMatchObject({
        id: versionId,
        versionNumber: '1.0',
      });
      const current = await admin
        .get(`/api/courses/${courses[0].id}/syllabus`)
        .expect(200);
      expect(current.body.published.id).toBe(second.id);
      await admin
        .get(`/api/courses/${courses[0].id}/syllabus?versionId=nope`)
        .expect(404);
    });

    it('keeps CLO links on the published revision the row maps (never a Draft CLO)', async () => {
      const { programId, versionId, courses } = await draft(1);
      const plo = await createPlo(admin, versionId, 'PLO1');
      const item = (await readCurriculum(admin, versionId)).items[0];
      await setPloWeight(admin, item.id, plo.id, '1');
      const syllabus = await admin
        .get(`/api/courses/${courses[0].id}/syllabus`)
        .expect(200);
      const clo = await admin
        .post(`/api/syllabi/${syllabus.body.draft.id}/clos`)
        .set(CSRF)
        .send({ cloCode: 'CLO1', description: 'Mô tả' })
        .expect(201);
      await admin
        .put(`/api/curriculum-items/${item.id}/clo-plo-links`)
        .set(CSRF)
        .send({ links: [{ cloId: clo.body.id, ploId: plo.id }] })
        .expect(200);
      await makeSyllabusReady(admin, courses[0].id);

      await releaseViaApi(app, admin, {
        programId,
        versionId,
        prepareSyllabi: false,
      });

      const link = await prisma.cLOPLOMapping.findFirstOrThrow({
        where: { curriculumItemId: item.id },
        include: { clo: { include: { syllabus: true } } },
      });
      expect(link.clo.syllabus.status).toBe('PUBLISHED');
      const matrix = await admin
        .get(`/api/curriculum-items/${item.id}/clo-plo-matrix`)
        .expect(200);
      expect(matrix.body.links).toEqual([
        { cloId: clo.body.id, ploId: plo.id },
      ]);
    });
  });

  describe('a released version is read-only whatever its status (D17, US-074 AC1)', () => {
    it('refuses every writer on a Pending and on an Active version', async () => {
      for (const start of [90, -5]) {
        const { programId, versionId, courses } = await draft(1);
        const plo = await createPlo(admin, versionId, 'PLO1');
        const item = (await readCurriculum(admin, versionId)).items[0];
        const released = await releaseViaApi(app, admin, {
          programId,
          versionId,
          semesterId: (await createSemester(app, start)).id,
        });
        expect(released.status).toBe(start > 0 ? 'PENDING' : 'ACTIVE');
        const other = await createCourse(app, {
          courseCode: `REL_X${start}${counter}`,
        });

        const codes: [string, number, string][] = [];
        const expectRefused = async (
          label: string,
          call: Promise<request.Response>,
        ) => {
          const response = await call;
          codes.push([label, response.status, response.body.code]);
        };
        await expectRefused(
          'add row',
          admin
            .post(`/api/program-versions/${versionId}/curriculum-items`)
            .set(CSRF)
            .send({
              courseId: other.id,
              plannedSemester: 1,
              isElective: false,
            }),
        );
        await expectRefused(
          'delete row',
          admin.delete(`/api/curriculum-items/${item.id}`).set(CSRF),
        );
        await expectRefused(
          'add PLO',
          admin
            .post(`/api/program-versions/${versionId}/plos`)
            .set(CSRF)
            .send({ ploCode: 'PLO2', description: 'x' }),
        );
        await expectRefused(
          'weight',
          admin
            .put(`/api/curriculum-items/${item.id}/plo-weights/${plo.id}`)
            .set(CSRF)
            .send({ weight: '0.5' }),
        );
        await expectRefused(
          'accept mismatch',
          admin
            .put(
              `/api/program-versions/${versionId}/credit-mismatch-acceptance`,
            )
            .set(CSRF)
            .send({ reason: 'x', compulsoryGap: '0', electiveGap: '0' }),
        );
        await expectRefused(
          'version info',
          admin
            .patch(`/api/program-versions/${versionId}/info`)
            .set(CSRF)
            .send({ programName: 'Đổi tên' }),
        );
        await expectRefused(
          'program info',
          admin
            .patch(`/api/programs/${programId}`)
            .set(CSRF)
            .send({ programName: 'Đổi' }),
        );
        const syllabus = (
          await admin.get(`/api/courses/${courses[0].id}/syllabus`).expect(200)
        ).body;
        await expectRefused(
          'syllabus body',
          admin
            .patch(`/api/syllabi/${syllabus.published.id}`)
            .set(CSRF)
            .send({ objectives: '<p>Sửa</p>' }),
        );
        await expectRefused(
          'CLO',
          admin
            .post(`/api/syllabi/${syllabus.published.id}/clos`)
            .set(CSRF)
            .send({ cloCode: 'CLO9', description: 'x' }),
        );

        expect(
          codes.map(([label, status]) => [
            label,
            status >= 400 && status < 500,
          ]),
        ).toEqual(codes.map(([label]) => [label, true]));
        expect(codes.map(([, , code]) => code)).toEqual([
          'VERSION_NOT_EDITABLE',
          'VERSION_NOT_EDITABLE',
          'VERSION_NOT_EDITABLE',
          'VERSION_NOT_EDITABLE',
          'VERSION_NOT_EDITABLE',
          'PROGRAM_VERSION_NOT_EDITABLE',
          'CHANGE_REQUEST_REQUIRED',
          'CHANGE_REQUEST_REQUIRED',
          'CHANGE_REQUEST_REQUIRED',
        ]);
      }
    });

    it('sends a released course through a request and refuses to cancel it (F-04)', async () => {
      const { programId, versionId, courses } = await draft(1);
      await releaseViaApi(app, admin, { programId, versionId });

      const edit = await admin
        .patch(`/api/courses/${courses[0].id}`)
        .set(CSRF)
        .send({ courseName: 'Tên sau ban hành' })
        .expect(409);
      expect(edit.body.code).toBe('CHANGE_REQUEST_REQUIRED');
      const cancel = await admin
        .post(`/api/courses/${courses[0].id}/cancel`)
        .set(CSRF)
        .expect(409);
      expect(cancel.body.code).toBe('COURSE_IN_USE');
    });
  });

  describe('history and the read-only detail (MH-46, MH-47)', () => {
    it('lists the issued versions for R1 and the scoped R2 (the Draft too, before release) and refuses a student of another unit', async () => {
      const { programId, versionId } = await draft(1);
      const listBefore = await viewer
        .get(`/api/programs/${programId}/versions`)
        .expect(200);
      expect(
        listBefore.body.versions.map((row: { status: string }) => row.status),
      ).toEqual(['DRAFT']);
      // A student scoped to another unit has no program.view over this program.
      await student.get(`/api/programs/${programId}/versions`).expect(403);

      await releaseViaApi(app, admin, { programId, versionId });
      for (const agent of [admin, viewer]) {
        const list = await agent
          .get(`/api/programs/${programId}/versions`)
          .expect(200);
        expect(list.body.versions).toEqual([
          expect.objectContaining({
            id: versionId,
            versionNumber: '1.0',
            status: 'ACTIVE',
          }),
        ]);
      }
      const read = await detail(viewer, programId, versionId);
      expect(read).toMatchObject({
        programCode: `REL${counter}`,
        canCorrect: false,
        isCorrectionDraft: false,
        publishedBy: { fullName: 'reladmin' },
      });
      expect((await detail(admin, programId, versionId)).canCorrect).toBe(true);
    });

    it("hides a plain Draft from the detail and answers 404 for another program's version", async () => {
      const a = await draft(1);
      const b = await draft(1);

      await detail(admin, a.programId, a.versionId, 404);
      await detail(admin, a.programId, b.versionId, 404);
      await detail(admin, 'no-such-program', a.versionId, 404);
    });

    it('is closed to someone without program.view over the program', async () => {
      const { programId, versionId } = await draft(1);
      await releaseViaApi(app, admin, { programId, versionId });
      const outsider = await loginAgent(
        app,
        await createAccount(app, 'reloutsider'),
      );

      await outsider.get(`/api/programs/${programId}/versions`).expect(403);
      await outsider
        .get(`/api/programs/${programId}/versions/${versionId}`)
        .expect(403);
    });
  });

  it('keeps the program list and its current version unaffected by a release in another program', async () => {
    const a = await draft(1);
    const b = await draft(1);
    await releaseViaApi(app, admin, {
      programId: a.programId,
      versionId: a.versionId,
    });

    const other = await admin.get(`/api/programs/${b.programId}`).expect(200);
    expect(other.body.currentVersion).toMatchObject({
      status: 'DRAFT',
      versionNumber: null,
    });
    expect(isoDay(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
