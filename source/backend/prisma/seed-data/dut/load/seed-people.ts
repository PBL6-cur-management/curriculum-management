import { writeFileSync } from 'node:fs';
import {
  AcademicResultStatus,
  EnrollmentType,
  StudentDataSource,
  StudentStatus,
  SubjectGroupMemberRole,
  UserStatus,
  type Prisma,
  type PrismaClient,
} from '../../../../src/generated/prisma/client.js';
import { PasswordService } from '../../../../src/shared/password/password.service.js';
import { generateTemporaryPassword } from '../../../../src/shared/password/temporary-password.js';
import { todayDate } from '../../../../src/shared/time/today.js';
import type { DutProgramsFile } from '../dut-data.js';
import {
  cohortFromLegacyCode,
  semesterFromLegacyCode,
} from '../legacy-mapping.js';
import {
  PEOPLE_DATA_FILES,
  privateDataUrl,
  readDutResults,
  type DutLecturer,
  type DutStudent,
} from '../people-data.js';

// Interim subject groups until the Khoa sends its real ones: the faculty's own staff and everyone who
// teaches here from elsewhere. Archived staff (990) get a disabled account and no group.
export const DUT_STAFF_GROUPS = {
  FACULTY: {
    groupCode: 'CNTT-KHOA',
    groupName: 'Giảng viên Khoa Công nghệ Thông tin',
  },
  VISITING: {
    groupCode: 'CNTT-THINHGIANG',
    groupName: 'Giảng viên thỉnh giảng',
  },
} as const;
const FACULTY_UNIT = '102';
const ARCHIVED_UNIT = '990';
const STAFF_EMAIL_DOMAIN = 'dut.udn.vn';
const FAILED_LETTER = 'F';
const RESULT_BATCH = 1000;

export interface PeopleSeedResult {
  lecturers: { created: number; skipped: number };
  students: { created: number; skipped: number };
  results: {
    created: number;
    skippedPastWithoutScore: number;
    skippedUnknownCourse: number;
  };
  credentialsFile: string | null;
}

async function ensureSemester(
  prisma: PrismaClient,
  termCode: string,
  cache: Map<string, string>,
) {
  const cached = cache.get(termCode);
  if (cached) return cached;
  const semester = semesterFromLegacyCode(termCode);
  const row = await prisma.semester.upsert({
    where: { semesterCode: semester.semesterCode },
    create: semester,
    update: {},
    select: { id: true },
  });
  cache.set(termCode, row.id);
  return row.id;
}

async function ensureCohort(
  prisma: PrismaClient,
  termCode: string,
  cache: Map<string, string>,
) {
  const cohort = cohortFromLegacyCode(termCode);
  const cached = cache.get(cohort.cohortCode);
  if (cached) return cached;
  const row = await prisma.cohort.upsert({
    where: { cohortCode: cohort.cohortCode },
    create: cohort,
    update: {},
    select: { id: true },
  });
  cache.set(cohort.cohortCode, row.id);
  return row.id;
}

async function seedLecturers(
  prisma: PrismaClient,
  lecturers: DutLecturer[],
  facultyId: string,
  result: PeopleSeedResult,
) {
  const today = todayDate();
  const groups = new Map<string, string>();
  for (const group of Object.values(DUT_STAFF_GROUPS)) {
    const row = await prisma.subjectGroup.upsert({
      where: { groupCode: group.groupCode },
      create: { ...group, facultyId },
      update: {},
      select: { id: true },
    });
    groups.set(group.groupCode, row.id);
  }
  const passwords = new PasswordService();
  const credentials: string[] = [
    'username,userCode,fullName,temporaryPassword',
  ];
  for (const lecturer of lecturers) {
    if (
      await prisma.user.findUnique({
        where: { userCode: lecturer.staffCode },
        select: { id: true },
      })
    ) {
      result.lecturers.skipped++;
      continue;
    }
    let username = lecturer.emailLocalPart ?? lecturer.staffCode;
    if (
      await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      })
    )
      username = lecturer.staffCode;
    const archived = lecturer.unitCode === ARCHIVED_UNIT;
    const temporaryPassword = generateTemporaryPassword();
    const user = await prisma.user.create({
      data: {
        username,
        userCode: lecturer.staffCode,
        fullName: lecturer.fullName,
        email: lecturer.emailLocalPart
          ? `${lecturer.emailLocalPart}@${STAFF_EMAIL_DOMAIN}`
          : null,
        passwordHash: await passwords.hash(temporaryPassword),
        mustChangePassword: true,
        status: archived ? UserStatus.DISABLED : UserStatus.ACTIVE,
        orgUnitId: facultyId,
      },
      select: { id: true },
    });
    result.lecturers.created++;
    if (!archived) {
      credentials.push(
        [
          username,
          lecturer.staffCode,
          `"${lecturer.fullName}"`,
          temporaryPassword,
        ].join(','),
      );
      const group =
        lecturer.unitCode === FACULTY_UNIT
          ? DUT_STAFF_GROUPS.FACULTY
          : DUT_STAFF_GROUPS.VISITING;
      await prisma.subjectGroupMember.create({
        data: {
          subjectGroupId: groups.get(group.groupCode)!,
          lecturerId: user.id,
          memberRole: SubjectGroupMemberRole.MEMBER,
          validFrom: today,
        },
      });
    }
  }
  if (credentials.length > 1) {
    const file = privateDataUrl(PEOPLE_DATA_FILES.CREDENTIALS);
    writeFileSync(file, `${credentials.join('\n')}\n`, { flag: 'a' });
    result.credentialsFile = file.pathname;
  }
}

