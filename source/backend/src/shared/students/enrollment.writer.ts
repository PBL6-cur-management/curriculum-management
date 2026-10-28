import {
  EnrollmentStatus,
  EnrollmentType,
  StudentStatus,
  type Prisma,
  type StudentDataSource,
} from '../../generated/prisma/client.js';
import { AppException } from '../exception/app.exception.js';
import { lockPrograms } from '../releases/release-locks.js';
import type { CohortAssignmentFact } from '../releases/applied-version.types.js';
import { issuedVersionFact } from '../releases/cohort-version-schedule.js';
import { requireSemesterStart } from '../releases/semester-start.js';
import { todayDate } from '../time/today.js';
import { lockEnrollments, lockStudents } from './student-locks.js';
import { STUDENT_LIMITS } from './student.constants.js';
import { STUDENT_ERRORS } from './student.errors.js';

export interface AdmissionEnrollmentInput {
  studentId: string;
  programId: string;
  cohortId: string;
  admissionSemesterId: string;
  assignment: CohortAssignmentFact;
  actorId: string | null;
  source: StudentDataSource;
}

export type EnrollmentOperation =
  'ASSIGN_EXCEPTION' | 'TRANSFER' | 'ADD_SECOND_MAJOR';

export interface StudentEnrollmentCommand {
  operation: EnrollmentOperation;
  targetVersionId: string;
  fromSemesterId: string;
  basisDecision: string;
  sourceEnrollmentId?: string;
  expectedStudentUpdatedAt: string;
  expectedEnrollmentUpdatedAt?: string;
}

const TERMINAL_STATUSES: readonly StudentStatus[] = [
  StudentStatus.WITHDRAWN,
  StudentStatus.GRADUATED,
];

const invalidInterval = () =>
  new AppException(STUDENT_ERRORS.INVALID_ENROLLMENT_INTERVAL);

// Every enrollment write also moves Student.updatedAt, so the student's revision token covers the whole enrollment collection.
function touchStudent(
  tx: Prisma.TransactionClient,
  studentId: string,
  data: Prisma.StudentUpdateInput = {},
): Promise<unknown> {
  return tx.student.update({
    where: { id: studentId },
    data: { ...data, updatedAt: new Date() },
  });
}

export async function createAdmissionEnrollment(
  tx: Prisma.TransactionClient,
  input: AdmissionEnrollmentInput,
): Promise<string> {
  const { assignment } = input;
  if (
    assignment.version.programId !== input.programId ||
    assignment.cohort.id !== input.cohortId
  ) {
    throw invalidInterval();
  }
  await requireSemesterStart(tx, input.admissionSemesterId);
  await lockPrograms(tx, [input.programId]);
  await lockStudents(tx, [input.studentId]);
  const existing = await tx.programEnrollment.findFirst({
    where: {
      studentId: input.studentId,
      enrollmentType: EnrollmentType.PRIMARY,
    },
    select: { id: true },
  });
  if (existing) throw invalidInterval();
  const created = await tx.programEnrollment.create({
    data: {
      studentId: input.studentId,
      programId: input.programId,
      cohortId: input.cohortId,
      appliedVersionId: assignment.version.id,
      admissionVersionId: assignment.version.id,
      cohortAssignmentId: assignment.id,
      fromSemesterId: input.admissionSemesterId,
      enrollmentType: EnrollmentType.PRIMARY,
      isException: false,
      status: EnrollmentStatus.ACTIVE,
      createdById: input.actorId,
    },
    select: { id: true },
  });
  await touchStudent(tx, input.studentId, { dataSource: input.source });
  return created.id;
}

function assertCommandShape(command: StudentEnrollmentCommand): void {
  const basis = command.basisDecision.trim();
  const transfer = command.operation === 'TRANSFER';
  const hasSource = command.sourceEnrollmentId !== undefined;
  const hasSourceRevision = command.expectedEnrollmentUpdatedAt !== undefined;
  if (
    basis.length === 0 ||
    basis.length > STUDENT_LIMITS.BASIS_MAX ||
    hasSource !== transfer ||
    hasSourceRevision !== transfer
  ) {
    throw new AppException(STUDENT_ERRORS.ENROLLMENT_COMMAND_INVALID);
  }
}

