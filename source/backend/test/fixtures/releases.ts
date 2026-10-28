import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { ProgramStatus } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/shared/prisma/prisma.service.js';
import { toIsoDay, todayDate } from '../../src/shared/time/today.js';
import { makeAssessmentReady } from './assessments.js';
import { addCurriculumItem } from './curriculum.js';
import { createProgram } from './programs.js';

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };
const DAY_MS = 86_400_000;

type Agent = ReturnType<typeof request.agent>;

// The calendar day `offset` days from today, as the date-only string the API takes.
export function isoDay(offset: number): string {
  return toIsoDay(new Date(todayDate().getTime() + offset * DAY_MS));
}

let semesterCounter = 0;

// A semester whose start is `startOffsetDays` from today (negative = already begun). One per call: the unique
// (academicYear, termInYear) keeps two specs of one file from sharing a row they then edit.
export async function createSemester(
  app: NestExpressApplication,
  startOffsetDays: number | null,
  label = 'T',
) {
  semesterCounter += 1;
  const n = semesterCounter;
  return app.get(PrismaService).semester.create({
    data: {
      semesterCode: `${label}${n}-${Date.now()}`,
      academicYear: `${3000 + n}-${3001 + n}`,
      termInYear: 1,
      startDate:
        startOffsetDays === null
          ? null
          : new Date(todayDate().getTime() + startOffsetDays * DAY_MS),
    },
  });
}

const pastSemesters = new WeakMap<object, Promise<string>>();

// The semester every fixture release uses: it began long ago, so the version is Active at once.
export function pastSemesterId(app: NestExpressApplication): Promise<string> {
  let held = pastSemesters.get(app);
  if (!held) {
    held = createSemester(app, -400, 'PAST').then((row) => row.id);
    pastSemesters.set(app, held);
  }
  return held;
}

export async function createCohort(app: NestExpressApplication, code: string) {
  return app.get(PrismaService).cohort.create({
    data: { cohortCode: code, intakeYear: 2026 },
  });
}

export const READY_SYLLABUS = {
  courseDescription: '<p>Mô tả học phần đủ để ban hành.</p>',
  objectives: '<p>Mục tiêu học phần.</p>',
};

// Leaves the course with a syllabus that DC-03 lets through: a missing one is created, a Draft is completed,
// a published one is left alone; the Draft also gets a grade formula that covers every CLO. Returns the Draft id, or null when the revision is already published.
export async function makeSyllabusReady(
  agent: Agent,
  courseId: string,
  content: Partial<typeof READY_SYLLABUS> = {},
): Promise<string | null> {
  let state = (await agent.get(`/api/courses/${courseId}/syllabus`).expect(200))
    .body;
  if (!state.published && !state.draft) {
    state = (
      await agent
        .post(`/api/courses/${courseId}/syllabus`)
        .set(CSRF)
        .expect(201)
    ).body;
  }
  if (!state.draft) return null;
  await agent
    .patch(`/api/syllabi/${state.draft.id}`)
    .set(CSRF)
    .send({ ...READY_SYLLABUS, ...content })
    .expect(200);
  await makeAssessmentReady(agent, courseId, state.draft.id as string);
  return state.draft.id as string;
}

export interface ReleaseInput {
  programId: string;
  versionId: string;
  semesterId?: string;
  cohortIds?: string[];
  versionNumber?: string;
  decisionNumber?: string;
  signedDate?: string;
  // Fixture releases complete the syllabi of the frame first; negative tests turn this off.
  prepareSyllabi?: boolean;
}

export function postRelease(
  app: NestExpressApplication,
  agent: Agent,
  input: ReleaseInput & { semesterId: string },
) {
  return agent
    .post(
      `/api/programs/${input.programId}/versions/${input.versionId}/release`,
    )
    .set(CSRF)
    .send({
      versionNumber: input.versionNumber,
      decisionNumber: input.decisionNumber ?? 'QD-TEST',
      signedDate: input.signedDate ?? isoDay(-1),
      effectiveSemesterId: input.semesterId,
      cohortIds: input.cohortIds ?? [],
    });
}

// The real release (MH-45), as R1: replaces the old test-only write of ACTIVE / 1.0.
export async function releaseViaApi(
  app: NestExpressApplication,
  admin: Agent,
  input: ReleaseInput,
) {
  if (input.prepareSyllabi !== false) {
    const items = await app.get(PrismaService).curriculumItem.findMany({
      where: { versionId: input.versionId },
      select: { courseId: true },
    });
    for (const item of items) await makeSyllabusReady(admin, item.courseId);
  }
  const semesterId = input.semesterId ?? (await pastSemesterId(app));
  const response = await postRelease(app, admin, {
    ...input,
    semesterId,
  }).expect(201);
  return response.body as ReleasedVersion;
}

export interface ReleasedVersion {
  id: string;
  versionNumber: string | null;
  status: string;
  decisionNumber: string | null;
  signedDate: string | null;
  effectiveSemester: { id: string; semesterCode: string } | null;
  cohorts: { id: string; cohortCode: string }[];
  originRequest: { id: string; requestCode: string } | null;
  correctedBy: { id: string; versionNumber: string | null } | null;
  correctionOf: { id: string; versionNumber: string | null } | null;
  previousVersion: { id: string; versionNumber: string | null } | null;
  correctionReason: string | null;
  isCorrectionDraft: boolean;
  canCorrect: boolean;
  openCorrection: { id: string } | null;
  rows: {
    itemId: string;
    courseId: string;
    courseCode: string;
    courseName: string;
    credits: string;
    syllabus: { id: string; revisionNumber: number; status: string } | null;
  }[];
}

let carrierCounter = 0;

// A syllabus is published only by a program release (DC-03): this releases a one-course program, as R1, and so
// publishes the course's syllabus. `deactivate` then switches the program off, so nothing counts it as "using"
// the course (routing, fan-out and usage lists skip inactive programs).
export async function publishSyllabusViaRelease(
  app: NestExpressApplication,
  admin: Agent,
  courseId: string,
  options: {
    content?: Partial<typeof READY_SYLLABUS>;
    deactivate?: boolean;
  } = {},
) {
  carrierCounter += 1;
  await makeSyllabusReady(admin, courseId, options.content);
  const program = await createProgram(app, {
    programCode: `PUBLISH${carrierCounter}-${Date.now()}`,
  });
  const versionId = program.versions[0].id;
  await addCurriculumItem(admin, versionId, { courseId, plannedSemester: 1 });
  await releaseViaApi(app, admin, {
    programId: program.id,
    versionId,
    prepareSyllabi: false,
  });
  if (options.deactivate) {
    await app.get(PrismaService).program.update({
      where: { id: program.id },
      data: { status: ProgramStatus.INACTIVE },
    });
  }
  return { programId: program.id, versionId };
}
