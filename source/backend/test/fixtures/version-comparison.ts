import type { NestExpressApplication } from '@nestjs/platform-express';
import type request from 'supertest';
import { PrismaService } from '../../src/shared/prisma/prisma.service.js';
import { createAccount, loginAgent } from './accounts.js';
import { openRequest, submitRequest } from './change-requests.js';
import { createCourse } from './courses.js';
import { addCurriculumItem } from './curriculum.js';
import { createClo, createPlo, putLinks, setPloWeight } from './outcomes.js';
import { createProgram } from './programs.js';
import {
  createCohort,
  createSemester,
  isoDay,
  makeSyllabusReady,
  releaseViaApi,
} from './releases.js';

type Agent = ReturnType<typeof request.agent>;
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };
let counter = 0;

export function expectFixtureStatus(expectedStatus: number) {
  return (response: request.Response): void => {
    if (response.status !== expectedStatus) {
      throw new Error(
        `Expected HTTP ${expectedStatus}, received ${response.status}: ${JSON.stringify(response.body)}; response text: ${response.text}`,
      );
    }
  };
}

export interface ComparedVersionFixture {
  programId: string;
  beforeVersionId: string;
  intermediateVersionId: string;
  afterVersionId: string;
  courseId: string;
  beforeSyllabusId: string;
  afterSyllabusId: string;
  firstSemesterId: string;
  middleSemesterId: string;
  lastSemesterId: string;
  preservedCohortId: string;
  unselectedCohortId: string;
}