export async function applyEnrollmentCommand(
  tx: Prisma.TransactionClient,
  studentId: string,
  command: StudentEnrollmentCommand,
  actorId: string,
): Promise<string> {
  assertCommandShape(command);
  const target = await tx.programVersion.findUnique({
    where: { id: command.targetVersionId },
    include: { effectiveSemester: true },
  });
  if (!target)
    throw new AppException(STUDENT_ERRORS.INVALID_ENROLLMENT_INTERVAL);
  const targetFact = issuedVersionFact(target);
  const source = command.sourceEnrollmentId
    ? await tx.programEnrollment.findUnique({
        where: { id: command.sourceEnrollmentId },
        select: { programId: true },
      })
    : null;
  await lockPrograms(
    tx,
    source ? [target.programId, source.programId] : [target.programId],
  );
  await lockStudents(tx, [studentId]);
  if (command.sourceEnrollmentId) {
    await lockEnrollments(tx, [command.sourceEnrollmentId]);
  }

  const student = await tx.student.findUnique({ where: { id: studentId } });
  if (!student) throw new AppException(STUDENT_ERRORS.STUDENT_NOT_FOUND);
  if (student.updatedAt.toISOString() !== command.expectedStudentUpdatedAt) {
    throw new AppException(STUDENT_ERRORS.ENROLLMENT_STATE_CHANGED);
  }
  if (TERMINAL_STATUSES.includes(student.status)) throw invalidInterval();

  const fromSemester = await requireSemesterStart(tx, command.fromSemesterId);
  if (
    fromSemester.startDate.getTime() > todayDate().getTime() ||
    targetFact.effectiveSemester.startDate.getTime() >
      fromSemester.startDate.getTime()
  ) {
    throw invalidInterval();
  }

  const enrollments = await tx.programEnrollment.findMany({
    where: { studentId },
    include: { fromSemester: true },
  });
  const active = enrollments.filter(
    (row) => row.status === EnrollmentStatus.ACTIVE,
  );
  const targetBusy = (ignoreId?: string) =>
    active.some(
      (row) => row.programId === target.programId && row.id !== ignoreId,
    );

  let type: EnrollmentType;
  let previousEnrollmentId: string | null = null;
  if (command.operation === 'ASSIGN_EXCEPTION') {
    if (
      enrollments.some((row) => row.enrollmentType === EnrollmentType.PRIMARY)
    ) {
      throw invalidInterval();
    }
    type = EnrollmentType.PRIMARY;
  } else if (command.operation === 'ADD_SECOND_MAJOR') {
    const hasPrimary = active.some(
      (row) => row.enrollmentType === EnrollmentType.PRIMARY,
    );
    if (!hasPrimary || targetBusy()) throw invalidInterval();
    type = EnrollmentType.SECOND_MAJOR;
  } else {
    const closing = enrollments.find(
      (row) => row.id === command.sourceEnrollmentId,
    );
    if (!closing) throw new AppException(STUDENT_ERRORS.ENROLLMENT_NOT_FOUND);
    if (
      closing.updatedAt.toISOString() !== command.expectedEnrollmentUpdatedAt
    ) {
      throw new AppException(STUDENT_ERRORS.ENROLLMENT_STATE_CHANGED);
    }
    if (
      closing.status !== EnrollmentStatus.ACTIVE ||
      !closing.fromSemester.startDate ||
      closing.fromSemester.startDate.getTime() >
        fromSemester.startDate.getTime() ||
      targetBusy(closing.id)
    ) {
      throw invalidInterval();
    }
    type = closing.enrollmentType;
    previousEnrollmentId = closing.id;
    await tx.programEnrollment.update({
      where: { id: closing.id },
      data: {
        status: EnrollmentStatus.TRANSFERRED,
        untilSemesterId: fromSemester.id,
      },
    });
  }

  const created = await tx.programEnrollment.create({
    data: {
      studentId,
      programId: target.programId,
      cohortId: student.cohortId,
      appliedVersionId: target.id,
      admissionVersionId: target.id,
      cohortAssignmentId: null,
      fromSemesterId: fromSemester.id,
      previousEnrollmentId,
      enrollmentType: type,
      isException: true,
      basisDecision: command.basisDecision.trim(),
      status: EnrollmentStatus.ACTIVE,
      createdById: actorId,
    },
    select: { id: true },
  });
  await touchStudent(tx, studentId);
  return created.id;
}

// Closes every open enrollment at the status-effective semester; a semester earlier than an open start would rewrite history.
export async function endStudentEnrollments(
  tx: Prisma.TransactionClient,
  studentId: string,
  untilSemesterId: string,
): Promise<void> {
  const until = await requireSemesterStart(tx, untilSemesterId);
  await lockStudents(tx, [studentId]);
  const open = await tx.programEnrollment.findMany({
    where: { studentId, status: EnrollmentStatus.ACTIVE },
    include: { fromSemester: true },
  });
  if (open.length === 0) return;
  if (
    open.some(
      (row) =>
        !row.fromSemester.startDate ||
        row.fromSemester.startDate.getTime() > until.startDate.getTime(),
    )
  ) {
    throw invalidInterval();
  }
  const ids = open.map((row) => row.id);
  await lockEnrollments(tx, ids);
  await tx.programEnrollment.updateMany({
    where: { id: { in: ids }, status: EnrollmentStatus.ACTIVE },
    data: { status: EnrollmentStatus.ENDED, untilSemesterId: until.id },
  });
  await touchStudent(tx, studentId);
}
