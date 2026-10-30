import type { NestExpressApplication } from '@nestjs/platform-express';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { GraduationProcessor } from '../../src/features/graduation/graduation.processor.js';
import request from 'supertest';
import { seedAccessControl } from '../../prisma/seed-data/seed-access-control.js';
import type { AcademicResultStatus } from '../../src/generated/prisma/client.js';
import { GRADUATION_QUEUE } from '../../src/shared/graduation/graduation.constants.js';
import type {
  GraduationLookup,
  GraduationResult,
} from '../../src/shared/graduation/graduation.types.js';
import { PrismaService } from '../../src/shared/prisma/prisma.service.js';
import { writeAcademicResultSource } from '../../src/shared/students/academic-result.writer.js';
import {
  startPostgres,
  startRedis,
  type TestPostgres,
  type TestRedis,
} from '../containers.js';
import { createTestApp } from '../test-app.js';
import { setAppEnv } from '../test-env.js';
import { createAccount, loginAgent, type TestAccount } from './accounts.js';
import { createCourse } from './courses.js';
import { addCurriculumItem } from './curriculum.js';
import { createProgram } from './programs.js';
import { createCohort, createSemester, releaseViaApi } from './releases.js';
import {
  createSyntheticStudentFixture,
  type StudentWorld,
} from './students.js';

export type GraduationAgent = ReturnType<typeof request.agent>;
export const GRADUATION_CSRF = { 'X-Requested-With': 'XMLHttpRequest' };
export const GRADUATION_TEST_JOBS = {
  RUN_BATCH: 'run-batch',
  SCAN_CHANGES: 'scan-result-changes',
  RUN_REAUDIT: 'run-reaudit',
  RECOVER: 'recover-graduation',
} as const;
export interface GraduationFixture extends GraduationLookup {
  studentUserId: string;
  secondStudentId: string;
  enrollmentId: string;
  priorSemesterId: string;
  versionId: string;
  cohortId: string;
  groupId: string;
  world: StudentWorld;
  courseIds: {
    mandatory: string;
    conditional: string;
    electiveA: string;
    electiveB: string;
  };
  itemIds: {
    mandatory: string;
    conditional: string;
    electiveA: string;
    electiveB: string;
  };
}
export interface GraduationAuditResponse {
  id: string;
  contextId: string;
  enrollmentId: string;
  programVersionId: string;
  auditedAt: string;
  auditedBy: { id: string; fullName: string } | null;
  trigger: 'STAFF' | 'BATCH' | 'RESULT_CHANGE';
  supersedesId: string | null;
  inputDigest: string;
  result: GraduationResult;
  freshness: 'CURRENT' | 'RECHECK_PENDING' | 'RECHECK_FAILED';
}
export interface GraduationHarness {
  app: NestExpressApplication;
  prisma: PrismaService;
  queue: Queue;
  office: GraduationAgent;
  account: TestAccount;
}
export function graduationHarness(): GraduationHarness {
  let postgres: TestPostgres;
  let redis: TestRedis;
  const harness = {} as GraduationHarness;
  beforeAll(async () => {
    [postgres, redis] = await Promise.all([
      startPostgres({ vietnameseCollation: true }),
      startRedis(),
    ]);
    setAppEnv(postgres, redis);
    harness.app = await createTestApp();
    harness.prisma = harness.app.get(PrismaService);
    harness.queue = harness.app.get<Queue>(getQueueToken(GRADUATION_QUEUE));
    await seedAccessControl(harness.prisma);
    harness.account = await createAccount(
      harness.app,
      'graduationoffice',
      'R1',
    );
    harness.office = await loginAgent(harness.app, harness.account);
  });
  afterAll(async () => {
    await harness.app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
  });
  return harness;
}

