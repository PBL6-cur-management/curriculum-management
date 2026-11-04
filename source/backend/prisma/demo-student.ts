// Public demo only; never run against a database real users depend on.
// Short public passwords bypass policy deliberately. Every personal value and score is synthetic.
// Re-running replaces enrolments/results; saved audits or result changes prevent deletion.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AcademicResultStatus,
  EnrollmentStatus,
  EnrollmentType,
  Prisma,
  PrismaClient,
  StudentDataSource,
  StudentStatus,
  UserStatus,
} from '../src/generated/prisma/client.js';
import { normalizeUsername } from '../src/shared/auth/username.js';
import { PasswordService } from '../src/shared/password/password.service.js';
import { todayDate } from '../src/shared/time/today.js';
import { seedDemoPlos } from './demo-student-plos.js';

const DEFAULT_USERNAME = 'demo.sinhvien';
const DEFAULT_PASSWORD = 'demo';
const DEMO_USER_CODE = 'DEMO_SV';
const DEMO_STUDENT_CODE = 'DEMOSV001';
const DEMO_FULL_NAME = 'Sinh viên Demo';
const DEMO_EMAIL = 'demo.sinhvien@example.com';
const PREFERRED_PROGRAM_HINT = 'CNTT';
const MIN_STARTED_TERMS = 4;
const REGULAR_TERMS = [1, 2];
const INITIAL_REVISION = 1;
const FIRST_PLANNED_SEMESTER = 1;
const FAILED_SCORE10 = 3.5;
const PASS_SCORES10 = [8.7, 7.4, 6.8, 9.1, 5.9, 7.9, 8.2, 6.3, 7.1, 5.2];
const FOREIGN_KEY_ERROR_CODE = 'P2003';
const GRADE_SCALE = [
  { min: 8.5, letter: 'A', score4: 4 },
  { min: 8.0, letter: 'B+', score4: 3.5 },
  { min: 7.0, letter: 'B', score4: 3 },
  { min: 6.5, letter: 'C+', score4: 2.5 },
  { min: 5.5, letter: 'C', score4: 2 },
  { min: 5.0, letter: 'D+', score4: 1.5 },
  { min: 4.0, letter: 'D', score4: 1 },
  { min: 0, letter: 'F', score4: 0 },
] as const;

const username = normalizeUsername(
  process.env.DEMO_STUDENT_USERNAME ?? DEFAULT_USERNAME,
);
const password = process.env.DEMO_STUDENT_PASSWORD ?? DEFAULT_PASSWORD;

function grade(score10: number) {
  const converted = GRADE_SCALE.find((entry) => score10 >= entry.min);
  if (!converted) throw new Error('Điểm demo nằm ngoài thang điểm.');
  return converted;
}

async function regularTerms(prisma: PrismaClient, fromSemesterId: string) {
  const fromSemester = await prisma.semester.findUniqueOrThrow({
    where: { id: fromSemesterId },
    select: { startDate: true },
  });
  if (!fromSemester.startDate) {
    throw new Error('Học kỳ bắt đầu của đăng ký mẫu chưa có ngày bắt đầu.');
  }
  return prisma.semester.findMany({
    where: {
      startDate: { not: null, gte: fromSemester.startDate },
      termInYear: { in: REGULAR_TERMS },
    },
    orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
    select: { id: true, startDate: true },
  });
}

