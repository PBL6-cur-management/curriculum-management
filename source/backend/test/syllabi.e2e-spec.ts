import { existsSync, readdirSync } from 'node:fs';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seedAccessControl } from '../prisma/seed-data/seed-access-control.js';
import { SubjectGroupMemberRole } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import { createCourse, createForeignFaculty } from './fixtures/courses.js';
import { addCurriculumItem, readCurriculum } from './fixtures/curriculum.js';
import { createProgram } from './fixtures/programs.js';
import { publishSyllabusViaRelease } from './fixtures/releases.js';
import {
  addMembership,
  createSubjectGroup,
} from './fixtures/subject-groups.js';
import {
  createSyllabusDraft,
  EXE_BYTES,
  PDF_BYTES,
} from './fixtures/syllabi.js';
import { startPostgres, startRedis } from './containers.js';
import type { TestPostgres, TestRedis } from './containers.js';
import { createTestApp } from './test-app.js';
import { setAppEnv } from './test-env.js';

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };
const MB = 1024 * 1024;
const OVER_LIMIT_BYTES = 51 * MB;

type Agent = ReturnType<typeof request.agent>;

describe('syllabi', () => {
  let postgres: TestPostgres;
  let redis: TestRedis;
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let director: Agent;
  let coordinator: Agent;
  let lecturer: Agent;
  let otherLecturer: Agent;
  let student: Agent;
  let outsider: Agent;
  let g1Id: string;
  let g2Id: string;
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
    g1Id = (await createSubjectGroup(app, 'SYL_G1')).id;
    g2Id = (await createSubjectGroup(app, 'SYL_G2')).id;
    admin = await loginAgent(app, await createAccount(app, 'syladmin', 'R1'));
    director = await loginAgent(app, await createAccount(app, 'syldir', 'R3'));
    // R6 is derived from enrolment (F-17), so the test gives it by hand and scopes it to a unit, as a student is not school-wide.
    student = await loginAgent(
      app,
      await createAccount(app, 'sylstudent', 'R6', { unitCode: 'PDT' }),
    );
    outsider = await loginAgent(app, await createAccount(app, 'sylnone'));
    const coordinatorAccount = await createAccount(app, 'sylcoordinator');
    for (const memberRole of [
      SubjectGroupMemberRole.MEMBER,
      SubjectGroupMemberRole.COORDINATOR,
    ]) {
      await addMembership(app, {
        groupId: g1Id,
        userId: coordinatorAccount.id,
        memberRole,
      });
    }
    coordinator = await loginAgent(app, coordinatorAccount);
    const lecturerAccount = await createAccount(app, 'syllecturer');
    await addMembership(app, { groupId: g1Id, userId: lecturerAccount.id });
    lecturer = await loginAgent(app, lecturerAccount);
    const otherAccount = await createAccount(app, 'sylother');
    await addMembership(app, { groupId: g2Id, userId: otherAccount.id });
    otherLecturer = await loginAgent(app, otherAccount);
  });

  afterAll(async () => {
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
  });

  function newCourse(groupId: string | null = g1Id, facultyCode?: string) {
    counter += 1;
    return createCourse(app, {
      courseCode: `SYL${counter}`,
      groupId,
      facultyCode,
    });
  }

  function patchSection(agent: Agent, syllabusId: string, body: object) {
    return agent.patch(`/api/syllabi/${syllabusId}`).set(CSRF).send(body);
  }

  function getSyllabus(agent: Agent, courseId: string) {
    return agent.get(`/api/courses/${courseId}/syllabus`);
  }

  function filesUnderRoot(): string[] {
    const root = process.env.FILES_ROOT!;
    return existsSync(root)
      ? readdirSync(root, { recursive: true, withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => entry.name)
      : [];
  }

  function attach(
    agent: Agent,
    syllabusId: string,
    body: Buffer,
    name: string,
  ) {
    return agent
      .post(`/api/syllabi/${syllabusId}/attachments`)
      .set(CSRF)
      .field('materialKind', 'SIGNED_SYLLABUS')
      .attach('file', body, { filename: name });
  }

  it('offers creation on a course without a syllabus and starts a Draft (KB-036)', async () => {
    const course = await newCourse();
    const before = await getSyllabus(director, course.id).expect(200);
    expect(before.body).toMatchObject({
      published: null,
      draft: null,
      canCreate: true,
      editPath: 'DIRECT',
    });
    expect(before.body.attachmentRules.maxBytes).toBe(50 * MB);

    const created = await director
      .post(`/api/courses/${course.id}/syllabus`)
      .set(CSRF)
      .expect(201);
    expect(created.body.draft).toMatchObject({
      revisionNumber: 1,
      status: 'DRAFT',
      courseDescription: null,
    });
    expect(created.body.canCreate).toBe(false);
  });

  it('keeps bold, a list and a table that R4 saves (NT-B3-01)', async () => {
    const course = await newCourse();
    const draft = await createSyllabusDraft(admin, course.id);
    const html =
      '<p><strong>Đậm</strong></p><ul><li>Một</li></ul>' +
      '<table><tbody><tr><td colspan="2">ô</td></tr></tbody></table>';

    const saved = await patchSection(coordinator, draft.id, {
      courseDescription: html,
    }).expect(200);
    expect(saved.body.courseDescription).toBe(html);

    const read = await getSyllabus(admin, course.id).expect(200);
    expect(read.body.draft.courseDescription).toBe(html);
  });

  it('shows one revision to every program that uses the course (NT-B3-02)', async () => {
    const course = await newCourse();
    const draft = await createSyllabusDraft(admin, course.id);
    const programA = await createProgram(app, { programCode: 'SYLPA' });
    const programB = await createProgram(app, { programCode: 'SYLPB' });
    for (const program of [programA, programB]) {
      await addCurriculumItem(admin, program.versions[0].id, {
        courseId: course.id,
        plannedSemester: 1,
      });
    }

    const read = await getSyllabus(student, course.id).expect(200);
    const again = await getSyllabus(admin, course.id).expect(200);

    expect(again.body.draft.id).toBe(draft.id);
    expect(
      again.body.programsUsing.map(
        (u: { programCode: string }) => u.programCode,
      ),
    ).toEqual(['SYLPA', 'SYLPB']);
    expect(read.body.draft).toBeNull();
  });

  it('flags curriculum rows by whether the course has a syllabus (EC-44)', async () => {
    const withIt = await newCourse();
    const without = await newCourse();
    const program = await createProgram(app, { programCode: 'SYLCUR' });
    const versionId = program.versions[0].id;
    for (const course of [withIt, without]) {
      await addCurriculumItem(admin, versionId, {
        courseId: course.id,
        plannedSemester: 1,
      });
    }
    const flags = async () =>
      new Map(
        (await readCurriculum(admin, versionId)).items.map(
          (item: { course: { id: string }; hasSyllabus: boolean }) => [
            item.course.id,
            item.hasSyllabus,
          ],
        ),
      );

    expect(await flags()).toEqual(
      new Map([
        [withIt.id, false],
        [without.id, false],
      ]),
    );
    await createSyllabusDraft(admin, withIt.id);
    expect(await flags()).toEqual(
      new Map([
        [withIt.id, true],
        [without.id, false],
      ]),
    );
  });

  it('refuses R5 outside their group and lets them edit inside it (US-039 AC4)', async () => {
    const own = await newCourse(g1Id);
    const foreignGroup = await newCourse(g2Id);
    const ownDraft = await createSyllabusDraft(admin, own.id);
    const otherDraft = await createSyllabusDraft(admin, foreignGroup.id);

    await patchSection(lecturer, ownDraft.id, {
      objectives: '<p>ok</p>',
    }).expect(200);
    const refused = await patchSection(lecturer, otherDraft.id, {
      objectives: '<p>no</p>',
    }).expect(403);
    expect(refused.body.code).toBe('OUT_OF_SCOPE');
    await patchSection(otherLecturer, otherDraft.id, {
      objectives: '<p>yes</p>',
    }).expect(200);
  });

  it('neutralizes pasted script, handlers and javascript links (US-039 AC5)', async () => {
    const course = await newCourse();
    const draft = await createSyllabusDraft(admin, course.id);

    const saved = await patchSection(admin, draft.id, {
      courseDescription:
        '<p onclick="x()">Trước</p><script>alert(1)</script>' +
        '<img src=x onerror=alert(1)><a href="javascript:alert(1)">liên kết</a>' +
        '<p style="color:red">Sau</p>',
    }).expect(200);

    const stored = saved.body.courseDescription as string;
    expect(stored).not.toMatch(/script|onclick|onerror|javascript|style|<img/);
    expect(stored).toContain('Trước');
    expect(stored).toContain('liên kết');
    expect(stored).toContain('Sau');
  });

  it('saves and clears the English description (US-040)', async () => {
    const course = await newCourse();
    const draft = await createSyllabusDraft(admin, course.id);

    const saved = await patchSection(admin, draft.id, {
      englishDescription: '<p>Intro</p>',
      courseDescription: '<p>Mô tả</p>',
    }).expect(200);
    expect(saved.body.englishDescription).toBe('<p>Intro</p>');

    const cleared = await patchSection(admin, draft.id, {
      englishDescription: null,
    }).expect(200);
    expect(cleared.body.englishDescription).toBeNull();
    expect(cleared.body.courseDescription).toBe('<p>Mô tả</p>');
  });

  it('refuses a field that is not a section', async () => {
    const course = await newCourse();
    const draft = await createSyllabusDraft(admin, course.id);

    const refused = await patchSection(admin, draft.id, {
      status: 'PUBLISHED',
    }).expect(400);
    expect(refused.body.code).toBe('VALIDATION_FAILED');
  });

  it('keeps weekly rows in order and closes the gap on delete', async () => {
    const course = await newCourse();
    const draft = await createSyllabusDraft(admin, course.id);
    const ids: string[] = [];
    for (const label of ['Tuần 1', 'Tuần 2', 'Tuần 3']) {
      const added = await admin
        .post(`/api/syllabi/${draft.id}/weekly-contents`)
        .set(CSRF)
        .send({ weekLabel: label, content: `<p>${label}</p>` })
        .expect(201);
      ids.push(added.body.id);
    }

    const reordered = await admin
      .put(`/api/syllabi/${draft.id}/weekly-contents/order`)
      .set(CSRF)
      .send({ ids: [ids[2], ids[0], ids[1]] })
      .expect(200);
    expect(
      reordered.body.map((row: { weekLabel: string }) => row.weekLabel),
    ).toEqual(['Tuần 3', 'Tuần 1', 'Tuần 2']);
    const mismatch = await admin
      .put(`/api/syllabi/${draft.id}/weekly-contents/order`)
      .set(CSRF)
      .send({ ids: [ids[0], ids[1]] })
      .expect(409);
    expect(mismatch.body.code).toBe('SYLLABUS_ORDER_MISMATCH');

    await admin.delete(`/api/weekly-contents/${ids[0]}`).set(CSRF).expect(204);
    const read = await getSyllabus(admin, course.id).expect(200);
    expect(
      read.body.draft.weeklyContents.map(
        (row: { weekLabel: string; sortOrder: number }) => [
          row.weekLabel,
          row.sortOrder,
        ],
      ),
    ).toEqual([
      ['Tuần 3', 1],
      ['Tuần 2', 2],
    ]);

    const edited = await admin
      .patch(`/api/weekly-contents/${ids[2]}`)
      .set(CSRF)
      .send({ teachingActivities: '<p>Thực hành</p>' })
      .expect(200);
    expect(edited.body.teachingActivities).toBe('<p>Thực hành</p>');
    const empty = await admin
      .post(`/api/syllabi/${draft.id}/weekly-contents`)
      .set(CSRF)
      .send({ weekLabel: 'Tuần 9', content: '<p> </p>' })
      .expect(400);
    expect(empty.body.details[0].field).toBe('content');
  });

  describe('attachments', () => {
    it.each([undefined, 'INVALID'])(
      'refuses materialKind %s before storing a file or row',
      async (materialKind) => {
        const course = await newCourse();
        const draft = await createSyllabusDraft(admin, course.id);
        const before = filesUnderRoot().length;
        const upload = admin
          .post(`/api/syllabi/${draft.id}/attachments`)
          .set(CSRF);
        if (materialKind !== undefined)
          upload.field('materialKind', materialKind);
        await upload
          .attach('file', PDF_BYTES, { filename: 'kind.pdf' })
          .expect(400);
        expect(
          await prisma.syllabusAttachment.count({
            where: { syllabusId: draft.id },
          }),
        ).toBe(0);
        expect(filesUnderRoot()).toHaveLength(before);
      },
    );

    it('stores a signed copy under its Vietnamese name and serves it back (US-041 AC1)', async () => {
      const course = await newCourse();
      const draft = await createSyllabusDraft(admin, course.id);

      const uploaded = await attach(
        director,
        draft.id,
        PDF_BYTES,
        'Đề cương ký.pdf',
      ).expect(201);
      expect(uploaded.body).toMatchObject({
        materialKind: 'SIGNED_SYLLABUS',
        fileName: 'Đề cương ký.pdf',
        fileType: 'PDF',
        sizeBytes: PDF_BYTES.length,
        uploadedBy: { fullName: 'syldir' },
        canDelete: true,
      });

      const read = await getSyllabus(admin, course.id).expect(200);
      expect(read.body.draft.attachments).toHaveLength(1);
      expect(read.body.draft.attachments[0].canDelete).toBe(false);

      const download = await admin
        .get(`/api/syllabus-attachments/${uploaded.body.id}/file`)
        .buffer(true)
        .parse((res, done) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => done(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(Buffer.compare(download.body as Buffer, PDF_BYTES)).toBe(0);
      expect(download.headers['content-disposition']).toContain(
        `filename*=UTF-8''${encodeURIComponent('Đề cương ký.pdf')}`,
      );
      expect(download.headers['content-type']).toContain('application/pdf');
    });

    it('refuses a renamed executable and an oversize file and writes nothing (US-041 AC2)', async () => {
      const course = await newCourse();
      const draft = await createSyllabusDraft(admin, course.id);
      const before = filesUnderRoot().length;

      const wrongType = await attach(
        admin,
        draft.id,
        EXE_BYTES,
        'renamed-exe.pdf',
      ).expect(400);
      expect(wrongType.body.code).toBe('ATTACHMENT_TYPE_NOT_ALLOWED');

      const tooLarge = await attach(
        admin,
        draft.id,
        Buffer.concat([PDF_BYTES, Buffer.alloc(OVER_LIMIT_BYTES)]),
        'big.pdf',
      ).expect(413);
      expect(tooLarge.body.code).toBe('PAYLOAD_TOO_LARGE');

      const missing = await admin
        .post(`/api/syllabi/${draft.id}/attachments`)
        .set(CSRF)
        .field('materialKind', 'OTHER')
        .expect(400);
      expect(missing.body.code).toBe('ATTACHMENT_FILE_REQUIRED');
      expect(filesUnderRoot()).toHaveLength(before);
    });

    it('lets only the uploader remove a file, and removes it from disk (US-041 AC3)', async () => {
      const course = await newCourse();
      const draft = await createSyllabusDraft(admin, course.id);
      const uploaded = await attach(
        coordinator,
        draft.id,
        PDF_BYTES,
        'a.pdf',
      ).expect(201);
      const withFile = filesUnderRoot().length;

      const refused = await director
        .delete(`/api/syllabus-attachments/${uploaded.body.id}`)
        .set(CSRF)
        .expect(403);
      expect(refused.body.code).toBe('ATTACHMENT_NOT_UPLOADER');
      expect(filesUnderRoot()).toHaveLength(withFile);

      await coordinator
        .delete(`/api/syllabus-attachments/${uploaded.body.id}`)
        .set(CSRF)
        .expect(204);
      expect(filesUnderRoot()).toHaveLength(withFile - 1);
      await admin
        .get(`/api/syllabus-attachments/${uploaded.body.id}/file`)
        .expect(404);
    });

    it('answers FILE_MISSING when the file left the disk', async () => {
      const course = await newCourse();
      const draft = await createSyllabusDraft(admin, course.id);
      const uploaded = await attach(
        admin,
        draft.id,
        PDF_BYTES,
        'gone.pdf',
      ).expect(201);
      const row = await prisma.syllabusAttachment.findUniqueOrThrow({
        where: { id: uploaded.body.id },
      });
      const { rm } = await import('node:fs/promises');
      await rm(`${process.env.FILES_ROOT}/${row.filePath}`);

      const res = await admin
        .get(`/api/syllabus-attachments/${uploaded.body.id}/file`)
        .expect(404);
      expect(res.body.code).toBe('FILE_MISSING');
    });
  });

  it('shows a student only published content (MH-36)', async () => {
    const course = await newCourse();
    const draft = await createSyllabusDraft(admin, course.id);
    const uploaded = await attach(admin, draft.id, PDF_BYTES, 'n.pdf').expect(
      201,
    );

    const hidden = await getSyllabus(student, course.id).expect(200);
    expect(hidden.body).toMatchObject({ published: null, draft: null });
    const file = await student
      .get(`/api/syllabus-attachments/${uploaded.body.id}/file`)
      .expect(404);
    expect(file.body.code).toBe('SYLLABUS_NOT_FOUND');

    await publishSyllabusViaRelease(app, admin, course.id);
    const seen = await getSyllabus(student, course.id).expect(200);
    expect(seen.body.published.id).toBe(draft.id);
    await student
      .get(`/api/syllabus-attachments/${uploaded.body.id}/file`)
      .expect(200);
  });

  it('routes every change of a published syllabus through a request', async () => {
    const course = await newCourse();
    const draft = await createSyllabusDraft(admin, course.id);
    await publishSyllabusViaRelease(app, admin, course.id);

    const read = await getSyllabus(admin, course.id).expect(200);
    expect(read.body).toMatchObject({
      editPath: 'VIA_REQUEST',
      canCreate: false,
    });
    expect(read.body.published.id).toBe(draft.id);
    const patched = await patchSection(admin, draft.id, {
      objectives: '<p>x</p>',
    }).expect(409);
    expect(patched.body.code).toBe('CHANGE_REQUEST_REQUIRED');
    const again = await admin
      .post(`/api/courses/${course.id}/syllabus`)
      .set(CSRF)
      .expect(409);
    expect(again.body.code).toBe('CHANGE_REQUEST_REQUIRED');
    const week = await admin
      .post(`/api/syllabi/${draft.id}/weekly-contents`)
      .set(CSRF)
      .send({ weekLabel: 'Tuần 1', content: '<p>x</p>' })
      .expect(409);
    expect(week.body.code).toBe('CHANGE_REQUEST_REQUIRED');
  });

  it('lets exactly one of two parallel creations win', async () => {
    const course = await newCourse();

    const [first, second] = await Promise.all([
      admin.post(`/api/courses/${course.id}/syllabus`).set(CSRF),
      director.post(`/api/courses/${course.id}/syllabus`).set(CSRF),
    ]);

    expect([first.status, second.status].sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    const loser = first.status === 409 ? first : second;
    expect(loser.body.code).toBe('SYLLABUS_ALREADY_EXISTS');
    expect(
      await prisma.syllabus.count({ where: { courseId: course.id } }),
    ).toBe(1);
  });

  it('creating twice answers a conflict', async () => {
    const course = await newCourse();
    await createSyllabusDraft(admin, course.id);

    const again = await admin
      .post(`/api/courses/${course.id}/syllabus`)
      .set(CSRF)
      .expect(409);
    expect(again.body.code).toBe('SYLLABUS_ALREADY_EXISTS');
  });

  it('leaves a foreign-faculty course to R1 (R3 only through a request)', async () => {
    const math = await createForeignFaculty(app, 'SYL_MATH');
    const course = await newCourse(null, math.unitCode);

    const asDirector = await getSyllabus(director, course.id).expect(200);
    expect(asDirector.body).toMatchObject({
      editPath: 'VIA_REQUEST',
      canCreate: false,
    });
    const refused = await director
      .post(`/api/courses/${course.id}/syllabus`)
      .set(CSRF)
      .expect(409);
    expect(refused.body.code).toBe('CHANGE_REQUEST_REQUIRED');
    const asAdmin = await getSyllabus(admin, course.id).expect(200);
    expect(asAdmin.body).toMatchObject({ editPath: 'DIRECT', canCreate: true });
  });

  it('hides a cancelled course from callers without course.edit and refuses to create for R1', async () => {
    const course = await newCourse();
    await prisma.course.update({
      where: { id: course.id },
      data: { status: 'CANCELLED' },
    });

    const hidden = await getSyllabus(student, course.id).expect(404);
    expect(hidden.body.code).toBe('COURSE_NOT_FOUND');
    const refused = await admin
      .post(`/api/courses/${course.id}/syllabus`)
      .set(CSRF)
      .expect(409);
    expect(refused.body.code).toBe('COURSE_CANCELLED');
  });

  it('answers 404 for an unknown course and refuses a caller without syllabus.view', async () => {
    await getSyllabus(admin, 'unknown').expect(404);
    await getSyllabus(outsider, 'unknown').expect(403);
  });

  it('enforces the database rules on revisions (one Draft, published needs a time)', async () => {
    const course = await newCourse();
    await createSyllabusDraft(admin, course.id);

    await expect(
      prisma.syllabus.create({
        data: { courseId: course.id, revisionNumber: 2, status: 'DRAFT' },
      }),
    ).rejects.toThrow(/Syllabus_one_draft/);
    await expect(
      prisma.syllabus.create({
        data: { courseId: course.id, revisionNumber: 3, status: 'PUBLISHED' },
      }),
    ).rejects.toThrow(/Syllabus_published_has_time/);
  });
});
