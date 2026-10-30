import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { AccessContext } from '../authz/access-context.js';
import { AppException } from '../exception/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RELEASE_ERRORS } from '../releases/release.errors.js';
import {
  requireSemesterStart,
  type StartedSemester,
} from '../releases/semester-start.js';
import type { AcademicAttemptFact } from './best-academic-results.js';
import { coversSemester } from './enrollment-period.js';
import {
  assertStudentProgramRead,
  readsWithoutEnrollment,
  requireGraduationReauditLookup,
  type StudentReadPurpose,
} from './student-access.js';
import type { StudentAppliedVersionLookup } from './student-applied-version.types.js';
import { STUDENT_ERRORS } from './student.errors.js';

export interface StudentAttemptReader {
  forStudent(
    input: StudentAppliedVersionLookup,
    tx?: Prisma.TransactionClient,
  ): Promise<AcademicAttemptFact[]>;
}

// Attempts are the student's whole transcript up to the requested semester, not limited to the current program's courses: transfers and equivalences need earlier ones.
@Injectable()
export class AcademicResultsReader {
  constructor(private readonly prisma: PrismaService) {}

  forAccess(
    access: AccessContext,
    purpose: StudentReadPurpose,
  ): StudentAttemptReader {
    return {
      forStudent: (input, tx) =>
        tx
          ? this.read(tx, access, purpose, input)
          : this.prisma.$transaction(
              (current) => this.read(current, access, purpose, input),
              {
                isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
              },
            ),
    };
  }

  // The access decision for one student/program/semester; the HTTP result list and the attempt facts share it.
  async authorizeRead(
    db: Prisma.TransactionClient,
    access: AccessContext,
    purpose: StudentReadPurpose,
    input: StudentAppliedVersionLookup,
  ) {
    const semester = await requireSemesterStart(db, input.semesterId);
    const student = await db.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, userId: true },
    });
    if (!student) throw new AppException(STUDENT_ERRORS.STUDENT_NOT_FOUND);
    assertStudentProgramRead(access, purpose, student, input.programId);

    if (!readsWithoutEnrollment(access, purpose, student)) {
      const enrollments = await db.programEnrollment.findMany({
        where: { studentId: student.id, programId: input.programId },
        select: {
          fromSemester: { select: { startDate: true } },
          untilSemester: { select: { startDate: true } },
        },
      });
      const covered = enrollments.some((row) =>
        coversSemester(
          {
            fromStart: row.fromSemester.startDate,
            untilSemester: row.untilSemester,
          },
          semester.startDate,
        ),
      );
      if (!covered) throw new AppException(STUDENT_ERRORS.STUDENT_NOT_FOUND);
    }
    return { student, semester };
  }

  private async read(
    db: Prisma.TransactionClient,
    access: AccessContext,
    purpose: StudentReadPurpose,
    input: StudentAppliedVersionLookup,
  ): Promise<AcademicAttemptFact[]> {
    const { semester } = await this.authorizeRead(db, access, purpose, input);
    return this.readAuthorized(db, input, semester);
  }

  async forReauditTask(
    taskId: string,
    leaseToken: string,
    tx: Prisma.TransactionClient,
  ) {
    const lookup = await requireGraduationReauditLookup(taskId, leaseToken, tx);
    return {
      forStudent: async () => {
        await requireGraduationReauditLookup(taskId, leaseToken, tx);
        return this.readAuthorized(
          tx,
          lookup,
          await requireSemesterStart(tx, lookup.semesterId),
        );
      },
    };
  }

  private async readAuthorized(
    db: Prisma.TransactionClient,
    input: StudentAppliedVersionLookup,
    semester: StartedSemester,
  ): Promise<AcademicAttemptFact[]> {
    const rows = await db.academicResult.findMany({
      where: { studentId: input.studentId },
      include: { semester: { select: { startDate: true } } },
    });
    const attempts: AcademicAttemptFact[] = [];
    for (const row of rows) {
      const start = row.semester.startDate;
      if (!start) throw new AppException(RELEASE_ERRORS.SEMESTER_START_UNKNOWN);
      if (start.getTime() > semester.startDate.getTime()) continue;
      attempts.push({
        id: row.id,
        studentId: row.studentId,
        courseId: row.courseId,
        semesterId: row.semesterId,
        semesterStart: start,
        score10: row.score10?.toString() ?? null,
        score4: row.score4?.toString() ?? null,
        letterGrade: row.letterGrade,
        status: row.status,
        dataSource: row.dataSource,
        revision: row.revision,
      });
    }
    return attempts.sort(
      (a, b) =>
        a.semesterStart.getTime() - b.semesterStart.getTime() ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  }
}