async function pickTemplate(prisma: PrismaClient, today: Date) {
  const programCode = process.env.DEMO_STUDENT_PROGRAM_CODE;
  const cohortCode = process.env.DEMO_STUDENT_COHORT_CODE;
  const hasOverride = programCode !== undefined || cohortCode !== undefined;
  const enrollments = await prisma.programEnrollment.findMany({
    where: {
      status: EnrollmentStatus.ACTIVE,
      enrollmentType: EnrollmentType.PRIMARY,
      isException: false,
      fromSemester: { startDate: { not: null, lte: today } },
      student: { studentCode: { not: DEMO_STUDENT_CODE } },
    },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      programId: true,
      cohortId: true,
      appliedVersionId: true,
      admissionVersionId: true,
      cohortAssignmentId: true,
      fromSemesterId: true,
      program: { select: { programCode: true } },
      cohort: { select: { cohortCode: true } },
      appliedVersion: { select: { versionNumber: true } },
      student: {
        select: {
          cohortId: true,
          admissionSemesterId: true,
          statusSemesterId: true,
          major: true,
        },
      },
    },
  });
  const termCache = new Map<string, Awaited<ReturnType<typeof regularTerms>>>();
  const candidates: typeof enrollments = [];
  for (const enrollment of enrollments) {
    if (
      (programCode !== undefined &&
        enrollment.program.programCode !== programCode) ||
      (cohortCode !== undefined && enrollment.cohort.cohortCode !== cohortCode)
    ) {
      continue;
    }
    let terms = termCache.get(enrollment.fromSemesterId);
    if (!terms) {
      terms = await regularTerms(prisma, enrollment.fromSemesterId);
      termCache.set(enrollment.fromSemesterId, terms);
    }
    const started = terms.filter(
      (term) => term.startDate !== null && term.startDate <= today,
    );
    if (
      started.length >=
      (hasOverride ? FIRST_PLANNED_SEMESTER : MIN_STARTED_TERMS)
    ) {
      candidates.push(enrollment);
    }
  }
  const population = new Map<string, number>();
  const cohortKey = (enrollment: (typeof enrollments)[number]) =>
    JSON.stringify([enrollment.programId, enrollment.cohortId]);
  for (const enrollment of candidates) {
    const key = cohortKey(enrollment);
    population.set(key, (population.get(key) ?? 0) + 1);
  }
  candidates.sort((left, right) => {
    const preference =
      Number(right.program.programCode.includes(PREFERRED_PROGRAM_HINT)) -
      Number(left.program.programCode.includes(PREFERRED_PROGRAM_HINT));
    return (
      preference ||
      (population.get(cohortKey(right)) ?? 0) -
        (population.get(cohortKey(left)) ?? 0) ||
      left.program.programCode.localeCompare(right.program.programCode) ||
      left.cohort.cohortCode.localeCompare(right.cohort.cohortCode) ||
      left.id.localeCompare(right.id)
    );
  });
  const enrollment = candidates[0];
  if (!enrollment) {
    const availableCodes = [
      ...new Set(enrollments.map((entry) => entry.program.programCode)),
    ].sort();
    throw new Error(
      `Không có đăng ký mẫu phù hợp. Mã chương trình hiện có: ${availableCodes.join(', ') || '(không có)'}. Kiểm tra DEMO_STUDENT_PROGRAM_CODE / DEMO_STUDENT_COHORT_CODE và ngày học kỳ.`,
    );
  }
  return { enrollment, student: enrollment.student };
}

