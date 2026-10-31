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
import { cohortFromLegacyCode } from '../legacy-mapping.js';
import {
  PEOPLE_DATA_FILES,
  privateDataUrl,
  readDutResults,
  type DutLecturer,
  type DutResult,
  type DutStudent,
} from '../people-data.js';
import type { CatalogSeedResult } from './seed-catalog.js';

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
// The school's letter scale: D and above pass, F fails. Anything else (I = incomplete, X, blank) has no outcome yet.
const PASSING_LETTERS = new Set(['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D']);
const FAILED_LETTER = 'F';
const RESULT_BATCH = 1000;

export interface PeopleSeedResult {
  lecturers: { created: number; skipped: number };
  students: { created: number; skipped: number };
  results: {
    created: number;
    exempt: number;
    skippedWithoutOutcome: number;
    skippedUnknownCourse: number;
  };
  credentialsFile: string | null;
}

const required = <Value>(
  map: ReadonlyMap<string, Value>,
  key: string,
  kind: string,
) => {
  const value = map.get(key);
  if (value === undefined) throw new Error(`Missing ${kind}: ${key}`);
  return value;
};

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
    // The staff code is the username: the school's e-mail column is empty for almost everyone.
    const username = lecturer.staffCode;
    const archived = lecturer.unitCode === ARCHIVED_UNIT;
    const temporaryPassword = generateTemporaryPassword();
    const emailTaken =
      lecturer.email !== null &&
      (await prisma.user.findFirst({
        where: { email: lecturer.email },
        select: { id: true },
      })) !== null;
    const user = await prisma.user.create({
      data: {
        username,
        userCode: lecturer.staffCode,
        fullName: lecturer.fullName,
        email: emailTaken ? null : lecturer.email,
        passwordHash: await passwords.hash(temporaryPassword),
        mustChangePassword: true,
        status: archived ? UserStatus.DISABLED : UserStatus.ACTIVE,
        orgUnitId: facultyId,
      },
      select: { id: true },
    });
    result.lecturers.created++;
    if (archived) continue;
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
  if (credentials.length > 1) {
    const file = privateDataUrl(PEOPLE_DATA_FILES.CREDENTIALS);
    writeFileSync(file, `${credentials.join('\n')}\n`);
    result.credentialsFile = file.pathname;
  }
}

// Frame code (MaNganh/MaKhung) → the program version seed-programs created from it.
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
  catalog: Pick<CatalogSeedResult, 'semesterIdsByLegacyCode' | 'cohortIds'>,
  result: PeopleSeedResult,
) {
  const versions = await versionsByFrame(prisma, programs);
  const statusSemesterId = required(
    catalog.semesterIdsByLegacyCode,
    openTermCode,
    'semester for term',
  );
  for (const student of students) {
    const version = required(
      versions,
      student.frameCode,
      'program version for frame',
    );
    if (
      await prisma.student.findUnique({
        where: { studentCode: student.studentCode },
        select: { id: true },
      })
    ) {
      result.students.skipped++;
      continue;
    }
    const admissionSemesterId = required(
      catalog.semesterIdsByLegacyCode,
      student.admissionTermCode,
      'semester for term',
    );
    const cohortId = required(
      catalog.cohortIds,
      cohortFromLegacyCode(student.admissionTermCode).cohortCode,
      'cohort',
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

export function resultStatus(
  result: Pick<DutResult, 'letterGrade' | 'termCode' | 'exempt'>,
  openTermCode: string,
): AcademicResultStatus | null {
  if (result.exempt) return AcademicResultStatus.EXEMPT;
  const letter = result.letterGrade?.toUpperCase() ?? '';
  if (PASSING_LETTERS.has(letter)) return AcademicResultStatus.PASSED;
  if (letter === FAILED_LETTER) return AcademicResultStatus.FAILED;
  return result.termCode === openTermCode
    ? AcademicResultStatus.IN_PROGRESS
    : null;
}

async function seedResults(
  prisma: PrismaClient,
  openTermCode: string,
  semesters: ReadonlyMap<string, string>,
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
    const status = resultStatus(row, openTermCode);
    if (!status) {
      result.results.skippedWithoutOutcome++;
      continue;
    }
    const courseId = courses.get(row.courseCode);
    const studentId = students.get(row.studentCode);
    // Courses outside every seeded frame (other faculties' electives, physical education…) are not in the catalog.
    if (!courseId || !studentId) {
      result.results.skippedUnknownCourse++;
      continue;
    }
    if (status === AcademicResultStatus.EXEMPT) result.results.exempt++;
    batch.push({
      studentId,
      courseId,
      semesterId: required(semesters, row.termCode, 'semester for term'),
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
    catalog: Pick<CatalogSeedResult, 'semesterIdsByLegacyCode' | 'cohortIds'>;
  },
): Promise<PeopleSeedResult> {
  const result: PeopleSeedResult = {
    lecturers: { created: 0, skipped: 0 },
    students: { created: 0, skipped: 0 },
    results: {
      created: 0,
      exempt: 0,
      skippedWithoutOutcome: 0,
      skippedUnknownCourse: 0,
    },
    credentialsFile: null,
  };
  await seedLecturers(prisma, input.people.lecturers, input.facultyId, result);
  await seedStudents(
    prisma,
    input.people.students,
    input.programs,
    input.openTermCode,
    input.catalog,
    result,
  );
  await seedResults(
    prisma,
    input.openTermCode,
    input.catalog.semesterIdsByLegacyCode,
    result,
  );
  return result;
}
