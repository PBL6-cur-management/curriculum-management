import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seedApprovalLevels } from '../prisma/seed-data/approval-levels.js';
import { seedAccessControl } from '../prisma/seed-data/seed-access-control.js';
import { SubjectGroupMemberRole } from '../src/generated/prisma/client.js';
import { ReleaseActivationProcessor } from '../src/features/releases/release-activation.processor.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import { notificationsOf } from './fixtures/approvals.js';
import {
  decide,
  openRequest,
  publishedCourse,
  readRequest,
  releaseAnotherVersion,
  releasedProgram,
  submitRequest,
} from './fixtures/change-requests.js';
import { createCourse } from './fixtures/courses.js';
import { addCurriculumItem, readCurriculum } from './fixtures/curriculum.js';
import { createPlo, setPloWeight } from './fixtures/outcomes.js';
import { assignDirector, createProgram } from './fixtures/programs.js';
import {
  createCohort,
  createSemester,
  isoDay,
  makeSyllabusReady,
  releaseViaApi,
} from './fixtures/releases.js';
import {
  addMembership,
  createSubjectGroup,
} from './fixtures/subject-groups.js';
import { startPostgres, startRedis } from './containers.js';
import type { TestPostgres, TestRedis } from './containers.js';
import { createTestApp } from './test-app.js';
import { setAppEnv } from './test-env.js';

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

type Agent = ReturnType<typeof request.agent>;

