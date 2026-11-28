import { HttpStatus, Injectable } from '@nestjs/common';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { setEnrollmentTrack } from '../../shared/students/enrollment.writer.js';
import { transferPrimaryEnrollment } from '../../shared/students/enrollment-transfer.js';
import { assertStudentEnrollmentWrite } from '../../shared/students/student-access.js';
import { normalizeStudentCode } from '../../shared/students/student-identity.js';
import { STUDENT_WRITE_TRANSACTION } from '../../shared/students/student.constants.js';
import { STUDENT_ERRORS } from '../../shared/students/student.errors.js';
import type {
  BulkTransferDto,
  BulkTransferResultDto,
  SetEnrollmentTrackDto,
} from './dto/student-transfer.dto.js';
import type { StudentEnrollmentDto } from './dto/student.dto.js';
import { ENROLLMENT_INCLUDE, toEnrollmentDto } from './students.mapper.js';

const UNKNOWN_FAILURE = 'Không thể chuyển chương trình cho sinh viên này.';
const EMPTY_SELECTION = {
  status: HttpStatus.BAD_REQUEST,
  code: 'BULK_TRANSFER_EMPTY_SELECTION',
  message: 'Cần chọn ít nhất một sinh viên (studentIds hoặc studentCodes).',
} as const;

// Every student is transferred in its own transaction, so one failure never blocks the rest.
@Injectable()
export class StudentTransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async bulkTransfer(
    access: AccessContext,
    dto: BulkTransferDto,
  ): Promise<BulkTransferResultDto> {
    assertStudentEnrollmentWrite(access);
    const ids = [...new Set(dto.studentIds ?? [])];
    const codes = [
      ...new Set((dto.studentCodes ?? []).map(normalizeStudentCode)),
    ];
    if (ids.length === 0 && codes.length === 0)
      throw new AppException(EMPTY_SELECTION);

    const found = await this.prisma.student.findMany({
      where: {
        OR: [
          ...(ids.length ? [{ id: { in: ids } }] : []),
          ...(codes.length ? [{ studentCode: { in: codes } }] : []),
        ],
      },
      select: { id: true, studentCode: true },
      orderBy: { studentCode: 'asc' },
    });
    const results: BulkTransferResultDto['results'] = [];
    const seen = new Set(found.flatMap((row) => [row.id, row.studentCode]));
    for (const key of [...ids, ...codes])
      if (!seen.has(key))
        results.push({
          studentCode: key,
          status: 'FAILED',
          errorMessage: STUDENT_ERRORS.STUDENT_NOT_FOUND.message,
        });
    for (const student of found) {
      try {
        const newEnrollmentId = await this.prisma.$transaction(
          (tx) =>
            transferPrimaryEnrollment(
              tx,
              student.id,
              {
                targetVersionId: dto.targetVersionId,
                trackId: dto.trackId,
                fromSemesterId: dto.fromSemesterId,
                basisDecision: dto.basisDecision,
              },
              access.userId,
            ),
          STUDENT_WRITE_TRANSACTION,
        );
        results.push({
          studentCode: student.studentCode,
          status: 'OK',
          newEnrollmentId,
        });
      } catch (error) {
        results.push({
          studentCode: student.studentCode,
          status: 'FAILED',
          errorMessage:
            error instanceof AppException ? error.message : UNKNOWN_FAILURE,
        });
      }
    }
    const succeeded = results.filter((row) => row.status === 'OK').length;
    return {
      total: results.length,
      succeeded,
      failed: results.length - succeeded,
      results,
    };
  }

  async setTrack(
    access: AccessContext,
    studentId: string,
    enrollmentId: string,
    dto: SetEnrollmentTrackDto,
  ): Promise<StudentEnrollmentDto> {
    assertStudentEnrollmentWrite(access);
    return this.prisma.$transaction(async (tx) => {
      await setEnrollmentTrack(
        tx,
        studentId,
        enrollmentId,
        dto.trackId ?? null,
        {
          expectedEnrollmentUpdatedAt: dto.expectedEnrollmentUpdatedAt,
        },
      );
      const row = await tx.programEnrollment.findUniqueOrThrow({
        where: { id: enrollmentId },
        include: ENROLLMENT_INCLUDE,
      });
      return toEnrollmentDto(row);
    }, STUDENT_WRITE_TRANSACTION);
  }
}
