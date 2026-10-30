import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seedAccessControl } from '../prisma/seed-data/seed-access-control.js';
import {
  ProgramVersionStatus,
  SubjectGroupMemberRole,
} from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import { createCourse } from './fixtures/courses.js';
import { addCurriculumItem } from './fixtures/curriculum.js';
import {
  createClo,
  createPlo,
  putLinks,
  putWeight,
  setPloWeight,
} from './fixtures/outcomes.js';
import { assignDirector, createProgram } from './fixtures/programs.js';
import {
  addMembership,
  createSubjectGroup,
} from './fixtures/subject-groups.js';
import { createSyllabusDraft } from './fixtures/syllabi.js';
import { startPostgres, startRedis } from './containers.js';
import type { TestPostgres, TestRedis } from './containers.js';
import { createTestApp } from './test-app.js';
import { setAppEnv } from './test-env.js';

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

type Agent = ReturnType<typeof request.agent>;

describe('outcomes: PLO, course-PLO and CLO-PLO matrices', () => {
  let postgres: TestPostgres;
  let redis: TestRedis;
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let director: Agent;
  let viewer: Agent;
  let coordinator: Agent;
  let student: Agent;
  let g1Id: string;
  let g2Id: string;
  let directorId: string;
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
    g1Id = (await createSubjectGroup(app, 'OUT_G1')).id;
    g2Id = (await createSubjectGroup(app, 'OUT_G2')).id;
    admin = await loginAgent(app, await createAccount(app, 'outadmin', 'R1'));
    viewer = await loginAgent(app, await createAccount(app, 'outviewer', 'R2'));
    const directorAccount = await createAccount(app, 'outdirector', 'R3');
    director = await loginAgent(app, directorAccount);
    // R6 is derived from enrolment (F-17), so the test gives it by hand: a unit scope other than the faculty is refused,
    // the faculty itself reads the PLO list but never a matrix.
    student = await loginAgent(
      app,
      await createAccount(app, 'outstudent', 'R6', { unitCode: 'KHOA_CNTT' }),
    );
    const coordinatorAccount = await createAccount(app, 'outcoordinator');
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
    directorId = directorAccount.id;
  });

  afterAll(async () => {
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
  });

  async function newProgram(directed = false) {
    counter += 1;
    const program = await createProgram(app, {
      programCode: `OUT_P${counter}`,
    });
    if (directed) {
      await assignDirector(app, {
        programId: program.id,
        userId: directorId,
      });
    }
    return { program, versionId: program.versions[0].id };
  }

  async function newCourse(groupId: string | null = g1Id) {
    counter += 1;
    return createCourse(app, { courseCode: `OUTC${counter}`, groupId });
  }

  async function mappedCourse(
    versionId: string,
    groupId: string | null = g1Id,
  ) {
    const course = await newCourse(groupId);
    const item = await addCurriculumItem(admin, versionId, {
      courseId: course.id,
      plannedSemester: 1,
    });
    return { course, item };
  }

  it('keeps PLO1 of two programs independent and refuses a duplicate code (KB-031)', async () => {
    const a = await newProgram(true);
    const b = await newProgram();
    const ploA = await createPlo(admin, a.versionId, 'plo1');
    const ploB = await createPlo(admin, b.versionId, 'PLO1', {
      description: 'B gốc',
    });
    expect(ploA.ploCode).toBe('PLO1');

    await admin
      .patch(`/api/plos/${ploA.id}`)
      .set(CSRF)
      .send({ description: 'A đã sửa', competencyGroup: 'Kiến thức' })
      .expect(200);
    const duplicate = await admin
      .post(`/api/program-versions/${a.versionId}/plos`)
      .set(CSRF)
      .send({ ploCode: ' plo1 ', description: 'Trùng' })
      .expect(409);
    expect(duplicate.body).toMatchObject({
      code: 'PLO_CODE_TAKEN',
      details: [{ field: 'ploCode' }],
    });

    const listB = await admin
      .get(`/api/program-versions/${b.versionId}/plos`)
      .expect(200);
    expect(listB.body.plos).toEqual([
      expect.objectContaining({ id: ploB.id, description: 'B gốc' }),
    ]);
    const listA = await director
      .get(`/api/program-versions/${a.versionId}/plos`)
      .expect(200);
    expect(listA.body).toMatchObject({ editPath: 'DIRECT', canEdit: true });
    expect(listA.body.plos[0]).toMatchObject({
      description: 'A đã sửa',
      competencyGroup: 'Kiến thức',
    });
  });

  it('reorders and renumbers PLOs, and refuses a list that does not match', async () => {
    const { versionId } = await newProgram();
    const [p1, p2, p3] = [
      await createPlo(admin, versionId, 'PLO1'),
      await createPlo(admin, versionId, 'PLO2'),
      await createPlo(admin, versionId, 'PLO3'),
    ];

    await admin
      .put(`/api/program-versions/${versionId}/plos/order`)
      .set(CSRF)
      .send({ ids: [p3.id, p1.id] })
      .expect(409);
    const reordered = await admin
      .put(`/api/program-versions/${versionId}/plos/order`)
      .set(CSRF)
      .send({ ids: [p3.id, p1.id, p2.id] })
      .expect(200);
    expect(reordered.body.map((p: PloOrder) => p.ploCode)).toEqual([
      'PLO3',
      'PLO1',
      'PLO2',
    ]);

    await admin.delete(`/api/plos/${p1.id}`).set(CSRF).expect(204);
    const after = await admin
      .get(`/api/program-versions/${versionId}/plos`)
      .expect(200);
    expect(
      after.body.plos.map((p: PloOrder) => [p.ploCode, p.sortOrder]),
    ).toEqual([
      ['PLO3', 1],
      ['PLO2', 2],
    ]);
  });

  it('stores a weight, refuses 1.5 and names the CLO links a cleared cell takes with it (US-046)', async () => {
    const { versionId } = await newProgram();
    const plo = await createPlo(admin, versionId, 'PLO1');
    const { course, item } = await mappedCourse(versionId);
    const syllabus = await createSyllabusDraft(admin, course.id);
    const clo = await createClo(admin, syllabus.id, 'CLO1');

    const stored = await setPloWeight(admin, item.id, plo.id, '0.5');
    expect(stored.weight).toBe('0.5');
    const refused = await putWeight(admin, item.id, plo.id, '1.5').expect(400);
    expect(refused.body.code).toBe('VALIDATION_FAILED');
    await putLinks(admin, item.id, [{ cloId: clo.id, ploId: plo.id }]).expect(
      200,
    );

    const matrix = await admin
      .get(`/api/program-versions/${versionId}/course-plo-matrix`)
      .expect(200);
    expect(matrix.body.rows[0].cells).toEqual([
      { ploId: plo.id, weight: '0.5', cloLinkCount: 1 },
    ]);
    expect(matrix.body).toMatchObject({ editPath: 'DIRECT', canEdit: true });

    await admin
      .delete(`/api/curriculum-items/${item.id}/plo-weights/${plo.id}`)
      .set(CSRF)
      .expect(204);
    expect(
      await prisma.cLOPLOMapping.count({
        where: { curriculumItemId: item.id },
      }),
    ).toBe(0);
    await admin
      .delete(`/api/curriculum-items/${item.id}/plo-weights/${plo.id}`)
      .set(CSRF)
      .expect(404);
  });

  it('shares a CLO between programs and keeps their links apart (KB-032, KB-033)', async () => {
    const a = await newProgram();
    const b = await newProgram();
    const ploA2 = await createPlo(admin, a.versionId, 'PLO2');
    const ploA3 = await createPlo(admin, a.versionId, 'PLO3');
    const ploB5 = await createPlo(admin, b.versionId, 'PLO5');
    const course = await newCourse();
    const itemA = await addCurriculumItem(admin, a.versionId, {
      courseId: course.id,
      plannedSemester: 1,
    });
    const itemB = await addCurriculumItem(admin, b.versionId, {
      courseId: course.id,
      plannedSemester: 3,
    });
    const syllabus = await createSyllabusDraft(admin, course.id);
    const clo = await createClo(admin, syllabus.id, 'CLO1');
    await admin
      .post(`/api/syllabi/${syllabus.id}/clos`)
      .set(CSRF)
      .send({ cloCode: 'clo1', description: 'Trùng' })
      .expect(409)
      .expect((res) => expect(res.body.code).toBe('CLO_CODE_TAKEN'));
    await setPloWeight(admin, itemA.id, ploA2.id, '0.5');
    await setPloWeight(admin, itemB.id, ploB5.id, '1');

    await putLinks(admin, itemA.id, [
      { cloId: clo.id, ploId: ploA2.id },
    ]).expect(200);
    await putLinks(admin, itemB.id, [
      { cloId: clo.id, ploId: ploB5.id },
    ]).expect(200);
    const refused = await putLinks(admin, itemA.id, [
      { cloId: clo.id, ploId: ploA3.id },
    ]).expect(409);
    expect(refused.body.code).toBe('PLO_NOT_MAPPED_TO_COURSE');

    const readA = await admin
      .get(`/api/curriculum-items/${itemA.id}/clo-plo-matrix`)
      .expect(200);
    const readB = await admin
      .get(`/api/curriculum-items/${itemB.id}/clo-plo-matrix`)
      .expect(200);
    expect(readA.body.clos).toEqual(readB.body.clos);
    expect(readA.body.links).toEqual([{ cloId: clo.id, ploId: ploA2.id }]);
    expect(readB.body.links).toEqual([{ cloId: clo.id, ploId: ploB5.id }]);
    expect(
      readA.body.plos.map((p: { ploCode: string; weight: string | null }) => [
        p.ploCode,
        p.weight,
      ]),
    ).toEqual([
      ['PLO2', '0.5'],
      ['PLO3', null],
    ]);

    const program = await admin
      .get(`/api/program-versions/${a.versionId}/clo-plo-matrix`)
      .expect(200);
    expect(program.body.rows[0]).toMatchObject({
      revisionNumber: 1,
      mappedPloIds: [ploA2.id],
    });

    // The delete dialog of the CLO names both programs.
    const shown = await admin
      .get(`/api/courses/${course.id}/syllabus`)
      .expect(200);
    expect(shown.body.draft.clos[0].linkedPrograms).toEqual(
      [a.program.programCode, b.program.programCode].sort(),
    );
    await admin.delete(`/api/clos/${clo.id}`).set(CSRF).expect(204);
    expect(await prisma.cLOPLOMapping.count({ where: { cloId: clo.id } })).toBe(
      0,
    );
  });

  it('lists gaps and never blocks a save; a group member sees only their courses (KB-034, US-047)', async () => {
    const { versionId } = await newProgram();
    const plo1 = await createPlo(admin, versionId, 'PLO1');
    await createPlo(admin, versionId, 'PLO6');
    const own = await mappedCourse(versionId, g1Id);
    const other = await mappedCourse(versionId, g2Id);
    const syllabus = await createSyllabusDraft(admin, own.course.id);
    await createClo(admin, syllabus.id, 'CLO1');

    const all = await admin
      .get(`/api/program-versions/${versionId}/outcome-coverage`)
      .expect(200);
    expect(all.body.plosWithoutCourse.map((p: PloOrder) => p.ploCode)).toEqual([
      'PLO1',
      'PLO6',
    ]);
    expect(all.body.coursesWithoutPlo).toHaveLength(2);
    expect(all.body.closWithoutPlo).toHaveLength(1);
    expect(all.body.coursesWithoutSyllabus).toBe(1);
    expect(all.body.filteredToGroups).toBe(false);

    await setPloWeight(admin, own.item.id, plo1.id, '0.3');
    const group = await coordinator
      .get(`/api/program-versions/${versionId}/outcome-coverage`)
      .expect(200);
    expect(group.body.filteredToGroups).toBe(true);
    expect(group.body.coursesWithoutPlo).toEqual([]);
    expect(group.body.plosWithoutCourse).toHaveLength(1);
    expect(
      all.body.coursesWithoutPlo.map((c: { itemId: string }) => c.itemId),
    ).toContain(other.item.id);
  });

  it('deletes a curriculum row with its cells and links, leaving the PLOs (EC)', async () => {
    const { versionId } = await newProgram();
    const plo = await createPlo(admin, versionId, 'PLO1');
    const { course, item } = await mappedCourse(versionId);
    const syllabus = await createSyllabusDraft(admin, course.id);
    const clo = await createClo(admin, syllabus.id, 'CLO1');
    await setPloWeight(admin, item.id, plo.id, '0.5');
    await putLinks(admin, item.id, [{ cloId: clo.id, ploId: plo.id }]).expect(
      200,
    );

    await admin
      .delete(`/api/curriculum-items/${item.id}`)
      .set(CSRF)
      .expect(204);

    expect(
      await prisma.coursePLOMapping.count({
        where: { curriculumItemId: item.id },
      }),
    ).toBe(0);
    expect(
      await prisma.cLOPLOMapping.count({
        where: { curriculumItemId: item.id },
      }),
    ).toBe(0);
    expect(await prisma.pLO.count({ where: { id: plo.id } })).toBe(1);
  });

  it('copies PLOs and both matrices on clone and shares the syllabus (KB-035)', async () => {
    const { program, versionId } = await newProgram();
    const plo = await createPlo(admin, versionId, 'PLO1');
    const { course, item } = await mappedCourse(versionId);
    const syllabus = await createSyllabusDraft(admin, course.id);
    const clo = await createClo(admin, syllabus.id, 'CLO1');
    await setPloWeight(admin, item.id, plo.id, '0.75');
    await putLinks(admin, item.id, [{ cloId: clo.id, ploId: plo.id }]).expect(
      200,
    );

    const cloned = await admin
      .post(`/api/programs/${program.id}/clone`)
      .set(CSRF)
      .send({ programCode: `${program.programCode}C`, programName: 'Bản sao' })
      .expect(201);
    const cloneVersion = cloned.body.draftVersion.id as string;

    const clonePlos = await admin
      .get(`/api/program-versions/${cloneVersion}/plos`)
      .expect(200);
    expect(clonePlos.body.plos).toHaveLength(1);
    expect(clonePlos.body.plos[0].id).not.toBe(plo.id);
    expect(clonePlos.body.plos[0]).toMatchObject({
      ploCode: 'PLO1',
      courseCount: 1,
      cloLinkCount: 1,
    });
    const cloneMatrix = await admin
      .get(`/api/program-versions/${cloneVersion}/course-plo-matrix`)
      .expect(200);
    expect(cloneMatrix.body.rows[0].cells[0]).toMatchObject({
      ploId: clonePlos.body.plos[0].id,
      weight: '0.75',
      cloLinkCount: 1,
    });
    const cloneItem = cloneMatrix.body.rows[0].itemId as string;
    const cloneLinks = await admin
      .get(`/api/curriculum-items/${cloneItem}/clo-plo-matrix`)
      .expect(200);
    expect(cloneLinks.body.links).toEqual([
      { cloId: clo.id, ploId: clonePlos.body.plos[0].id },
    ]);
    expect(
      await prisma.syllabus.count({ where: { courseId: course.id } }),
    ).toBe(1);

    await admin
      .patch(`/api/plos/${clonePlos.body.plos[0].id}`)
      .set(CSRF)
      .send({ description: 'Chỉ bản sao' })
      .expect(200);
    const source = await admin
      .get(`/api/program-versions/${versionId}/plos`)
      .expect(200);
    expect(source.body.plos[0].description).toBe('Mô tả PLO1');
  });

  it('routes outcome edits of a released program through a request', async () => {
    const { program } = await newProgram();
    await prisma.programVersion.update({
      where: { id: program.versions[0].id },
      data: {
        status: ProgramVersionStatus.ACTIVE,
        versionNumber: '1.0',
        publishedAt: new Date(),
      },
    });
    const draft = await prisma.programVersion.create({
      data: {
        programId: program.id,
        programName: 'Bản nháp',
        majorCode: 'M01',
        majorName: 'Ngành',
        semesterCount: 8,
        totalCredits: '120',
        compulsoryCredits: '110',
        electiveCredits: '10',
        status: ProgramVersionStatus.DRAFT,
      },
    });
    const course = await newCourse();
    const item = await prisma.curriculumItem.create({
      data: {
        versionId: draft.id,
        courseId: course.id,
        plannedSemester: 1,
        sortOrder: 1,
        isElective: false,
      },
    });
    const plo = await prisma.pLO.create({
      data: {
        versionId: draft.id,
        ploCode: 'PLO1',
        description: 'x',
        sortOrder: 1,
      },
    });

    const refused = await putWeight(admin, item.id, plo.id, '0.5').expect(409);
    expect(refused.body.code).toBe('CHANGE_REQUEST_REQUIRED');
    const listed = await admin
      .get(`/api/program-versions/${draft.id}/plos`)
      .expect(200);
    expect(listed.body).toMatchObject({
      editPath: 'VIA_REQUEST',
      canEdit: false,
    });
  });

  // F-20 BE-06: a student reads their own applied version's PLOs through the portal, never this staff-addressed list.
  it('refuses a student the staff PLO list and every matrix (F11-05, F-20 BE-06)', async () => {
    const { versionId } = await newProgram();
    await createPlo(admin, versionId, 'PLO1');

    for (const path of [
      'plos',
      'course-plo-matrix',
      'clo-plo-matrix',
      'outcome-coverage',
    ]) {
      const refused = await student
        .get(`/api/program-versions/${versionId}/${path}`)
        .expect(403);
      // R6 holds outcome.view scoped to nothing, so the refusal may say out of scope rather than not granted.
      expect(['OUT_OF_SCOPE', 'PERMISSION_DENIED']).toContain(
        refused.body.code,
      );
    }
    const read = await viewer
      .get(`/api/program-versions/${versionId}/course-plo-matrix`)
      .expect(200);
    expect(read.body).toMatchObject({ editPath: null, canEdit: false });
    await viewer
      .post(`/api/program-versions/${versionId}/plos`)
      .set(CSRF)
      .send({ ploCode: 'X', description: 'x' })
      .expect(403);
  });

  it('enforces the weight range and the course cell in the database', async () => {
    const { versionId } = await newProgram();
    const plo = await createPlo(admin, versionId, 'PLO1');
    const { item } = await mappedCourse(versionId);

    for (const weight of ['0', '1.01']) {
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO "CoursePLOMapping" ("id", "curriculumItemId", "ploId", "weight", "updatedAt") VALUES ('w${weight}', $1, $2, ${weight}, now())`,
          item.id,
          plo.id,
        ),
      ).rejects.toThrow(/CoursePLOMapping_weight_range|check constraint/i);
    }
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "CLOPLOMapping" ("id", "curriculumItemId", "ploId", "cloId") VALUES ('orphan', $1, $2, 'none')`,
        item.id,
        plo.id,
      ),
    ).rejects.toThrow(/foreign key|violates/i);
  });
});

interface PloOrder {
  ploCode: string;
  sortOrder: number;
}
