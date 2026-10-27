import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seedAccessControl } from '../prisma/seed-data/seed-access-control.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import { releasedProgram } from './fixtures/change-requests.js';
import { createCourse } from './fixtures/courses.js';
import { addCurriculumItem, readCurriculum } from './fixtures/curriculum.js';
import { createPlo } from './fixtures/outcomes.js';
import { createProgram } from './fixtures/programs.js';
import {
  createCohort,
  createSemester,
  releaseViaApi,
  type ReleasedVersion,
} from './fixtures/releases.js';
import { PDF_BYTES } from './fixtures/syllabi.js';
import { startPostgres, startRedis } from './containers.js';
import type { TestPostgres, TestRedis } from './containers.js';
import { createTestApp } from './test-app.js';
import { setAppEnv } from './test-env.js';

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

type Agent = ReturnType<typeof request.agent>;

describe('corrections and signed attachments (US-076, US-077, MH-49)', () => {
  let postgres: TestPostgres;
  let redis: TestRedis;
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let director: Agent;
  let viewer: Agent;
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
    admin = await loginAgent(app, await createAccount(app, 'coradmin', 'R1'));
    director = await loginAgent(app, await createAccount(app, 'cordir', 'R3'));
    viewer = await loginAgent(
      app,
      await createAccount(app, 'corviewer', 'R2', { unitCode: 'KHOA_CNTT' }),
    );
  });

  afterAll(async () => {
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
  });

  // A released program with two courses, released into a semester that has begun unless `startOffset` says otherwise.
  async function released(startOffset = -30) {
    counter += 1;
    const courses = [
      await createCourse(app, { courseCode: `COR${counter}_A` }),
      await createCourse(app, { courseCode: `COR${counter}_B` }),
    ];
    const semester = await createSemester(app, startOffset);
    const program = await createProgram(app, { programCode: `COR${counter}` });
    const versionId = program.versions[0].id;
    for (const course of courses) {
      await addCurriculumItem(admin, versionId, {
        courseId: course.id,
        plannedSemester: 1,
      });
    }
    await releaseViaApi(app, admin, {
      programId: program.id,
      versionId,
      semesterId: semester.id,
    });
    return { programId: program.id, versionId, courses, semester };
  }

  const open = async (programId: string, versionId: string) =>
    (
      await admin
        .post(`/api/programs/${programId}/versions/${versionId}/corrections`)
        .set(CSRF)
        .expect(201)
    ).body as ReleasedVersion;

  const issue = (
    programId: string,
    versionId: string,
    correctionId: string,
    body: object = { reason: 'Sửa sai sót của bản đã ban hành.' },
    agent: Agent = admin,
  ) =>
    agent
      .post(
        `/api/programs/${programId}/versions/${versionId}/corrections/${correctionId}/issue`,
      )
      .set(CSRF)
      .send(body);

  const read = async (
    programId: string,
    versionId: string,
    agent: Agent = admin,
  ) =>
    (
      await agent
        .get(`/api/programs/${programId}/versions/${versionId}`)
        .expect(200)
    ).body as ReleasedVersion;

  it('opens one correction Draft per version, copies the released content, and shows it to R1 only', async () => {
    const { programId, versionId } = await released();

    const draft = await open(programId, versionId);
    expect(draft).toMatchObject({
      status: 'DRAFT',
      versionNumber: null,
      isCorrectionDraft: true,
      correctionOf: { id: versionId, versionNumber: '1.0' },
    });
    expect(draft.rows).toHaveLength(2);
    expect(draft.rows.map((row) => row.syllabus?.revisionNumber)).toEqual([
      1, 1,
    ]);
    // Opening it again (a page refresh) returns the same Draft.
    expect((await open(programId, versionId)).id).toBe(draft.id);
    expect(
      await prisma.programVersion.count({
        where: { correctionOfId: versionId },
      }),
    ).toBe(1);

    // The Draft is not a version of the program: not listed, not "current", not in the program's own Draft slot.
    const program = await admin.get(`/api/programs/${programId}`).expect(200);
    expect(program.body.versions).toHaveLength(1);
    expect(program.body.draftVersion).toBeNull();
    const list = await admin
      .get(`/api/programs/${programId}/versions`)
      .expect(200);
    expect(list.body.versions.map((row: { id: string }) => row.id)).toEqual([
      versionId,
    ]);
    await viewer
      .get(`/api/programs/${programId}/versions/${draft.id}`)
      .expect(404);
    const original = await read(programId, versionId);
    expect(original).toMatchObject({
      canCorrect: true,
      openCorrection: { id: draft.id },
    });
    expect(
      (await read(programId, versionId, viewer)).openCorrection,
    ).toBeNull();

    await director
      .post(`/api/programs/${programId}/versions/${versionId}/corrections`)
      .set(CSRF)
      .expect(403);
  });

  it('lets R1 edit the correction Draft through the ordinary routes while the corrected version stays frozen (PB-08)', async () => {
    const { programId, versionId } = await released();
    const draft = await open(programId, versionId);
    const draftItems = (await readCurriculum(admin, draft.id)).items;

    const curriculum = await readCurriculum(admin, draft.id);
    expect(curriculum).toMatchObject({
      editPath: 'DIRECT',
      canEditStructure: true,
      version: { status: 'DRAFT' },
    });
    await admin
      .patch(`/api/curriculum-items/${draftItems[0].id}`)
      .set(CSRF)
      .send({ plannedSemester: 2 })
      .expect(200);
    await admin
      .patch(`/api/program-versions/${draft.id}/info`)
      .set(CSRF)
      .send({ programName: 'Tên đã đính chính' })
      .expect(200);
    await createPlo(admin, draft.id, 'PLO1');
    expect(
      (
        await admin
          .get(`/api/program-versions/${draft.id}/consistency`)
          .expect(200)
      ).body,
    ).toMatchObject({ canAcceptMismatch: true });

    // The corrected version is unchanged and still refuses edits.
    const frozen = await readCurriculum(admin, versionId);
    expect(
      frozen.items.map(
        (item: { plannedSemester: number }) => item.plannedSemester,
      ),
    ).toEqual([1, 1]);
    const refused = await admin
      .patch(
        `/api/curriculum-items/${(await readCurriculum(admin, versionId)).items[0].id}`,
      )
      .set(CSRF)
      .send({ plannedSemester: 3 })
      .expect(409);
    expect(refused.body.code).toBe('VERSION_NOT_EDITABLE');

    // Nobody but R1 writes to the Draft, not even a director with curriculum.edit over the program.
    const outside = await director
      .patch(`/api/curriculum-items/${draftItems[1].id}`)
      .set(CSRF)
      .send({ plannedSemester: 2 });
    expect(outside.status).toBe(403);
    expect((await readCurriculum(director, draft.id)).canEditStructure).toBe(
      false,
    );
  });

  it('issues the correction as the next minor number: the corrected version becomes Historical and the cohorts follow (PB-09, KB-056)', async () => {
    const { programId, versionId } = await released();
    const cohort = await createCohort(app, `K-COR-${counter}`);
    const originalAssignment = await prisma.cohortVersion.create({
      data: {
        cohortId: cohort.id,
        programVersionId: versionId,
        fromSemesterId: (
          await prisma.programVersion.findUniqueOrThrow({
            where: { id: versionId },
          })
        ).effectiveSemesterId!,
      },
    });
    const draft = await open(programId, versionId);

    const missingReason = await issue(
      programId,
      versionId,
      draft.id,
      {},
    ).expect(400);
    expect(missingReason.body.code).toBe('VALIDATION_FAILED');
    await issue(
      programId,
      versionId,
      draft.id,
      { reason: 'x' },
      director,
    ).expect(403);
    const issued = (await issue(programId, versionId, draft.id).expect(201))
      .body as ReleasedVersion;

    expect(issued).toMatchObject({
      id: draft.id,
      versionNumber: '1.1',
      status: 'ACTIVE',
      decisionNumber: 'QD-TEST',
      isCorrectionDraft: false,
      correctionOf: { id: versionId, versionNumber: '1.0' },
      previousVersion: { id: versionId },
      correctionReason: 'Sửa sai sót của bản đã ban hành.',
      cohorts: [{ cohortCode: `K-COR-${counter}` }],
    });
    expect(issued.effectiveSemester?.id).toBe(
      (
        await prisma.programVersion.findUniqueOrThrow({
          where: { id: versionId },
        })
      ).effectiveSemesterId,
    );
    const original = await read(programId, versionId);
    expect(
      await prisma.cohortVersion.findUniqueOrThrow({
        where: { id: originalAssignment.id },
      }),
    ).toEqual({ ...originalAssignment, programVersionId: issued.id });
    const retroactive = await admin
      .get(`/api/programs/${programId}/cohorts/${cohort.id}/applied-version`)
      .query({ semesterId: originalAssignment.fromSemesterId })
      .expect(200);
    expect(retroactive.body.assignment.version.id).toBe(issued.id);
    expect(original).toMatchObject({
      status: 'HISTORICAL',
      correctedBy: { id: draft.id, versionNumber: '1.1' },
      cohorts: [],
      canCorrect: false,
    });
    expect(
      await prisma.programVersion.count({
        where: { programId, status: 'ACTIVE' },
      }),
    ).toBe(1);
    const program = await admin.get(`/api/programs/${programId}`).expect(200);
    expect(program.body.currentVersion).toMatchObject({
      versionNumber: '1.1',
      status: 'ACTIVE',
    });
    const list = await admin
      .get(`/api/programs/${programId}/versions`)
      .expect(200);
    expect(
      list.body.versions.map(
        (row: { versionNumber: string }) => row.versionNumber,
      ),
    ).toEqual(['1.1', '1.0']);

    // PB-09: the old version stays readable and read-only; it cannot be corrected twice.
    const again = await admin
      .post(`/api/programs/${programId}/versions/${versionId}/corrections`)
      .set(CSRF)
      .expect(409);
    expect(again.body.code).toBe('VERSION_NOT_CORRECTABLE');
    const frozen = await admin
      .post(`/api/program-versions/${versionId}/curriculum-items`)
      .set(CSRF)
      .send({
        courseId: (await createCourse(app, { courseCode: `COR${counter}_Z` }))
          .id,
        plannedSemester: 1,
        isElective: false,
      })
      .expect(409);
    expect(frozen.body.code).toBe('VERSION_NOT_EDITABLE');
    // The correction is itself correctable, and numbers 1.2.
    const second = await open(programId, draft.id);
    expect(
      (await issue(programId, draft.id, second.id).expect(201)).body
        .versionNumber,
    ).toBe('1.2');
  });

  it('leaves the cohorts on the corrected version when R1 asks it to', async () => {
    const { programId, versionId } = await released();
    const cohort = await createCohort(app, `K-KEEP-${counter}`);
    const originalAssignment = await prisma.cohortVersion.create({
      data: {
        cohortId: cohort.id,
        programVersionId: versionId,
        fromSemesterId: (
          await prisma.programVersion.findUniqueOrThrow({
            where: { id: versionId },
          })
        ).effectiveSemesterId!,
      },
    });
    const draft = await open(programId, versionId);

    const issued = (
      await issue(programId, versionId, draft.id, {
        reason: 'Không chuyển khóa',
        moveCohorts: false,
      }).expect(201)
    ).body as ReleasedVersion;

    expect(issued.cohorts).toEqual([]);
    expect((await read(programId, versionId)).cohorts).toHaveLength(1);
    expect(
      await prisma.cohortVersion.findUniqueOrThrow({
        where: { id: originalAssignment.id },
      }),
    ).toEqual(originalAssignment);
    const unchanged = await admin
      .get(`/api/programs/${programId}/cohorts/${cohort.id}/applied-version`)
      .query({ semesterId: originalAssignment.fromSemesterId })
      .expect(200);
    expect(unchanged.body.assignment.version.id).toBe(versionId);
  });

  it('keeps a Pending version Pending and leaves its request provenance on the correction', async () => {
    const { programId, versionId } = await released(60);
    const draft = await open(programId, versionId);

    const issued = (await issue(programId, versionId, draft.id).expect(201))
      .body as ReleasedVersion;

    expect(issued.status).toBe('PENDING');
    expect((await read(programId, versionId)).status).toBe('HISTORICAL');
    expect(
      await prisma.programVersion.count({
        where: { programId, status: 'ACTIVE' },
      }),
    ).toBe(0);
  });

  it('discards only an unissued Draft and refuses a Historical, Draft or foreign base', async () => {
    const { programId, versionId } = await released();
    const other = await released();
    const draft = await open(programId, versionId);

    await admin
      .delete(
        `/api/programs/${programId}/versions/${versionId}/corrections/${draft.id}`,
      )
      .set(CSRF)
      .expect(204);
    expect(
      await prisma.programVersion.findUnique({ where: { id: draft.id } }),
    ).toBeNull();
    const gone = await admin
      .delete(
        `/api/programs/${programId}/versions/${versionId}/corrections/${draft.id}`,
      )
      .set(CSRF)
      .expect(404);
    expect(gone.body.code).toBe('CORRECTION_NOT_FOUND');
    await director
      .delete(
        `/api/programs/${programId}/versions/${versionId}/corrections/${draft.id}`,
      )
      .set(CSRF)
      .expect(403);

    // A fresh Draft can be opened again after discarding (the unique link was freed).
    const reopened = await open(programId, versionId);
    expect(reopened.id).not.toBe(draft.id);
    await issue(programId, versionId, reopened.id).expect(201);
    const issuedDelete = await admin
      .delete(
        `/api/programs/${programId}/versions/${versionId}/corrections/${reopened.id}`,
      )
      .set(CSRF);
    expect(issuedDelete.status).toBe(404);
    expect(issuedDelete.body.code).toBe('CORRECTION_NOT_FOUND');

    // A version of another program is a stranger to this one.
    await admin
      .post(
        `/api/programs/${programId}/versions/${other.versionId}/corrections`,
      )
      .set(CSRF)
      .expect(404);
    const historical = await admin
      .post(`/api/programs/${programId}/versions/${versionId}/corrections`)
      .set(CSRF)
      .expect(409);
    expect(historical.body.code).toBe('VERSION_NOT_CORRECTABLE');
  });

  it('refuses to issue a correction whose frame no longer passes the consistency check', async () => {
    const { programId, versionId } = await released();
    const draft = await open(programId, versionId);
    await admin
      .post(`/api/program-versions/${draft.id}/elective-groups`)
      .set(CSRF)
      .send({ groupCode: 'TC1', groupName: 'Không đạt nổi', minCourses: 5 })
      .expect(201);

    const refused = await issue(programId, versionId, draft.id).expect(409);

    expect(refused.body.code).toBe('CONSISTENCY_FAILED');
    expect((await read(programId, versionId)).status).toBe('ACTIVE');
    expect(
      (
        await prisma.programVersion.findUniqueOrThrow({
          where: { id: draft.id },
        })
      ).status,
    ).toBe('DRAFT');
  });

  describe('signed attachments (US-077, CV-193)', () => {
    const attach = (
      agent: Agent,
      syllabusId: string,
      name = 'Quyết định ký.pdf',
    ) =>
      agent
        .post(`/api/syllabi/${syllabusId}/attachments`)
        .set(CSRF)
        .attach('file', PDF_BYTES, { filename: name });

    it('adds a signed file to a published revision and never lets one go', async () => {
      const { courses } = await released();
      const state = await admin
        .get(`/api/courses/${courses[0].id}/syllabus`)
        .expect(200);
      expect(state.body).toMatchObject({ canAttachToPublished: true });
      const published = state.body.published.id as string;

      const uploaded = await attach(admin, published).expect(201);
      expect(uploaded.body).toMatchObject({ fileName: 'Quyết định ký.pdf' });
      await admin
        .get(`/api/syllabus-attachments/${uploaded.body.id}/file`)
        .expect(200);

      const locked = await admin
        .delete(`/api/syllabus-attachments/${uploaded.body.id}`)
        .set(CSRF)
        .expect(409);
      expect(locked.body.code).toBe('ATTACHMENT_LOCKED');
      // Not even for the uploader, and not through a request holder either.
      const byDirector = await director
        .delete(`/api/syllabus-attachments/${uploaded.body.id}`)
        .set(CSRF);
      expect(byDirector.status).toBe(409);
      expect(byDirector.body.code).toBe('ATTACHMENT_LOCKED');
      expect(
        await prisma.syllabusAttachment.count({
          where: { syllabusId: published },
        }),
      ).toBe(1);
      // The body of the published revision stays immutable.
      await admin
        .patch(`/api/syllabi/${published}`)
        .set(CSRF)
        .send({ objectives: '<p>Sửa</p>' })
        .expect(409);
    });

    it('refuses a reader without syllabus.edit and shows no upload affordance', async () => {
      const { courses } = await released();
      const state = await viewer
        .get(`/api/courses/${courses[0].id}/syllabus`)
        .expect(200);
      expect(state.body.canAttachToPublished).toBe(false);

      const refused = await attach(viewer, state.body.published.id);
      expect(refused.status).toBe(403);
    });

    it('lets a file be added to a revision a version pins after it went Historical, and shows it on that version', async () => {
      const { courses, programId, versionId } = await released();
      const first = (
        await admin.get(`/api/courses/${courses[0].id}/syllabus`).expect(200)
      ).body.published.id as string;
      await prisma.syllabus.update({
        where: { id: first },
        data: { status: 'HISTORICAL' },
      });
      await prisma.syllabus.create({
        data: {
          courseId: courses[0].id,
          revisionNumber: 2,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          previousVersionId: first,
        },
      });

      await attach(admin, first, 'Bản đính kèm muộn.pdf').expect(201);

      const view = await admin
        .get(`/api/courses/${courses[0].id}/syllabus?versionId=${versionId}`)
        .expect(200);
      expect(view.body.published).toMatchObject({
        id: first,
        status: 'HISTORICAL',
      });
      expect(view.body.published.attachments).toEqual([
        expect.objectContaining({
          fileName: 'Bản đính kèm muộn.pdf',
          canDelete: false,
        }),
      ]);
      expect(programId).toBeTruthy();
    });
  });

  it('is open to the shared fixtures: a release through releasedProgram is correctable too', async () => {
    const course = await createCourse(app, {
      courseCode: `COR_FIX${(counter += 1)}`,
    });
    const program = await releasedProgram(app, admin, `CORFIX${counter}`, [
      course.id,
    ]);

    const draft = await open(program.programId, program.versionId);

    expect(draft.isCorrectionDraft).toBe(true);
  });
});