function buildResults(
  studentId: string,
  items: { courseId: string; plannedSemester: number }[],
  started: { id: string }[],
): Prisma.AcademicResultCreateManyInput[] {
  let failedAssigned = false;
  return items.flatMap<Prisma.AcademicResultCreateManyInput>((item, index) => {
    const termIndex = item.plannedSemester - FIRST_PLANNED_SEMESTER;
    const term = started[termIndex];
    if (!term) return [];
    const base = {
      studentId,
      courseId: item.courseId,
      semesterId: term.id,
      dataSource: StudentDataSource.EXCEL,
      revision: INITIAL_REVISION,
    };
    if (termIndex === started.length - 1) {
      return [
        {
          ...base,
          status: AcademicResultStatus.IN_PROGRESS,
          score10: null,
          score4: null,
          letterGrade: null,
        },
      ];
    }
    const failed = termIndex === 0 && !failedAssigned;
    if (failed) failedAssigned = true;
    const score10 = failed
      ? FAILED_SCORE10
      : PASS_SCORES10[index % PASS_SCORES10.length];
    const converted = grade(score10);
    return [
      {
        ...base,
        status: failed
          ? AcademicResultStatus.FAILED
          : AcademicResultStatus.PASSED,
        score10: new Prisma.Decimal(score10),
        score4: new Prisma.Decimal(converted.score4),
        letterGrade: converted.letter,
      },
    ];
  });
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  const today = todayDate();
  const template = await pickTemplate(prisma, today);
  const terms = await regularTerms(prisma, template.enrollment.fromSemesterId);
  const started = terms.filter(
    (term) => term.startDate !== null && term.startDate <= today,
  );
  const items = await prisma.curriculumItem.findMany({
    where: {
      versionId: template.enrollment.appliedVersionId,
      isElective: false,
    },
    orderBy: [{ plannedSemester: 'asc' }, { id: 'asc' }],
    select: { id: true, courseId: true, plannedSemester: true },
  });
  const passwordHash = await new PasswordService().hash(password);
  const { resultCount, ploCount } = await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { username },
      select: { id: true, userCode: true },
    });
    const existingStudent = await tx.student.findUnique({
      where: { studentCode: DEMO_STUDENT_CODE },
      select: { userId: true },
    });
    if (
      (existingUser && existingUser.userCode !== DEMO_USER_CODE) ||
      (existingStudent?.userId && existingStudent.userId !== existingUser?.id)
    ) {
      throw new Error(
        'Tài khoản hoặc mã sinh viên demo đã thuộc bản ghi khác; không ghi đè.',
      );
    }
    const account = {
      fullName: DEMO_FULL_NAME,
      email: DEMO_EMAIL,
      passwordHash,
      mustChangePassword: false,
      status: UserStatus.ACTIVE,
      orgUnitId: null,
    };
    const user = await tx.user.upsert({
      where: { username },
      create: { username, userCode: DEMO_USER_CODE, ...account },
      update: account,
      select: { id: true },
    });
    const studentData = {
      fullName: DEMO_FULL_NAME,
      cohortId: template.student.cohortId,
      admissionSemesterId: template.student.admissionSemesterId,
      statusSemesterId: template.student.statusSemesterId,
      major: template.student.major,
      status: StudentStatus.STUDYING,
      dataSource: StudentDataSource.EXCEL,
      userId: user.id,
    };
    const student = await tx.student.upsert({
      where: { studentCode: DEMO_STUDENT_CODE },
      create: { studentCode: DEMO_STUDENT_CODE, ...studentData },
      update: studentData,
      select: { id: true },
    });
    await tx.academicResult.deleteMany({ where: { studentId: student.id } });
    await tx.programEnrollment.deleteMany({ where: { studentId: student.id } });
    const enrollment = template.enrollment;
    await tx.programEnrollment.create({
      data: {
        studentId: student.id,
        programId: enrollment.programId,
        cohortId: enrollment.cohortId,
        appliedVersionId: enrollment.appliedVersionId,
        admissionVersionId: enrollment.admissionVersionId,
        cohortAssignmentId: enrollment.cohortAssignmentId,
        fromSemesterId: enrollment.fromSemesterId,
        untilSemesterId: null,
        createdById: null,
        enrollmentType: EnrollmentType.PRIMARY,
        isException: false,
        status: EnrollmentStatus.ACTIVE,
      },
    });
    const results = await tx.academicResult.createMany({
      data: buildResults(student.id, items, started),
    });
    const plos = await seedDemoPlos(tx, enrollment.appliedVersionId);
    return { resultCount: results.count, ploCount: plos };
  });
  console.log(
    `Sinh viên demo ${username}: ${template.enrollment.program.programCode} / khóa ${template.enrollment.cohort.cohortCode} / phiên bản ${template.enrollment.appliedVersion.versionNumber}; ${resultCount} kết quả; ${ploCount} PLO mới.`,
  );
} catch (error) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === FOREIGN_KEY_ERROR_CODE
  ) {
    throw new Error(
      'Không thể làm mới sinh viên demo: có bản xét tốt nghiệp đã lưu, lịch sử thay đổi kết quả hoặc bản ghi liên quan đang tham chiếu. Nhờ cán bộ kiểm tra trước khi chạy lại; giao dịch đã được hoàn tác.',
      { cause: error },
    );
  }
  throw error;
} finally {
  await prisma.$disconnect();
}
