import type { NestExpressApplication } from '@nestjs/platform-express';
import ExcelJS from 'exceljs';
import type request from 'supertest';
import {
  ACADEMIC_RESULT_SHEET,
  type ResultColumn,
} from '../../src/features/imports/sheets/academic-result.sheet.js';
import { writeSheet } from '../../src/features/imports/sheets/sheet-writer.js';
import {
  STUDENT_LIST_SHEET,
  type StudentColumn,
} from '../../src/features/imports/sheets/student-list.sheet.js';
import { PrismaService } from '../../src/shared/prisma/prisma.service.js';
import { createAccount } from './accounts.js';
import { createCourse } from './courses.js';
import { addCurriculumItem } from './curriculum.js';
import { createProgram } from './programs.js';
import { createCohort, createSemester, releaseViaApi } from './releases.js';

type Agent = ReturnType<typeof request.agent>;

export const STUDENT_E2E = {
  // Past semesters whose start is far enough back for every "future" boundary to stay in the future.
  ADMISSION_OFFSET_DAYS: -400,
  LATER_OFFSET_DAYS: -200,
  PERFORMANCE_ROWS: 1000,
} as const;

export type SyntheticStudentRow = Partial<Record<StudentColumn, string>>;
export type SyntheticResultRow = Partial<Record<ResultColumn, string>>;

export function studentWorkbook(
  rows: readonly SyntheticStudentRow[],
): Promise<Uint8Array> {
  return writeSheet(STUDENT_LIST_SHEET, {}, rows);
}

export function resultWorkbook(
  rows: readonly SyntheticResultRow[],
): Promise<Uint8Array> {
  return writeSheet(ACADEMIC_RESULT_SHEET, {}, rows);
}

export interface StudentWorld {
  programId: string;
  programCode: string;
  versionId: string;
  courseId: string;
  courseCode: string;
  cohortId: string;
  cohortCode: string;
  admissionSemesterId: string;
  admissionSemesterCode: string;
  laterSemesterId: string;
  laterSemesterCode: string;
}

// One released program whose single cohort is scheduled onto the released version from the admission semester.
export async function createStudentWorld(
  app: NestExpressApplication,
  admin: Agent,
  suffix: string,
): Promise<StudentWorld> {
  const course = await createCourse(app, { courseCode: `SW${suffix}C1` });
  const program = await createProgram(app, { programCode: `SW${suffix}P` });
  const versionId = program.versions[0]!.id;
  await addCurriculumItem(admin, versionId, {
    courseId: course.id,
    plannedSemester: 1,
  });
  const cohort = await createCohort(app, `SW${suffix}-K`);
  const admission = await createSemester(
    app,
    STUDENT_E2E.ADMISSION_OFFSET_DAYS,
    'SWA',
  );
  const later = await createSemester(app, STUDENT_E2E.LATER_OFFSET_DAYS, 'SWL');
  await releaseViaApi(app, admin, {
    programId: program.id,
    versionId,
    semesterId: admission.id,
    cohortIds: [cohort.id],
  });
  return {
    programId: program.id,
    programCode: program.programCode,
    versionId,
    courseId: course.id,
    courseCode: course.courseCode,
    cohortId: cohort.id,
    cohortCode: cohort.cohortCode,
    admissionSemesterId: admission.id,
    admissionSemesterCode: admission.semesterCode,
    laterSemesterId: later.id,
    laterSemesterCode: later.semesterCode,
  };
}

export function studentRow(
  world: StudentWorld,
  studentCode: string,
  overrides: SyntheticStudentRow = {},
): SyntheticStudentRow {
  return {
    studentCode,
    fullName: `Sinh viên ${studentCode}`,
    cohortCode: world.cohortCode,
    major: 'M01',
    programCode: world.programCode,
    admissionSemesterCode: world.admissionSemesterCode,
    statusSemesterCode: world.admissionSemesterCode,
    status: 'Đang học',
    ...overrides,
  };
}

export function resultRow(
  world: StudentWorld,
  studentCode: string,
  overrides: SyntheticResultRow = {},
): SyntheticResultRow {
  return {
    studentCode,
    courseCode: world.courseCode,
    semesterCode: world.admissionSemesterCode,
    score10: '8.50',
    score4: '3.50',
    letterGrade: 'B+',
    status: 'Đạt',
    ...overrides,
  };
}

export interface SyntheticStudentFixture {
  studentId: string;
  userId: string;
  primaryEnrollmentId: string;
  primaryProgramId: string;
  admissionSemesterId: string;
}

// A student with an R6 account and one ACTIVE primary enrollment, written directly so read paths do not depend on the import pipeline.
export async function createSyntheticStudentFixture(
  app: NestExpressApplication,
  suffix: string,
  world?: StudentWorld,
  admin?: Agent,
): Promise<SyntheticStudentFixture> {
  const prisma = app.get(PrismaService);
  let held = world;
  if (!held) {
    if (!admin) throw new Error('A world or an R1 agent is required.');
    held = await createStudentWorld(app, admin, suffix);
  }
  const code = `SYN${suffix}`.toUpperCase();
  const account = await createAccount(app, code.toLowerCase(), 'R6');
  const assignment = await prisma.cohortVersion.findFirstOrThrow({
    where: { cohortId: held.cohortId, programVersionId: held.versionId },
  });
  const student = await prisma.student.create({
    data: {
      studentCode: code,
      fullName: `Sinh viên ${code}`,
      cohortId: held.cohortId,
      admissionSemesterId: held.admissionSemesterId,
      statusSemesterId: held.admissionSemesterId,
      major: 'M01',
      userId: account.id,
    },
  });
  const enrollment = await prisma.programEnrollment.create({
    data: {
      studentId: student.id,
      programId: held.programId,
      cohortId: held.cohortId,
      appliedVersionId: held.versionId,
      admissionVersionId: held.versionId,
      cohortAssignmentId: assignment.id,
      fromSemesterId: held.admissionSemesterId,
      enrollmentType: 'PRIMARY',
    },
  });
  return {
    studentId: student.id,
    userId: account.id,
    primaryEnrollmentId: enrollment.id,
    primaryProgramId: held.programId,
    admissionSemesterId: held.admissionSemesterId,
  };
}

export async function downloadBinary(
  call: request.Test,
): Promise<{ status: number; body: Buffer; headers: Record<string, string> }> {
  const response = await call.buffer(true).parse((stream, callback) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('error', callback);
    stream.on('end', () => callback(null, Buffer.concat(chunks)));
  });
  return {
    status: response.status,
    body: response.body as Buffer,
    headers: response.headers as Record<string, string>,
  };
}

export interface CredentialRow {
  studentCode: string;
  username: string;
  password: string;
}

export async function readCredentialWorkbook(
  bytes: Buffer,
): Promise<CredentialRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(bytes).buffer);
  const sheet = workbook.worksheets[0]!;
  const rows: CredentialRow[] = [];
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    rows.push({
      studentCode: String(row.getCell(1).value),
      username: String(row.getCell(2).value),
      password: String(row.getCell(3).value),
    });
  });
  return rows;
}