describe('final approval, fan-out and activation (US-072, US-073, US-075, MH-43)', () => {
  let postgres: TestPostgres;
  let redis: TestRedis;
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let admin2: Agent;
  let memberA: Agent;
  let coordA: Agent;
  let directorA: Agent;
  let directorAId: string;
  let ga: string;
  let counter = 0;
  const code = (prefix: string) => `${prefix}${(counter += 1)}`;

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
    ga = (await createSubjectGroup(app, 'FA_GA')).id;
    admin = await loginAgent(app, await createAccount(app, 'faadmin', 'R1'));
    admin2 = await loginAgent(app, await createAccount(app, 'faadmin2', 'R1'));
    const memberAccount = await createAccount(app, 'famember');
    await addMembership(app, { groupId: ga, userId: memberAccount.id });
    memberA = await loginAgent(app, memberAccount);
    const coordAccount = await createAccount(app, 'facoord');
    for (const memberRole of [
      SubjectGroupMemberRole.MEMBER,
      SubjectGroupMemberRole.COORDINATOR,
    ]) {
      await addMembership(app, {
        groupId: ga,
        userId: coordAccount.id,
        memberRole,
      });
    }
    coordA = await loginAgent(app, coordAccount);
    const directorAccount = await createAccount(app, 'fadir');
    directorAId = directorAccount.id;
    directorA = await loginAgent(app, directorAccount);
  });

  afterAll(async () => {
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
  });

  const processor = () => app.get(ReleaseActivationProcessor);

  // Level 1 and 2 approvals by whoever holds the row, until the request waits for the academic office.
  async function toLevelThree(requestId: string, approvers: Agent[]) {
    for (let round = 0; round < 4; round += 1) {
      if (
        (await readRequest(admin, requestId)).status ===
        'PENDING_ACADEMIC_OFFICE'
      ) {
        return;
      }
      for (const approver of approvers) {
        if ((await decide(approver, requestId, 'approve')).status === 200)
          break;
      }
    }
    expect((await readRequest(admin, requestId)).status).toBe(
      'PENDING_ACADEMIC_OFFICE',
    );
  }

  const finalApprove = (
    agent: Agent,
    requestId: string,
    semesterId: string,
    extra: object = {},
  ) =>
    agent
      .post(`/api/change-requests/${requestId}/final-approve`)
      .set(CSRF)
      .send({
        decisionNumber: 'QD-FA/2026',
        signedDate: isoDay(-1),
        effectiveSemesterId: semesterId,
        ...extra,
      });

  const preview = (agent: Agent, requestId: string) =>
    agent.get(`/api/change-requests/${requestId}/final-approval`);

  const versionsOf = (programId: string) =>
    prisma.programVersion.findMany({
      where: { programId, sourceRequestId: null },
      orderBy: { createdAt: 'asc' },
    });

  const effectiveNotices = async (agent: Agent, requestId: string) =>
    (await notificationsOf(agent)).filter(
      (row) =>
        row.changeRequestId === requestId &&
        row.notificationType === 'REQUEST_EFFECTIVE',
    );

  // A program request by the director: the curriculum copy moves the course to semester 2.
  async function programRequest(courseCode: string) {
    const course = await publishedCourse(app, admin, courseCode, ga);
    const program = await releasedProgram(app, admin, code('FAP'), [course.id]);
    await assignDirector(app, {
      programId: program.programId,
      userId: directorAId,
    });
    const created = await openRequest(directorA, {
      requestType: 'CURRICULUM',
      targetType: 'PROGRAM',
      targetId: program.programId,
    });
    const copy = await readCurriculum(directorA, created.workspace!.copyId);
    await directorA
      .patch(`/api/curriculum-items/${copy.items[0].id}`)
      .set(CSRF)
      .send({ plannedSemester: 2 })
      .expect(200);
    await submitRequest(directorA, created.id).expect(200);
    await toLevelThree(created.id, [coordA]);
    return {
      course,
      program,
      requestId: created.id,
      copyId: created.workspace!.copyId,
    };
  }

  describe('a program request', () => {
    it('shows the office a preview, releases the next major as Pending, then activates it at the semester start, once (KB-045, KB-057, NT-B4-05)', async () => {
      const { program, requestId } = await programRequest(code('FAC'));

      // The preview is for someone who may decide; the creator may not.
      const shown = (await preview(admin, requestId).expect(200)).body;
      expect(shown).toMatchObject({
        kind: 'PROGRAM_VERSION',
        stale: false,
        canAssignCohorts: true,
        canAllowPastSemester: false,
        affectedPrograms: [
          expect.objectContaining({
            baseVersionNumber: '1.0',
            nextVersionNumber: '2.0',
          }),
        ],
      });
      const self = await preview(directorA, requestId).expect(403);
      expect(self.body.code).toBe('SELF_APPROVAL');
      expect((await readRequest(admin, requestId)).permissions).toMatchObject({
        canFinalApprove: true,
        canApprove: false,
      });
      expect(
        (await readRequest(directorA, requestId)).permissions.canFinalApprove,
      ).toBe(false);
      // The plain route still refuses level 3 of a data request.
      expect(
        (await decide(admin, requestId, 'approve').expect(409)).body.code,
      ).toBe('FINAL_APPROVAL_REQUIRED');

      const semester = await createSemester(app, 60);
      const cohort = await createCohort(app, code('K-FA-'));
      const approved = (
        await finalApprove(admin2, requestId, semester.id, {
          cohortIds: [cohort.id],
        }).expect(200)
      ).body;

      expect(approved).toMatchObject({
        status: 'APPROVED',
        release: {
          decisionNumber: 'QD-FA/2026',
          effectiveSemester: { id: semester.id },
          pastSemesterAllowed: false,
          versions: [
            expect.objectContaining({
              versionNumber: '2.0',
              status: 'PENDING',
            }),
          ],
        },
      });
      const [first, second] = await versionsOf(program.programId);
      expect(first).toMatchObject({ versionNumber: '1.0', status: 'ACTIVE' });
      expect(second).toMatchObject({
        versionNumber: '2.0',
        status: 'PENDING',
        originRequestId: requestId,
        previousVersionId: first.id,
        sourceRequestId: null,
        decisionNumber: 'QD-FA/2026',
      });
      expect(
        await prisma.cohortVersion.count({
          where: { programVersionId: second.id },
        }),
      ).toBe(1);
      const row = await prisma.curriculumItem.findFirstOrThrow({
        where: { versionId: second.id },
      });
      expect(row).toMatchObject({ plannedSemester: 2 });
      expect(row.syllabusId).not.toBeNull();
      const history = (
        await memberAIsCreator()
          .get(`/api/change-requests/${requestId}/history`)
          .expect(200)
      ).body.rounds[0].steps;
      expect(
        history.find(
          (step: { approvalLevel: number }) => step.approvalLevel === 3,
        ),
      ).toMatchObject({
        action: 'APPROVE',
      });
      // The creator hears "approved" now and "in force" only once the version is Active.
      const mine = (await notificationsOf(directorA)).filter(
        (n) => n.changeRequestId === requestId,
      );
      expect(mine.map((n) => n.notificationType)).toContain('REQUEST_APPROVED');
      expect(await effectiveNotices(directorA, requestId)).toHaveLength(0);

      // Nothing is due yet: the job leaves it Pending.
      expect(await processor().reconcile()).toBe(0);
      expect((await versionsOf(program.programId))[1].status).toBe('PENDING');

      // The semester begins (the date moved by hand, bypassing MH-10's own immediate activation).
      await prisma.semester.update({
        where: { id: semester.id },
        data: { startDate: new Date(isoDay(-1) + 'T00:00:00.000Z') },
      });
      expect(await processor().reconcile()).toBe(1);

      const [retired, active] = await versionsOf(program.programId);
      expect(retired.status).toBe('HISTORICAL');
      expect(active.status).toBe('ACTIVE');
      expect((await readRequest(admin, requestId)).status).toBe('EFFECTIVE');
      expect(await effectiveNotices(directorA, requestId)).toHaveLength(1);

      // K-7: running it again, and twice at once, changes nothing and tells nobody again.
      expect(await processor().reconcile()).toBe(0);
      await Promise.all([processor().reconcile(), processor().reconcile()]);
      expect(await effectiveNotices(directorA, requestId)).toHaveLength(1);
      expect(
        await prisma.programVersion.count({
          where: { programId: program.programId, status: 'ACTIVE' },
        }),
      ).toBe(1);
    });

    function memberAIsCreator() {
      return directorA;
    }

    it('is Active and Effective at once for a semester that has begun, when the academic office made the request (F15-03)', async () => {
      const course = await publishedCourse(app, admin, code('FAO'), ga);
      const program = await releasedProgram(app, admin, code('FAP'), [
        course.id,
      ]);
      await assignDirector(app, {
        programId: program.programId,
        userId: directorAId,
      });
      const created = await openRequest(admin2, {
        requestType: 'PROGRAM_INFO',
        targetType: 'PROGRAM',
        targetId: program.programId,
      });
      await admin2
        .patch(`/api/program-versions/${created.workspace!.copyId}/info`)
        .set(CSRF)
        .send({ programName: 'Tên chương trình mới' })
        .expect(200);
      await submitRequest(admin2, created.id).expect(200);
      await toLevelThree(created.id, [directorA, coordA]);
      const past = await createSemester(app, -90);

      // The creator never approves their own request; a started semester needs the flag.
      expect(
        (
          await finalApprove(admin2, created.id, past.id, {
            allowPastSemester: true,
          }).expect(403)
        ).body.code,
      ).toBe('SELF_APPROVAL');
      expect(
        (await finalApprove(admin, created.id, past.id).expect(409)).body.code,
      ).toBe('SEMESTER_ALREADY_STARTED');
      const done = (
        await finalApprove(admin, created.id, past.id, {
          allowPastSemester: true,
        }).expect(200)
      ).body;

      expect(done).toMatchObject({
        status: 'EFFECTIVE',
        release: {
          pastSemesterAllowed: true,
          versions: [
            expect.objectContaining({ versionNumber: '1.1', status: 'ACTIVE' }),
          ],
        },
      });
      const [old, current] = await versionsOf(program.programId);
      expect(old.status).toBe('HISTORICAL');
      expect(current).toMatchObject({
        programName: 'Tên chương trình mới',
        status: 'ACTIVE',
      });
      const types = (await notificationsOf(admin2))
        .filter((n) => n.changeRequestId === created.id)
        .map((n) => n.notificationType);
      expect(types).toEqual(
        expect.arrayContaining(['REQUEST_APPROVED', 'REQUEST_EFFECTIVE']),
      );
      expect(types.filter((type) => type === 'REQUEST_EFFECTIVE')).toHaveLength(
        1,
      );
    });

    it('takes a past semester from nobody else and refuses an unknown or undated one', async () => {
      const { requestId } = await programRequest(code('FAD'));
      const past = await createSemester(app, -90);

      for (const extra of [{}, { allowPastSemester: true }]) {
        expect(
          (await finalApprove(admin, requestId, past.id, extra).expect(409))
            .body.code,
        ).toBe('SEMESTER_ALREADY_STARTED');
      }
      expect(
        (
          await finalApprove(
            admin,
            requestId,
            (await createSemester(app, null)).id,
          ).expect(409)
        ).body.code,
      ).toBe('SEMESTER_START_UNKNOWN');
      expect(
        (await finalApprove(admin, requestId, 'no-such-semester').expect(404))
          .body.code,
      ).toBe('SEMESTER_NOT_FOUND');
      expect((await readRequest(admin, requestId)).status).toBe(
        'PENDING_ACADEMIC_OFFICE',
      );
    });

    it('refuses a stale base: the request stays at level 3 and nothing is released (EC-27)', async () => {
      const { program, requestId } = await programRequest(code('FAS'));
      await releaseAnotherVersion(admin, program.programId, program.versionId);

      expect((await preview(admin, requestId).expect(200)).body.stale).toBe(
        true,
      );
      const refused = await finalApprove(
        admin,
        requestId,
        (await createSemester(app, 60)).id,
      ).expect(409);

      expect(refused.body.code).toBe('STALE_BASE');
      expect((await readRequest(admin, requestId)).status).toBe(
        'PENDING_ACADEMIC_OFFICE',
      );
      expect(
        (await versionsOf(program.programId)).map((v) => v.versionNumber),
      ).toEqual(['1.0', '1.1']);
    });

    it('lets exactly one of two simultaneous approvers win', async () => {
      const { program, requestId } = await programRequest(code('FAR'));
      const semester = await createSemester(app, 60);

      const results = await Promise.all([
        finalApprove(admin, requestId, semester.id),
        finalApprove(admin2, requestId, semester.id),
      ]);

      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        200, 409,
      ]);
      expect(await versionsOf(program.programId)).toHaveLength(2);
    });

    it('refuses a caller with no row to decide and an organisational request', async () => {
      const { requestId } = await programRequest(code('FAN'));
      const semester = await createSemester(app, 60);

      expect(
        (await finalApprove(coordA, requestId, semester.id).expect(403)).body
          .code,
      ).toBe('NOT_YOUR_STEP');
      expect(
        (await finalApprove(memberA, requestId, semester.id).expect(404)).body
          .code,
      ).toBe('REQUEST_NOT_FOUND');
    });
  });

  describe('a syllabus request reaches every program that holds the course (US-075, KB-055)', () => {
    // Course X with CLO1 and CLO2, released in three programs; P1 maps both CLOs to a PLO. A fourth program is switched off.
    async function sharedCourse() {
      const course = await createCourse(app, {
        courseCode: code('FAX'),
        groupId: ga,
      });
      await makeSyllabusReady(admin, course.id);
      const syllabus = (
        await admin.get(`/api/courses/${course.id}/syllabus`).expect(200)
      ).body.draft;
      const clos: Record<string, string> = {};
      for (const cloCode of ['CLO1', 'CLO2']) {
        clos[cloCode] = (
          await admin
            .post(`/api/syllabi/${syllabus.id}/clos`)
            .set(CSRF)
            .send({ cloCode, description: `Mô tả ${cloCode}` })
            .expect(201)
        ).body.id;
      }
      await makeSyllabusReady(admin, course.id);
      const programs: { programId: string; versionId: string }[] = [];
      for (let index = 0; index < 4; index += 1) {
        const program = await createProgram(app, { programCode: code('FAQ') });
        const versionId = program.versions[0].id;
        const item = await addCurriculumItem(admin, versionId, {
          courseId: course.id,
          plannedSemester: 1,
        });
        if (index === 0) {
          const plo = await createPlo(admin, versionId, 'PLO1');
          await setPloWeight(admin, item.id, plo.id, '1');
          await admin
            .put(`/api/curriculum-items/${item.id}/clo-plo-links`)
            .set(CSRF)
            .send({
              links: [
                { cloId: clos.CLO1, ploId: plo.id },
                { cloId: clos.CLO2, ploId: plo.id },
              ],
            })
            .expect(200);
        }
        await releaseViaApi(app, admin, {
          programId: program.id,
          versionId,
          prepareSyllabi: false,
        });
        programs.push({ programId: program.id, versionId });
      }
      await prisma.program.update({
        where: { id: programs[3].programId },
        data: { status: 'INACTIVE' },
      });
      return { course, clos, programs, firstRevision: syllabus.id as string };
    }

    // memberA drops CLO2 and rewrites the objectives on the request's copy, then the request reaches level 3.
    async function revisionRequest(courseId: string) {
      const created = await openRequest(memberA, {
        requestType: 'SYLLABUS_CONTENT',
        targetType: 'COURSE',
        targetId: courseId,
      });
      await memberA
        .patch(`/api/syllabi/${created.workspace!.copyId}`)
        .set(CSRF)
        .send({ objectives: '<p>Mục tiêu của bản mới</p>' })
        .expect(200);
      const copy = (
        await memberA
          .get(`/api/courses/${courseId}/syllabus?requestId=${created.id}`)
          .expect(200)
      ).body.draft;
      const doomed = copy.clos.find(
        (clo: { cloCode: string }) => clo.cloCode === 'CLO2',
      );
      await memberA.delete(`/api/clos/${doomed.id}`).set(CSRF).expect(204);
      await submitRequest(memberA, created.id).expect(200);
      await toLevelThree(created.id, [coordA]);
      return created.id as string;
    }

    it('publishes the revision once and a minor version per program in use, re-pointing CLO links by code (NT-B4-05, D9)', async () => {
      const { course, programs, firstRevision, clos } = await sharedCourse();
      const requestId = await revisionRequest(course.id);

      const shown = (await preview(admin, requestId).expect(200)).body;
      expect(shown.kind).toBe('SYLLABUS');
      expect(shown.affectedPrograms).toHaveLength(3);
      expect(shown.canAssignCohorts).toBe(false);
      expect(
        shown.affectedPrograms.map(
          (p: { nextVersionNumber: string }) => p.nextVersionNumber,
        ),
      ).toEqual(['1.1', '1.1', '1.1']);
      const dropped = shown.affectedPrograms.map(
        (p: { droppedCloLinks: number }) => p.droppedCloLinks,
      );
      expect(dropped.sort()).toEqual([0, 0, 1]);

      const refusedCohort = await finalApprove(
        admin,
        requestId,
        (await createSemester(app, 60)).id,
        { cohortIds: [(await createCohort(app, code('K-FAX-'))).id] },
      ).expect(409);
      expect(refusedCohort.body.code).toBe('COHORTS_NOT_ALLOWED');

      const semester = await createSemester(app, 60);
      const approved = (
        await finalApprove(admin, requestId, semester.id).expect(200)
      ).body;

      expect(approved.status).toBe('APPROVED');
      expect(approved.release.versions).toHaveLength(3);
      const revisions = await prisma.syllabus.findMany({
        where: { courseId: course.id },
        orderBy: { revisionNumber: 'asc' },
      });
      expect(revisions.map((r) => [r.revisionNumber, r.status])).toEqual([
        [1, 'HISTORICAL'],
        [2, 'PUBLISHED'],
      ]);
      expect(revisions[1]).toMatchObject({
        sourceRequestId: null,
        originRequestId: requestId,
        previousVersionId: firstRevision,
      });
      for (const { programId } of programs.slice(0, 3)) {
        const [oldVersion, newVersion] = await versionsOf(programId);
        expect(oldVersion).toMatchObject({
          versionNumber: '1.0',
          status: 'ACTIVE',
        });
        expect(newVersion).toMatchObject({
          versionNumber: '1.1',
          status: 'PENDING',
          originRequestId: requestId,
        });
        const oldRow = await prisma.curriculumItem.findFirstOrThrow({
          where: { versionId: oldVersion.id },
        });
        const newRow = await prisma.curriculumItem.findFirstOrThrow({
          where: { versionId: newVersion.id },
        });
        expect(oldRow.syllabusId).toBe(firstRevision);
        expect(newRow.syllabusId).toBe(revisions[1].id);
      }
      // The inactive program is not in use: no new version.
      expect(await versionsOf(programs[3].programId)).toHaveLength(1);

      // The CLO link follows its CLO by code to the new revision; the one whose CLO is gone is dropped.
      const [, p1New] = await versionsOf(programs[0].programId);
      const links = await prisma.cLOPLOMapping.findMany({
        where: { coursePlo: { curriculumItem: { versionId: p1New.id } } },
        include: { clo: true },
      });
      expect(links.map((l) => [l.clo.cloCode, l.clo.syllabusId])).toEqual([
        ['CLO1', revisions[1].id],
      ]);
      const [p1Old] = await versionsOf(programs[0].programId);
      const oldLinks = await prisma.cLOPLOMapping.findMany({
        where: { coursePlo: { curriculumItem: { versionId: p1Old.id } } },
      });
      expect(oldLinks.map((l) => l.cloId).sort()).toEqual(
        [clos.CLO1, clos.CLO2].sort(),
      );

      // Each version reads its own revision.
      const asOld = await admin
        .get(`/api/courses/${course.id}/syllabus?versionId=${p1Old.id}`)
        .expect(200);
      const asNew = await admin
        .get(`/api/courses/${course.id}/syllabus?versionId=${p1New.id}`)
        .expect(200);
      expect(asOld.body.published).toMatchObject({
        id: firstRevision,
        status: 'HISTORICAL',
        revisionNumber: 1,
      });
      expect(asNew.body.published).toMatchObject({
        revisionNumber: 2,
        status: 'PUBLISHED',
      });
      expect(asNew.body.published.objectives).toContain('Mục tiêu của bản mới');
      expect(asOld.body.published.objectives).not.toContain(
        'Mục tiêu của bản mới',
      );
      const matrix = await admin
        .get(
          `/api/curriculum-items/${(await prisma.curriculumItem.findFirstOrThrow({ where: { versionId: p1New.id } })).id}/clo-plo-matrix`,
        )
        .expect(200);
      expect(
        matrix.body.clos.map((c: { cloCode: string }) => c.cloCode),
      ).toEqual(['CLO1']);

      // The semester begins: all three activate, the request closes and the creator hears it once (KB-057).
      await prisma.semester.update({
        where: { id: semester.id },
        data: { startDate: new Date(isoDay(-1) + 'T00:00:00.000Z') },
      });
      expect(await processor().reconcile()).toBe(3);
      expect((await readRequest(admin, requestId)).status).toBe('EFFECTIVE');
      expect(await effectiveNotices(memberA, requestId)).toHaveLength(1);
      expect(await processor().reconcile()).toBe(0);
      expect(await effectiveNotices(memberA, requestId)).toHaveLength(1);
      for (const { programId } of programs.slice(0, 3)) {
        expect((await versionsOf(programId)).map((v) => v.status)).toEqual([
          'HISTORICAL',
          'ACTIVE',
        ]);
      }
    });

    it('releases all programs or none: a failing third program rolls the revision back too', async () => {
      const { course, programs } = await sharedCourse();
      const requestId = await revisionRequest(course.id);
      // The third program's frame is made unreachable behind the API's back, so only its check can catch it.
      const third = (await versionsOf(programs[2].programId))[0];
      await prisma.electiveGroup.create({
        data: {
          versionId: third.id,
          groupCode: 'BAD',
          groupName: 'Không đạt',
          minCourses: 5,
        },
      });
      const semester = await createSemester(app, 60);

      const refused = await finalApprove(admin, requestId, semester.id).expect(
        409,
      );

      expect(refused.body.code).toBe('CONSISTENCY_FAILED');
      expect((await readRequest(admin, requestId)).status).toBe(
        'PENDING_ACADEMIC_OFFICE',
      );
      for (const { programId } of programs) {
        expect(await versionsOf(programId)).toHaveLength(1);
      }
      expect(
        (
          await prisma.syllabus.findMany({ where: { courseId: course.id } })
        ).map((r) => [r.revisionNumber, r.status, r.sourceRequestId === null]),
      ).toEqual(
        expect.arrayContaining([
          [1, 'PUBLISHED', true],
          [null, 'DRAFT', false],
        ]),
      );

      // Once the cause is gone the same request goes through.
      await prisma.electiveGroup.deleteMany({
        where: { versionId: third.id, groupCode: 'BAD' },
      });
      await finalApprove(admin, requestId, semester.id).expect(200);
      expect(await versionsOf(programs[2].programId)).toHaveLength(2);
    });

    it('publishes the revision and closes Effective when no program holds the course', async () => {
      const course = await publishedCourse(app, admin, code('FAZ'), ga);
      const created = await openRequest(memberA, {
        requestType: 'SYLLABUS_CONTENT',
        targetType: 'COURSE',
        targetId: course.id,
      });
      await memberA
        .patch(`/api/syllabi/${created.workspace!.copyId}`)
        .set(CSRF)
        .send({ objectives: '<p>Chỉ có đề cương</p>' })
        .expect(200);
      await submitRequest(memberA, created.id).expect(200);
      await toLevelThree(created.id, [coordA]);

      const done = (
        await finalApprove(
          admin,
          created.id,
          (await createSemester(app, 60)).id,
        ).expect(200)
      ).body;

      expect(done).toMatchObject({
        status: 'EFFECTIVE',
        release: { versions: [] },
      });
      const current = await admin
        .get(`/api/courses/${course.id}/syllabus`)
        .expect(200);
      expect(current.body.published.revisionNumber).toBe(2);
      expect(await effectiveNotices(memberA, created.id)).toHaveLength(1);
    });
  });

  describe('a course request applies its authored items together (US-075, EC)', () => {
    async function courseRequest(courseId: string, items: object[]) {
      const created = await openRequest(directorA, {
        requestType: 'COURSE_RELATION',
        targetType: 'COURSE',
        targetId: courseId,
      });
      await directorA
        .put(`/api/change-requests/${created.id}/items`)
        .set(CSRF)
        .send({ items })
        .expect(200);
      await submitRequest(directorA, created.id).expect(200);
      await toLevelThree(created.id, [coordA]);
      return created.id as string;
    }

    it('changes the course and its relations, makes no version and closes Effective', async () => {
      const target = await publishedCourse(app, admin, code('FAT'), ga);
      const source = await createCourse(app, {
        courseCode: code('FAU'),
        groupId: ga,
      });
      const requestId = await courseRequest(target.id, [
        { operation: 'SET_COURSE_FIELD', field: 'credits', value: '4' },
        {
          operation: 'ADD_RELATION',
          sourceCourseId: source.id,
          targetCourseId: target.id,
          relationType: 'PREREQUISITE',
        },
      ]);
      expect((await preview(admin, requestId).expect(200)).body).toMatchObject({
        kind: 'AUTHORED',
        affectedPrograms: [],
        authoredLabels: expect.arrayContaining([expect.stringContaining('')]),
      });

      const done = (
        await finalApprove(
          admin,
          requestId,
          (await createSemester(app, 60)).id,
        ).expect(200)
      ).body;

      expect(done).toMatchObject({
        status: 'EFFECTIVE',
        release: { versions: [] },
      });
      expect(
        (
          await prisma.course.findUniqueOrThrow({ where: { id: target.id } })
        ).credits.toString(),
      ).toBe('4');
      expect(
        await prisma.courseRelation.count({
          where: {
            sourceCourseId: source.id,
            targetCourseId: target.id,
            relationType: 'PREREQUISITE',
          },
        }),
      ).toBe(1);
      expect(await effectiveNotices(directorA, requestId)).toHaveLength(1);
    });

    it('rolls everything back and names the item the owning rule refused (a requisite loop)', async () => {
      const target = await publishedCourse(app, admin, code('FAV'), ga);
      const source = await createCourse(app, {
        courseCode: code('FAW'),
        groupId: ga,
      });
      await prisma.courseRelation.create({
        data: {
          sourceCourseId: target.id,
          targetCourseId: source.id,
          relationType: 'PREREQUISITE',
        },
      });
      const requestId = await courseRequest(target.id, [
        { operation: 'SET_COURSE_FIELD', field: 'credits', value: '5' },
        {
          operation: 'ADD_RELATION',
          sourceCourseId: source.id,
          targetCourseId: target.id,
          relationType: 'PREREQUISITE',
        },
      ]);

      const refused = await finalApprove(
        admin,
        requestId,
        (await createSemester(app, 60)).id,
      ).expect(409);

      expect(refused.body.code).toBe('ITEM_APPLY_FAILED');
      expect(refused.body.details[0].constraints).toEqual(['REQUISITE_CYCLE']);
      expect(refused.body.details[0].field).toEqual(expect.any(String));
      expect(
        (
          await prisma.course.findUniqueOrThrow({ where: { id: target.id } })
        ).credits.toString(),
      ).toBe('3');
      expect((await readRequest(admin, requestId)).status).toBe(
        'PENDING_ACADEMIC_OFFICE',
      );
    });
  });
});