// Frame code (MaNganh/MaKhung) → program version created by seed-programs, matched on program code and name.
async function versionsByFrame(
  prisma: PrismaClient,
  programs: DutProgramsFile,
) {
  const map = new Map<
    string,
    { programId: string; versionId: string; majorName: string }
  >();
  for (const program of programs.programs)
    for (const version of program.versions) {
      const row = await prisma.programVersion.findFirst({
        where: {
          program: { programCode: program.programCode },
          programName: version.programName,
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, programId: true },
      });
      if (row)
        map.set(version.frameCode, {
          programId: row.programId,
          versionId: row.id,
          majorName: version.majorName,
        });
    }
  return map;
}

async function seedStudents(
  prisma: PrismaClient,
  students: DutStudent[],
  programs: DutProgramsFile,
  openTermCode: string,
  caches: { semesters: Map<string, string>; cohorts: Map<string, string> },
  result: PeopleSeedResult,
) {
  const versions = await versionsByFrame(prisma, programs);
  const statusSemesterId = await ensureSemester(
    prisma,
    openTermCode,
    caches.semesters,
  );
  for (const student of students) {
    const version = versions.get(student.frameCode);
    if (!version)
      throw new Error(`No program version for frame ${student.frameCode}`);
    if (
      await prisma.student.findUnique({
        where: { studentCode: student.studentCode },
        select: { id: true },
      })
    ) {
      result.students.skipped++;
      continue;
    }
    const admissionSemesterId = await ensureSemester(
      prisma,
      student.admissionTermCode,
      caches.semesters,
    );
    const cohortId = await ensureCohort(
      prisma,
      student.admissionTermCode,
      caches.cohorts,
    );
    await prisma.$transaction(async (tx) => {
      const row = await tx.student.create({
        data: {
          studentCode: student.studentCode,
          fullName: student.fullName,
          cohortId,
          admissionSemesterId,
          statusSemesterId,
          major: version.majorName,
          status: student.onLeave
            ? StudentStatus.ON_LEAVE
            : StudentStatus.STUDYING,
          dataSource: StudentDataSource.SCHOOL_DB,
        },
        select: { id: true },
      });
      await tx.programEnrollment.create({
        data: {
          studentId: row.id,
          programId: version.programId,
          cohortId,
          appliedVersionId: version.versionId,
          admissionVersionId: version.versionId,
          fromSemesterId: admissionSemesterId,
          enrollmentType: EnrollmentType.PRIMARY,
        },
      });
    });
    result.students.created++;
  }
}

function resultStatus(
  letterGrade: string | null,
  hasScore: boolean,
): AcademicResultStatus | null {
  if (!hasScore) return null;
  return letterGrade?.toUpperCase() === FAILED_LETTER
    ? AcademicResultStatus.FAILED
    : AcademicResultStatus.PASSED;
}

async function seedResults(
  prisma: PrismaClient,
  openTermCode: string,
  semesters: Map<string, string>,
  result: PeopleSeedResult,
) {
  const courses = new Map(
    (
      await prisma.course.findMany({ select: { id: true, courseCode: true } })
    ).map((course) => [course.courseCode, course.id]),
  );
  const students = new Map(
    (
      await prisma.student.findMany({
        where: { dataSource: StudentDataSource.SCHOOL_DB },
        select: { id: true, studentCode: true },
      })
    ).map((student) => [student.studentCode, student.id]),
  );
  let batch: Prisma.AcademicResultCreateManyInput[] = [];
  const flush = async () => {
    if (!batch.length) return;
    result.results.created += (
      await prisma.academicResult.createMany({
        data: batch,
        skipDuplicates: true,
      })
    ).count;
    batch = [];
  };
  for await (const row of readDutResults()) {
    const hasScore = Boolean(row.score10 || row.score4 || row.letterGrade);
    const status =
      resultStatus(row.letterGrade, hasScore) ??
      (row.termCode === openTermCode ? AcademicResultStatus.IN_PROGRESS : null);
    if (!status) {
      result.results.skippedPastWithoutScore++;
      continue;
    }
    const courseId = courses.get(row.courseCode);
    const studentId = students.get(row.studentCode);
    if (!courseId || !studentId) {
      result.results.skippedUnknownCourse++;
      continue;
    }
    batch.push({
      studentId,
      courseId,
      semesterId: await ensureSemester(prisma, row.termCode, semesters),
      score10: row.score10,
      score4: row.score4,
      letterGrade: row.letterGrade,
      status,
      dataSource: StudentDataSource.SCHOOL_DB,
    });
    if (batch.length >= RESULT_BATCH) await flush();
  }
  await flush();
}

export async function seedDutPeople(
  prisma: PrismaClient,
  input: {
    people: { lecturers: DutLecturer[]; students: DutStudent[] };
    programs: DutProgramsFile;
    openTermCode: string;
    facultyId: string;
  },
): Promise<PeopleSeedResult> {
  const result: PeopleSeedResult = {
    lecturers: { created: 0, skipped: 0 },
    students: { created: 0, skipped: 0 },
    results: {
      created: 0,
      skippedPastWithoutScore: 0,
      skippedUnknownCourse: 0,
    },
    credentialsFile: null,
  };
  const caches = {
    semesters: new Map<string, string>(),
    cohorts: new Map<string, string>(),
  };
  await seedLecturers(prisma, input.people.lecturers, input.facultyId, result);
  await seedStudents(
    prisma,
    input.people.students,
    input.programs,
    input.openTermCode,
    caches,
    result,
  );
  await seedResults(prisma, input.openTermCode, caches.semesters, result);
  return result;
}
