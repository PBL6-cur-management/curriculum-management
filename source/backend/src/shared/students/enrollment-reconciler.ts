import { Injectable, Logger } from '@nestjs/common';
import { EnrollmentStatus, Prisma } from '../../generated/prisma/client.js';
import { AppException } from '../exception/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppliedProgramVersionReader } from '../releases/applied-program-version.reader.js';
import type { CohortAssignmentFact } from '../releases/applied-version.types.js';
import { readProgramCohortSchedule } from '../releases/cohort-version-schedule.js';
import { lockPrograms } from '../releases/release-locks.js';
import type { StartedSemester } from '../releases/semester-start.js';
import { todayDate } from '../time/today.js';
import { lockStudents } from './student-locks.js';
import { STUDENT_WRITE_TRANSACTION } from './student.constants.js';
import { STUDENT_ERRORS } from './student.errors.js';

export const RECONCILIATION_BLOCKED_CODE =
  'RETROACTIVE_COHORT_RECONCILIATION_REQUIRED';

export interface ReconciliationCounts {
  transitioned: number;
  unchanged: number;
  blocked: number;
}

const TIP_INCLUDE = {
  fromSemester: true,
  cohortAssignment: { include: { fromSemester: true } },
} as const satisfies Prisma.ProgramEnrollmentInclude;
type Tip = Prisma.ProgramEnrollmentGetPayload<{ include: typeof TIP_INCLUDE }>;

// Catches up the normal (non-exception) enrollment chains of one program with its cohort schedule; running it twice changes nothing.
@Injectable()
export class EnrollmentReconciler {
  private readonly logger = new Logger(EnrollmentReconciler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appliedVersions: AppliedProgramVersionReader,
  ) {}

