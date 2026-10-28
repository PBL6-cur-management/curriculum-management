import { Injectable } from '@nestjs/common';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { applyEnrollmentCommand } from '../../shared/students/enrollment.writer.js';
import { EnrollmentReconciler } from '../../shared/students/enrollment-reconciler.js';
import { assertStudentEnrollmentWrite } from '../../shared/students/student-access.js';
import { STUDENT_WRITE_TRANSACTION } from '../../shared/students/student.constants.js';
import type {
  ReconcileStudentDto,
  StudentEnrollmentCommandDto,
} from './dto/student-enrollment-command.dto.js';
import type {
  StudentEnrollmentDto,
  StudentReconciliationDto,
} from './dto/student.dto.js';
import { ENROLLMENT_INCLUDE, toEnrollmentDto } from './students.mapper.js';

// Writes return only the new row or the counts; the client refetches the profile.
@Injectable()
export class StudentEnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciler: EnrollmentReconciler,
  ) {}

  async create(
    access: AccessContext,
    studentId: string,
    dto: StudentEnrollmentCommandDto,
  ): Promise<StudentEnrollmentDto> {
    assertStudentEnrollmentWrite(access);
    return this.prisma.$transaction(async (tx) => {
      const id = await applyEnrollmentCommand(
        tx,
        studentId,
        dto,
        access.userId,
      );
      const row = await tx.programEnrollment.findUniqueOrThrow({
        where: { id },
        include: ENROLLMENT_INCLUDE,
      });
      return toEnrollmentDto(row);
    }, STUDENT_WRITE_TRANSACTION);
  }

  async reconcile(
    access: AccessContext,
    studentId: string,
    dto: ReconcileStudentDto,
  ): Promise<StudentReconciliationDto> {
    assertStudentEnrollmentWrite(access);
    return this.reconciler.reconcileStudent(
      studentId,
      dto.expectedStudentUpdatedAt,
    );
  }
}
