import type { NestExpressApplication } from '@nestjs/platform-express';
import type request from 'supertest';
import type { AcademicResultStatus } from '../../src/generated/prisma/client.js';
import type { RegistrationEligibilityDto } from '../../src/features/registration-eligibility/dto/registration-eligibility.dto.js';
import { PrismaService } from '../../src/shared/prisma/prisma.service.js';
import { writeAcademicResultSource } from '../../src/shared/students/academic-result.writer.js';
import type { StudentAppliedVersionLookup } from '../../src/shared/students/student-applied-version.types.js';
import { createCourse } from './courses.js';
import { addCurriculumItem } from './curriculum.js';
import { createProgram } from './programs.js';
import { createCohort, createSemester, releaseViaApi } from './releases.js';
import {
  createSyntheticStudentFixture,
  type StudentWorld,
} from './students.js';

type Agent = ReturnType<typeof request.agent>;
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };
export interface EligibilityFixture extends StudentAppliedVersionLookup {
  world: StudentWorld;
  studentUserId: string;
  versionId: string;
  itemIds: ReadonlyMap<string, string>;
  courseIds: ReadonlyMap<string, string>;
}
export async function createEligibilityFixture(
  app: NestExpressApplication,
  office: Agent,
  suffix: string,
  count = 4,
): Promise<EligibilityFixture> {
  const program = await createProgram(app, {
    programCode: `SYN-ELIG-${suffix}`,
  });
  const versionId = program.versions[0].id;
  const courseIds = new Map<string, string>();
  const itemIds = new Map<string, string>();
  for (let index = 0; index < count; index++) {
    const key = String(index);
    const course = await createCourse(app, {
      courseCode: `SYN-ELIG-${suffix}-${index}`,
    });
    const item = await addCurriculumItem(office, versionId, {
      courseId: course.id,
      plannedSemester: 1 + Math.floor(index / 10),
    });
    courseIds.set(key, course.id);
    itemIds.set(key, item.id);
  }
  for (let index = 4; index < count; index++) {
    const relationType = (['PRIOR', 'PREREQUISITE', 'COREQUISITE'] as const)[
      index % 3
    ];
    await office
      .put(`/api/curriculum-items/${itemIds.get(String(index))}/requisites`)
      .set(CSRF)
      .send({
        requisites: [
          {
            sourceCourseId: courseIds.get(String(index - 1)),
            relationType,
            ...(relationType === 'PREREQUISITE' ? { minScore: '2.5' } : {}),
          },
        ],
      })
      .expect(200);
  }
  await office
    .put(`/api/curriculum-items/${itemIds.get('0')}/requisites`)
    .set(CSRF)
    .send({
      requisites: [
        {
          sourceCourseId: courseIds.get('1'),
          relationType: 'PREREQUISITE',
          minScore: '2.5',
        },
        { sourceCourseId: courseIds.get('2'), relationType: 'COREQUISITE' },
      ],
    })
    .expect(200);
  await office
    .put(`/api/curriculum-items/${itemIds.get('2')}/requisites`)
    .set(CSRF)
    .send({
      requisites: [
        { sourceCourseId: courseIds.get('3'), relationType: 'PRIOR' },
      ],
    })
    .expect(200);
  const semester = await createSemester(app, -400, 'ELIG');
  const cohort = await createCohort(app, `SYN-ELIG-K-${suffix}`);
  await releaseViaApi(app, office, {
    programId: program.id,
    versionId,
    semesterId: semester.id,
    cohortIds: [cohort.id],
  });
  const world: StudentWorld = {
    programId: program.id,
    programCode: program.programCode,
    versionId,
    courseId: courseIds.get('0')!,
    courseCode: `SYN-ELIG-${suffix}-0`,
    cohortId: cohort.id,
    cohortCode: cohort.cohortCode,
    admissionSemesterId: semester.id,
    admissionSemesterCode: semester.semesterCode,
    laterSemesterId: semester.id,
    laterSemesterCode: semester.semesterCode,
  };
  const student = await createSyntheticStudentFixture(
    app,
    `ELIG${suffix}`,
    world,
  );
  return {
    world,
    studentId: student.studentId,
    studentUserId: student.userId,
    programId: program.id,
    versionId,
    semesterId: semester.id,
    courseIds,
    itemIds,
  };
}
export async function getEligibility(
  agent: Agent,
  lookup: StudentAppliedVersionLookup,
): Promise<RegistrationEligibilityDto> {
  const response = await agent
    .get(`/api/students/${lookup.studentId}/registration-eligibility`)
    .query({ programId: lookup.programId, semesterId: lookup.semesterId })
    .expect(200);
  expect(response.headers['cache-control']).toBe('no-store, private');
  return response.body as RegistrationEligibilityDto;
}
export async function setEligibilityResult(
  app: NestExpressApplication,
  fixture: EligibilityFixture,
  key: string,
  status: AcademicResultStatus,
  score4: string | null,
  actorId: string,
) {
  const prisma = app.get(PrismaService);
  return prisma.$transaction(async (tx) => {
    const courseId = fixture.courseIds.get(key)!;
    const stored = await tx.academicResult.findFirst({
      where: {
        studentId: fixture.studentId,
        courseId,
        semesterId: fixture.semesterId,
      },
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
              studentId: fixture.studentId,
              courseId,
              semesterId: fixture.semesterId,
              status,
              score4,
              score10: null,
              letterGrade: null,
            },
          },
        ],
      },
      { source: 'EXCEL', actorId },
    );
  });
}
