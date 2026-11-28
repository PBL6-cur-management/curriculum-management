import {
  EnrollmentStatus,
  EnrollmentType,
} from '../../generated/prisma/client.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AppException } from '../exception/app.exception.js';
import { applyEnrollmentCommand } from './enrollment.writer.js';
import { STUDENT_ERRORS } from './student.errors.js';

export interface PrimaryTransferRequest {
  targetVersionId: string;
  trackId?: string;
  fromSemesterId: string;
  basisDecision: string;
}

// Moves the student's active PRIMARY enrollment to another program version. The closed
// enrollment stays as TRANSFERRED history, so returning to an older program later is a
// normal transfer that never rewrites that history.
export async function transferPrimaryEnrollment(
  tx: Prisma.TransactionClient,
  studentId: string,
  request: PrimaryTransferRequest,
  actorId: string,
): Promise<string> {
  const student = await tx.student.findUnique({
    where: { id: studentId },
    select: { updatedAt: true },
  });
  if (!student) throw new AppException(STUDENT_ERRORS.STUDENT_NOT_FOUND);
  const source = await tx.programEnrollment.findFirst({
    where: {
      studentId,
      enrollmentType: EnrollmentType.PRIMARY,
      status: EnrollmentStatus.ACTIVE,
    },
    select: { id: true, updatedAt: true },
  });
  if (!source) throw new AppException(STUDENT_ERRORS.ENROLLMENT_NOT_FOUND);
  return applyEnrollmentCommand(
    tx,
    studentId,
    {
      operation: 'TRANSFER',
      targetVersionId: request.targetVersionId,
      trackId: request.trackId,
      fromSemesterId: request.fromSemesterId,
      basisDecision: request.basisDecision,
      sourceEnrollmentId: source.id,
      expectedStudentUpdatedAt: student.updatedAt.toISOString(),
      expectedEnrollmentUpdatedAt: source.updatedAt.toISOString(),
    },
    actorId,
  );
}
