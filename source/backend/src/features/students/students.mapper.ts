import type {
  Prisma,
  ProgramVersion,
  Semester,
} from '../../generated/prisma/client.js';
import { toWireDecimal } from '../../shared/decimal/decimal.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { APPLIED_VERSION_ERRORS } from '../../shared/releases/applied-version.errors.js';
import {
  toCohortDto,
  toSemesterDto,
} from '../../shared/releases/semester.dto.js';
import type { StudentAppliedVersionResult } from '../../shared/students/student-applied-version.types.js';
import type { AcademicResultDto } from './dto/academic-result.dto.js';
import type {
  StudentAppliedVersionDto,
  StudentDetailDto,
  StudentEnrollmentDto,
  StudentEnrollmentTargetDto,
  StudentIssuedVersionDto,
  StudentProgramOptionDto,
  StudentSummaryDto,
} from './dto/student.dto.js';

export const STUDENT_SUMMARY_INCLUDE = {
  cohort: true,
} as const satisfies Prisma.StudentInclude;
export const STUDENT_DETAIL_INCLUDE = {
  cohort: true,
  admissionSemester: true,
  statusSemester: true,
} as const satisfies Prisma.StudentInclude;
export const ENROLLMENT_INCLUDE = {
  program: { select: { id: true, programCode: true } },
  cohort: true,
  appliedVersion: {
    select: {
      id: true,
      versionNumber: true,
      status: true,
      programName: true,
    },
  },
  fromSemester: true,
  untilSemester: true,
} as const satisfies Prisma.ProgramEnrollmentInclude;
export const RESULT_INCLUDE = {
  course: { select: { id: true, courseCode: true, courseName: true } },
  semester: true,
} as const satisfies Prisma.AcademicResultInclude;

type SummaryRow = Prisma.StudentGetPayload<{
  include: typeof STUDENT_SUMMARY_INCLUDE;
}>;
type DetailRow = Prisma.StudentGetPayload<{
  include: typeof STUDENT_DETAIL_INCLUDE;
}>;
export type EnrollmentRow = Prisma.ProgramEnrollmentGetPayload<{
  include: typeof ENROLLMENT_INCLUDE;
}>;
export type ResultRow = Prisma.AcademicResultGetPayload<{
  include: typeof RESULT_INCLUDE;
}>;

// A version that cannot be shown as issued means the enrollment points at corrupt data; failing is safer than inventing a label.
export function toIssuedVersionDto(
  row: Pick<ProgramVersion, 'id' | 'versionNumber' | 'status'>,
): StudentIssuedVersionDto {
  if (row.status === 'DRAFT' || !row.versionNumber) {
    throw new AppException(APPLIED_VERSION_ERRORS.VERSION_NOT_ISSUED);
  }
  return { id: row.id, versionNumber: row.versionNumber, status: row.status };
}

export function toProgramOptionDto(
  programId: string,
  programCode: string,
  programName: string,
): StudentProgramOptionDto {
  return { id: programId, programCode, programName };
}

export function toStudentSummaryDto(row: SummaryRow): StudentSummaryDto {
  return {
    id: row.id,
    studentCode: row.studentCode,
    fullName: row.fullName,
    cohort: toCohortDto(row.cohort),
    major: row.major,
    status: row.status,
    dataSource: row.dataSource,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toEnrollmentDto(row: EnrollmentRow): StudentEnrollmentDto {
  return {
    id: row.id,
    studentId: row.studentId,
    program: toProgramOptionDto(
      row.program.id,
      row.program.programCode,
      row.appliedVersion.programName,
    ),
    cohort: toCohortDto(row.cohort),
    appliedVersion: toIssuedVersionDto(row.appliedVersion),
    admissionVersionId: row.admissionVersionId,
    cohortAssignmentId: row.cohortAssignmentId,
    fromSemester: toSemesterDto(row.fromSemester),
    untilSemester: row.untilSemester ? toSemesterDto(row.untilSemester) : null,
    previousEnrollmentId: row.previousEnrollmentId,
    enrollmentType: row.enrollmentType,
    isException: row.isException,
    basisDecision: row.basisDecision,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toStudentDetailDto(
  row: DetailRow,
  extras: Pick<
    StudentDetailDto,
    'enrollments' | 'canManageEnrollments' | 'enrollmentWarnings'
  >,
): StudentDetailDto {
  return {
    ...toStudentSummaryDto(row),
    userId: row.userId,
    admissionSemester: toSemesterDto(row.admissionSemester),
    statusSemester: toSemesterDto(row.statusSemester),
    ...extras,
  };
}

export function toEnrollmentTargetDto(
  version: ProgramVersion & {
    program: { programCode: string };
    effectiveSemester: Semester;
  },
): StudentEnrollmentTargetDto {
  return {
    version: toIssuedVersionDto(version),
    program: toProgramOptionDto(
      version.programId,
      version.program.programCode,
      version.programName,
    ),
    effectiveSemester: toSemesterDto(version.effectiveSemester),
  };
}

export function toAppliedVersionDto(
  result: StudentAppliedVersionResult,
): StudentAppliedVersionDto {
  return {
    studentId: result.studentId,
    enrollmentId: result.enrollmentId,
    programId: result.programId,
    semesterId: result.semesterId,
    programVersionId: result.programVersionId,
    source: result.source,
    cohortAssignmentId: result.cohortAssignmentId,
  };
}

export function toAcademicResultDto(row: ResultRow): AcademicResultDto {
  return {
    id: row.id,
    studentId: row.studentId,
    course: {
      id: row.course.id,
      courseCode: row.course.courseCode,
      courseName: row.course.courseName,
    },
    semester: toSemesterDto(row.semester),
    score10: row.score10 ? toWireDecimal(row.score10) : null,
    score4: row.score4 ? toWireDecimal(row.score4) : null,
    letterGrade: row.letterGrade,
    status: row.status,
    dataSource: row.dataSource,
    revision: row.revision,
    updatedAt: row.updatedAt.toISOString(),
  };
}
