import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { AccessContext } from '../authz/access-context.js';
import { AppException } from '../exception/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppliedProgramVersionReader } from '../releases/applied-program-version.reader.js';
import { APPLIED_VERSION_ERRORS } from '../releases/applied-version.errors.js';
import { issuedVersionFact } from '../releases/cohort-version-schedule.js';
import { requireSemesterStart } from '../releases/semester-start.js';
import { coversSemester } from './enrollment-period.js';
import {
  assertStudentProgramRead,
  type StudentReadPurpose,
} from './student-access.js';
import type {
  StudentAppliedVersionLookup,
  StudentAppliedVersionResolver,
  StudentAppliedVersionResult,
} from './student-applied-version.types.js';
import { STUDENT_ERRORS } from './student.errors.js';

const ENROLLMENT_INCLUDE = {
  fromSemester: true,
  untilSemester: true,
  appliedVersion: { include: { effectiveSemester: true } },
} as const satisfies Prisma.ProgramEnrollmentInclude;

// Read-only: answers "which program version applies to this student in this semester" from the enrollment chain, never from a guess.
@Injectable()
export class StudentAppliedVersionReader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cohortVersions: AppliedProgramVersionReader,
  ) {}

  forAccess(
    access: AccessContext,
    purpose: StudentReadPurpose,
  ): StudentAppliedVersionResolver {
    return {
      resolveForStudent: async (input, tx) =>
        (await this.resolveManyForAccess(access, purpose, [input], tx))[0]!,
    };
  }

  async resolveManyForAccess(
    access: AccessContext,
    purpose: StudentReadPurpose,
    inputs: StudentAppliedVersionLookup[],
    tx?: Prisma.TransactionClient,
  ): Promise<StudentAppliedVersionResult[]> {
    if (tx) return this.resolve(tx, access, purpose, inputs);
    return this.prisma.$transaction(
      (current) => this.resolve(current, access, purpose, inputs),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async resolve(
    db: Prisma.TransactionClient,
    access: AccessContext,
    purpose: StudentReadPurpose,
    inputs: StudentAppliedVersionLookup[],
  ): Promise<StudentAppliedVersionResult[]> {
    const semesters = new Map<
      string,
      Awaited<ReturnType<typeof requireSemesterStart>>
    >();
    for (const id of new Set(inputs.map((input) => input.semesterId)))
      semesters.set(id, await requireSemesterStart(db, id));

    const students = await db.student.findMany({
      where: {
        id: { in: [...new Set(inputs.map((input) => input.studentId))] },
      },
      select: { id: true, userId: true },
    });
    const studentById = new Map(
      students.map((student) => [student.id, student]),
    );
    for (const input of inputs) {
      const student = studentById.get(input.studentId);
      if (!student) throw new AppException(STUDENT_ERRORS.STUDENT_NOT_FOUND);
      assertStudentProgramRead(access, purpose, student, input.programId);
    }

    const enrollments = await db.programEnrollment.findMany({
      where: {
        OR: inputs.map((input) => ({
          studentId: input.studentId,
          programId: input.programId,
        })),
      },
      include: ENROLLMENT_INCLUDE,
    });

    const results: (StudentAppliedVersionResult | null)[] = inputs.map(
      () => null,
    );
    const cohortWork = new Map<
      string,
      { programId: string; semesterId: string; items: CohortItem[] }
    >();
    inputs.forEach((input, index) => {
      const semester = semesters.get(input.semesterId)!;
      const covering = enrollments.filter(
        (row) =>
          row.studentId === input.studentId &&
          row.programId === input.programId &&
          coversSemester(
            {
              fromStart: row.fromSemester.startDate,
              untilStart: row.untilSemester?.startDate ?? null,
            },
            semester.startDate,
          ),
      );
      if (covering.length === 0)
        throw new AppException(STUDENT_ERRORS.ENROLLMENT_NOT_FOUND);
      if (covering.length > 1)
        throw new AppException(STUDENT_ERRORS.ENROLLMENT_AMBIGUOUS);
      const row = covering[0]!;
      if (!row.fromSemester.startDate)
        throw new AppException(STUDENT_ERRORS.INVALID_ENROLLMENT_INTERVAL);
      if (row.isException) {
        const version = issuedVersionFact(row.appliedVersion);
        if (
          version.programId !== input.programId ||
          version.effectiveSemester.startDate.getTime() >
            semester.startDate.getTime()
        )
          throw new AppException(
            APPLIED_VERSION_ERRORS.INVALID_COHORT_ASSIGNMENT,
          );
        results[index] = {
          studentId: input.studentId,
          enrollmentId: row.id,
          programId: input.programId,
          semesterId: input.semesterId,
          programVersionId: version.id,
          source: 'EXCEPTION',
          cohortAssignmentId: null,
        };
        return;
      }
      const key = `${input.programId}|${input.semesterId}`;
      const group = cohortWork.get(key) ?? {
        programId: input.programId,
        semesterId: input.semesterId,
        items: [],
      };
      group.items.push({
        index,
        input,
        cohortId: row.cohortId,
        enrollmentId: row.id,
      });
      cohortWork.set(key, group);
    });

    for (const group of cohortWork.values()) {
      const resolutions = await this.cohortVersions.forCohorts(
        {
          programId: group.programId,
          cohortIds: [...new Set(group.items.map((item) => item.cohortId))],
          semesterId: group.semesterId,
        },
        db,
      );
      const byCohort = new Map(
        resolutions.map((resolution) => [resolution.cohort.id, resolution]),
      );
      for (const item of group.items) {
        const assignment = byCohort.get(item.cohortId)?.assignment;
        if (!assignment)
          throw new AppException(STUDENT_ERRORS.APPLIED_VERSION_UNRESOLVED);
        results[item.index] = {
          studentId: item.input.studentId,
          enrollmentId: item.enrollmentId,
          programId: group.programId,
          semesterId: group.semesterId,
          programVersionId: assignment.version.id,
          source: 'COHORT',
          cohortAssignmentId: assignment.id,
        };
      }
    }
    return results as StudentAppliedVersionResult[];
  }
}

interface CohortItem {
  index: number;
  input: StudentAppliedVersionLookup;
  cohortId: string;
  enrollmentId: string;
}