  reconcileProgram(
    programId: string,
    throughDay: Date = todayDate(),
  ): Promise<ReconciliationCounts> {
    return this.prisma.$transaction(
      (tx) => this.reconcile(tx, programId, throughDay),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...STUDENT_WRITE_TRANSACTION,
      },
    );
  }

  // Same algorithm as the program run, limited to one student's open rows; the revision token must still match once the student is locked.
  reconcileStudent(
    studentId: string,
    expectedUpdatedAt: string,
    throughDay: Date = todayDate(),
  ): Promise<ReconciliationCounts> {
    return this.prisma.$transaction(
      async (tx) => {
        const tips = await tx.programEnrollment.findMany({
          where: {
            studentId,
            isException: false,
            status: EnrollmentStatus.ACTIVE,
            nextEnrollment: { is: null },
          },
          select: { programId: true },
        });
        const programIds = [...new Set(tips.map((tip) => tip.programId))];
        await lockPrograms(tx, programIds);
        await lockStudents(tx, [studentId]);
        const student = await tx.student.findUnique({
          where: { id: studentId },
          select: { updatedAt: true },
        });
        if (!student) throw new AppException(STUDENT_ERRORS.STUDENT_NOT_FOUND);
        if (student.updatedAt.toISOString() !== expectedUpdatedAt) {
          throw new AppException(STUDENT_ERRORS.ENROLLMENT_STATE_CHANGED);
        }
        const total: ReconciliationCounts = {
          transitioned: 0,
          unchanged: 0,
          blocked: 0,
        };
        for (const programId of programIds.sort()) {
          const counts = await this.reconcile(
            tx,
            programId,
            throughDay,
            studentId,
          );
          total.transitioned += counts.transitioned;
          total.unchanged += counts.unchanged;
          total.blocked += counts.blocked;
        }
        return total;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...STUDENT_WRITE_TRANSACTION,
      },
    );
  }

  private async reconcile(
    tx: Prisma.TransactionClient,
    programId: string,
    throughDay: Date,
    onlyStudentId?: string,
  ): Promise<ReconciliationCounts> {
    const counts: ReconciliationCounts = {
      transitioned: 0,
      unchanged: 0,
      blocked: 0,
    };
    await lockPrograms(tx, [programId]);
    const schedule = await readProgramCohortSchedule(tx, programId);
    const boundaries = this.boundariesByCohort(
      schedule.assignments,
      throughDay,
    );
    const tips = await tx.programEnrollment.findMany({
      where: {
        programId,
        ...(onlyStudentId ? { studentId: onlyStudentId } : {}),
        isException: false,
        status: EnrollmentStatus.ACTIVE,
        nextEnrollment: { is: null },
      },
      include: TIP_INCLUDE,
      orderBy: { id: 'asc' },
    });
    for (const tip of tips) {
      if (this.isRetroactive(tip)) {
        counts.blocked += 1;
        this.logger.warn(
          `${RECONCILIATION_BLOCKED_CODE} enrollment=${tip.id} assignment=${tip.cohortAssignmentId}`,
        );
        continue;
      }
      await lockStudents(tx, [tip.studentId]);
      const moved = await this.advance(
        tx,
        tip,
        boundaries.get(tip.cohortId) ?? [],
      );
      if (moved) counts.transitioned += 1;
      else counts.unchanged += 1;
    }
    return counts;
  }

  // Distinct semesters at which a cohort's schedule changes, oldest first, none later than throughDay.
  private boundariesByCohort(
    assignments: readonly CohortAssignmentFact[],
    throughDay: Date,
  ): Map<string, StartedSemester[]> {
    const result = new Map<string, StartedSemester[]>();
    for (const assignment of assignments) {
      const start = assignment.fromSemester;
      if (start.startDate.getTime() > throughDay.getTime()) continue;
      const list = result.get(assignment.cohort.id) ?? [];
      if (!list.some((item) => item.id === start.id)) list.push(start);
      result.set(assignment.cohort.id, list);
    }
    for (const list of result.values()) {
      list.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    }
    return result;
  }

  // The link this row was built from now points somewhere else, so the row cannot be advanced from it without rewriting history.
  private isRetroactive(tip: Tip): boolean {
    const link = tip.cohortAssignment;
    if (!link) return false;
    return (
      link.programVersionId !== tip.appliedVersionId ||
      (!!link.fromSemester.startDate &&
        !!tip.fromSemester.startDate &&
        link.fromSemester.startDate.getTime() >
          tip.fromSemester.startDate.getTime())
    );
  }

  private async advance(
    tx: Prisma.TransactionClient,
    tip: Tip,
    boundaries: readonly StartedSemester[],
  ): Promise<boolean> {
    const fresh = await tx.programEnrollment.findUnique({
      where: { id: tip.id },
      select: { status: true, nextEnrollment: { select: { id: true } } },
    });
    if (
      !fresh ||
      fresh.status !== EnrollmentStatus.ACTIVE ||
      fresh.nextEnrollment
    ) {
      return false;
    }
    let current = {
      id: tip.id,
      appliedVersionId: tip.appliedVersionId,
      fromStart: tip.fromSemester.startDate,
    };
    let moved = false;
    for (const boundary of boundaries) {
      if (
        !current.fromStart ||
        boundary.startDate.getTime() <= current.fromStart.getTime()
      ) {
        continue;
      }
      const { assignment } = await this.appliedVersions.forCohort(
        {
          programId: tip.programId,
          cohortId: tip.cohortId,
          semesterId: boundary.id,
        },
        tx,
      );
      if (!assignment || assignment.version.id === current.appliedVersionId)
        continue;
      await tx.programEnrollment.update({
        where: { id: current.id },
        data: {
          status: EnrollmentStatus.TRANSFERRED,
          untilSemesterId: boundary.id,
        },
      });
      const created = await tx.programEnrollment.create({
        data: {
          studentId: tip.studentId,
          programId: tip.programId,
          cohortId: tip.cohortId,
          appliedVersionId: assignment.version.id,
          admissionVersionId: tip.admissionVersionId,
          cohortAssignmentId: assignment.id,
          fromSemesterId: boundary.id,
          previousEnrollmentId: current.id,
          enrollmentType: tip.enrollmentType,
          isException: false,
          status: EnrollmentStatus.ACTIVE,
          createdById: null,
        },
        select: { id: true },
      });
      current = {
        id: created.id,
        appliedVersionId: assignment.version.id,
        fromStart: boundary.startDate,
      };
      moved = true;
    }
    if (moved) {
      await tx.student.update({
        where: { id: tip.studentId },
        data: { updatedAt: new Date() },
      });
    }
    return moved;
  }
}