let sequence = 0;
export async function seedGraduationFixture(
  app: NestExpressApplication,
  office: GraduationAgent,
  options: {
    minCredits?: string | null;
    minCourses?: number | null;
    mandatoryCredits?: string;
  } = {},
): Promise<GraduationFixture> {
  sequence += 1;
  const suffix = `G${sequence}`;
  const prisma = app.get(PrismaService);
  const program = await createProgram(app, { programCode: `SYN-${suffix}` });
  const versionId = program.versions[0].id;
  await prisma.programVersion.update({
    where: { id: versionId },
    data: {
      totalCredits: '9',
      compulsoryCredits: '3',
      electiveCredits: '6',
    },
  });
  const mandatory = await createCourse(app, {
    courseCode: `SYN-${suffix}-M`,
    credits: options.mandatoryCredits ?? '3',
  });
  const conditional = await createCourse(app, {
    courseCode: `SYN-${suffix}-C`,
    credits: '0',
    courseType: 'CONDITIONAL',
  });
  const electiveA = await createCourse(app, { courseCode: `SYN-${suffix}-E1` });
  const electiveB = await createCourse(app, { courseCode: `SYN-${suffix}-E2` });
  const courseIds = {
    mandatory: mandatory.id,
    conditional: conditional.id,
    electiveA: electiveA.id,
    electiveB: electiveB.id,
  };
  const itemIds = {} as GraduationFixture['itemIds'];
  for (const key of Object.keys(courseIds) as (keyof typeof courseIds)[]) {
    const item = await addCurriculumItem(office, versionId, {
      courseId: courseIds[key],
      plannedSemester: 1,
      isElective: key.startsWith('elective'),
    });
    itemIds[key] = item.id;
  }
  const group = await office
    .post(`/api/program-versions/${versionId}/elective-groups`)
    .set(GRADUATION_CSRF)
    .send({
      groupCode: 'TC',
      groupName: 'Nhóm tự chọn',
      minCredits: options.minCredits === undefined ? '6' : options.minCredits,
      minCourses: options.minCourses === undefined ? 2 : options.minCourses,
    })
    .expect(201);
  await office
    .put(`/api/elective-groups/${group.body.id}/items`)
    .set(GRADUATION_CSRF)
    .send({ itemIds: [itemIds.electiveA, itemIds.electiveB] })
    .expect(200);
  const prior = await createSemester(app, -600, 'GP');
  const semester = await createSemester(app, -400, 'GA');
  const cohort = await createCohort(app, `SYN-${suffix}-K`);
  await releaseViaApi(app, office, {
    programId: program.id,
    versionId,
    semesterId: prior.id,
    cohortIds: [cohort.id],
  });
  const world: StudentWorld = {
    programId: program.id,
    programCode: program.programCode,
    versionId,
    courseId: mandatory.id,
    courseCode: mandatory.courseCode,
    cohortId: cohort.id,
    cohortCode: cohort.cohortCode,
    admissionSemesterId: prior.id,
    admissionSemesterCode: prior.semesterCode,
    laterSemesterId: semester.id,
    laterSemesterCode: semester.semesterCode,
  };
  const first = await createSyntheticStudentFixture(app, `${suffix}A`, world);
  const second = await createSyntheticStudentFixture(app, `${suffix}B`, world);
  return {
    studentId: first.studentId,
    studentUserId: first.userId,
    secondStudentId: second.studentId,
    enrollmentId: first.primaryEnrollmentId,
    programId: program.id,
    semesterId: semester.id,
    priorSemesterId: prior.id,
    versionId,
    cohortId: cohort.id,
    groupId: String(group.body.id),
    world,
    courseIds,
    itemIds,
  };
}
export function graduationQuery(fixture: GraduationLookup) {
  return { programId: fixture.programId, semesterId: fixture.semesterId };
}
export function graduationFilters(fixture: GraduationFixture) {
  return { ...graduationQuery(fixture), cohortId: fixture.cohortId };
}
export async function liveGraduation(
  agent: GraduationAgent,
  fixture: GraduationLookup,
): Promise<request.Response> {
  const response = await agent
    .get(`/api/students/${fixture.studentId}/graduation`)
    .query(graduationQuery(fixture))
    .expect(200);
  expect(response.headers['cache-control']).toBe('no-store, private');
  return response;
}
export async function saveGraduation(
  agent: GraduationAgent,
  fixture: GraduationLookup,
  requestKey: string,
) {
  const response = await agent
    .post(`/api/students/${fixture.studentId}/graduation-audits`)
    .set(GRADUATION_CSRF)
    .send({ ...graduationQuery(fixture), requestKey })
    .expect(201);
  return response.body as GraduationAuditResponse;
}
export async function setGraduationResult(
  harness: GraduationHarness,
  fixture: GraduationFixture,
  courseId: string,
  status: AcademicResultStatus,
  options: {
    studentId?: string;
    semesterId?: string;
    score4?: string | null;
  } = {},
) {
  const studentId = options.studentId ?? fixture.studentId;
  const semesterId = options.semesterId ?? fixture.priorSemesterId;
  return harness.prisma.$transaction(async (tx) => {
    const stored = await tx.academicResult.findFirst({
      where: { studentId, courseId, semesterId },
    });
    return writeAcademicResultSource(
      tx,
      {
        rows: [
          {
            rowNumber: 2,
            action: stored ? 'UPDATE' : 'CREATE',
            existingId: stored?.id ?? null,
            expectedRevision: stored?.revision ?? null,
            value: {
              studentId,
              courseId,
              semesterId,
              status,
              score4:
                options.score4 === undefined
                  ? status === 'PASSED'
                    ? '3'
                    : status === 'FAILED'
                      ? '1'
                      : null
                  : options.score4,
              score10:
                status === 'PASSED' ? '8' : status === 'FAILED' ? '2' : null,
              letterGrade:
                status === 'PASSED' ? 'B' : status === 'FAILED' ? 'F' : null,
            },
          },
        ],
      },
      { source: 'EXCEL', actorId: harness.account.id },
    );
  });
}
export async function completeGraduation(
  harness: GraduationHarness,
  fixture: GraduationFixture,
) {
  for (const courseId of Object.values(fixture.courseIds)) {
    await setGraduationResult(harness, fixture, courseId, 'PASSED');
  }
}
export async function waitForGraduationValue<Value>(
  read: () => Promise<Value>,
  done: (value: Value) => boolean,
  timeoutMs = 30_000,
): Promise<Value> {
  const deadline = Date.now() + timeoutMs;
  let value = await read();
  while (!done(value)) {
    if (Date.now() >= deadline)
      throw new Error(`Graduation wait timed out: ${JSON.stringify(value)}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    value = await read();
  }
  return value;
}
export async function waitForGraduationTask(
  prisma: PrismaService,
  taskId: string,
) {
  const task = await waitForGraduationValue(
    () =>
      prisma.graduationReauditTask.findUniqueOrThrow({ where: { id: taskId } }),
    (row) => ['COMPLETED', 'COVERED', 'FAILED'].includes(row.status),
  );
  return task;
}
export async function graduationWriteCounts(prisma: PrismaService) {
  return Promise.all([
    prisma.graduationAuditContext.count(),
    prisma.graduationAudit.count(),
    prisma.graduationBatch.count(),
    prisma.graduationBatchItem.count(),
    prisma.graduationResultChangeReceipt.count(),
    prisma.graduationReauditTask.count(),
    prisma.notification.count(),
  ]);
}

export async function confirmGraduationBatch(
  harness: GraduationHarness,
  fixture: GraduationFixture,
  requestKey: string,
) {
  const filters = graduationFilters(fixture);
  const preview = await harness.office
    .post('/api/graduation-batches/preview')
    .set(GRADUATION_CSRF)
    .send(filters)
    .expect(200);
  const created = await harness.office
    .post('/api/graduation-batches')
    .set(GRADUATION_CSRF)
    .send({
      ...filters,
      previewRevision: preview.body.previewRevision,
      requestKey,
    })
    .expect(201);
  return {
    id: String(created.body.id),
    preview: preview.body,
    created: created.body,
  };
}

export async function waitForGraduationBatch(
  harness: GraduationHarness,
  batchId: string,
  timeoutMs = 30_000,
) {
  const response = await waitForGraduationValue(
    () => harness.office.get(`/api/graduation-batches/${batchId}`).expect(200),
    (value) =>
      ['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED'].includes(
        value.body.status,
      ),
    timeoutMs,
  );
  return response.body;
}

export async function pauseGraduation(harness: GraduationHarness) {
  await harness.queue.pause();
  await harness.app.get(GraduationProcessor).worker.pause();
}

export async function resumeGraduation(harness: GraduationHarness) {
  harness.app.get(GraduationProcessor).worker.resume();
  await harness.queue.resume();
}