export async function releasedComparisonFixture(
  app: NestExpressApplication,
  admin: Agent,
  programCode?: string,
): Promise<ComparedVersionFixture> {
  counter += 1;
  const prefix = `CMP${counter}`;
  const prisma = app.get(PrismaService);
  const approver = await loginAgent(
    app,
    await createAccount(app, `cmpoffice${counter}`, 'R1'),
  );
  const course = await createCourse(app, { courseCode: `${prefix}C1` });
  const prerequisite = await createCourse(app, { courseCode: `${prefix}C0` });
  const program = await createProgram(app, {
    programCode: programCode ?? `${prefix}P`,
  });
  const beforeVersionId = program.versions[0].id;
  const preservedCohort = await createCohort(app, `${prefix}-PRESERVED`);
  const unselectedCohort = await createCohort(app, `${prefix}-UNSELECTED`);
  await addCurriculumItem(admin, beforeVersionId, {
    courseId: prerequisite.id,
    plannedSemester: 1,
  });
  const item = await addCurriculumItem(admin, beforeVersionId, {
    courseId: course.id,
    plannedSemester: 2,
    isElective: true,
  });
  const group = await prisma.electiveGroup.create({
    data: {
      versionId: beforeVersionId,
      groupCode: 'G1',
      groupName: 'Nhóm gốc',
      minCredits: '3',
      minCourses: 1,
    },
  });
  await prisma.curriculumItem.update({
    where: { id: item.id },
    data: { electiveGroupId: group.id },
  });
  await admin
    .put(`/api/curriculum-items/${item.id}/requisites`)
    .set(CSRF)
    .send({
      requisites: [
        {
          sourceCourseId: prerequisite.id,
          relationType: 'PREREQUISITE',
          minScore: '4',
        },
      ],
    })
    .expect(expectFixtureStatus(200));
  const beforeSyllabusId = (await makeSyllabusReady(admin, course.id))!;
  const clo = await createClo(admin, beforeSyllabusId, 'CLO1');
  await prisma.weeklyContent.create({
    data: {
      syllabusId: beforeSyllabusId,
      weekLabel: '1',
      sortOrder: 1,
      content: '<p>Tuần gốc</p>',
    },
  });
  const plo = await createPlo(admin, beforeVersionId, 'PLO1');
  await setPloWeight(admin, item.id, plo.id, '0.25');
  await putLinks(admin, item.id, [{ cloId: clo.id, ploId: plo.id }]).expect(
    expectFixtureStatus(200),
  );
  const firstSemester = await createSemester(app, -400, 'Z-CMP');
  const middleSemester = await createSemester(app, -200, 'M-CMP');
  const lastSemester = await createSemester(app, 90, 'A-CMP');
  await releaseViaApi(app, admin, {
    programId: program.id,
    versionId: beforeVersionId,
    semesterId: firstSemester.id,
    cohortIds: [preservedCohort.id],
  });

  const structure = await openRequest(admin, {
    requestType: 'CURRICULUM',
    targetType: 'PROGRAM',
    targetId: program.id,
  });
  const copyId = structure.workspace!.copyId;
  const copied = await prisma.curriculumItem.findFirstOrThrow({
    where: { versionId: copyId, courseId: course.id },
  });
  await admin
    .patch(`/api/program-versions/${copyId}/info`)
    .set(CSRF)
    .send({ programName: 'Chương trình đã cập nhật' })
    .expect(expectFixtureStatus(200));
  await admin
    .patch(`/api/curriculum-items/${copied.id}`)
    .set(CSRF)
    .send({ plannedSemester: 3, note: 'Ghi chú mới' })
    .expect(expectFixtureStatus(200));
  await prisma.electiveGroup.updateMany({
    where: { versionId: copyId },
    data: { groupName: 'Nhóm mới' },
  });
  const copiedPlo = await prisma.pLO.findFirstOrThrow({
    where: { versionId: copyId, ploCode: 'PLO1' },
  });
  await prisma.pLO.update({
    where: { id: copiedPlo.id },
    data: { description: 'Chuẩn đầu ra mới' },
  });
  await setPloWeight(admin, copied.id, copiedPlo.id, '0.50');
  await putLinks(admin, copied.id, []).expect(expectFixtureStatus(200));
  await admin
    .put(`/api/curriculum-items/${copied.id}/requisites`)
    .set(CSRF)
    .send({
      requisites: [
        {
          sourceCourseId: prerequisite.id,
          relationType: 'PREREQUISITE',
          minScore: '3',
        },
      ],
    })
    .expect(expectFixtureStatus(200));
  await submitRequest(admin, structure.id).expect(expectFixtureStatus(200));
  const structureRelease = await approver
    .post(`/api/change-requests/${structure.id}/final-approve`)
    .set(CSRF)
    .send({
      decisionNumber: 'QD-CMP-2',
      signedDate: isoDay(-1),
      effectiveSemesterId: middleSemester.id,
      allowPastSemester: true,
      cohortIds: [],
    })
    .expect(expectFixtureStatus(200));
  const intermediateVersionId = (
    structureRelease.body.release.versions as {
      id: string;
      programId: string;
    }[]
  ).find((version) => version.programId === program.id)!.id;

  const syllabus = await openRequest(admin, {
    requestType: 'SYLLABUS_CONTENT',
    targetType: 'COURSE',
    targetId: course.id,
  });
  const afterSyllabusId = syllabus.workspace!.copyId;
  await admin
    .patch(`/api/syllabi/${afterSyllabusId}`)
    .set(CSRF)
    .send({ objectives: '<p>Mục tiêu của bản mới</p>' })
    .expect(expectFixtureStatus(200));
  await prisma.weeklyContent.updateMany({
    where: { syllabusId: afterSyllabusId },
    data: { content: '<p>Tuần mới</p>' },
  });
  await prisma.cLO.updateMany({
    where: { syllabusId: afterSyllabusId },
    data: { description: 'CLO mới' },
  });
  await submitRequest(admin, syllabus.id).expect(expectFixtureStatus(200));
  const syllabusRelease = await approver
    .post(`/api/change-requests/${syllabus.id}/final-approve`)
    .set(CSRF)
    .send({
      decisionNumber: 'QD-CMP-3',
      signedDate: isoDay(-1),
      effectiveSemesterId: lastSemester.id,
    })
    .expect(expectFixtureStatus(200));
  const afterVersionId = (
    syllabusRelease.body.release.versions as { id: string; programId: string }[]
  ).find((version) => version.programId === program.id)!.id;
  return {
    programId: program.id,
    beforeVersionId,
    intermediateVersionId,
    afterVersionId,
    courseId: course.id,
    beforeSyllabusId,
    afterSyllabusId,
    firstSemesterId: firstSemester.id,
    middleSemesterId: middleSemester.id,
    lastSemesterId: lastSemester.id,
    preservedCohortId: preservedCohort.id,
    unselectedCohortId: unselectedCohort.id,
  };
}
