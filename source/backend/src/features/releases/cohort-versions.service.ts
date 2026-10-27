import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { assertSchoolWideDirect } from '../../shared/authz/edit-path.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { programTarget } from '../../shared/programs/program-target.js';
import { AppliedProgramVersionReader } from '../../shared/releases/applied-program-version.reader.js';
import { APPLIED_VERSION_ERRORS } from '../../shared/releases/applied-version.errors.js';
import type { CohortAssignmentFact } from '../../shared/releases/applied-version.types.js';
import {
  issuedVersionFact,
  readProgramCohortSchedule,
} from '../../shared/releases/cohort-version-schedule.js';
import {
  lockPrograms,
  RELEASE_TRANSACTION,
} from '../../shared/releases/release-locks.js';
import { RELEASE_ERRORS } from '../../shared/releases/release.errors.js';
import {
  assertCohortsExist,
  requireSemesterStart,
  type StartedSemester,
} from '../../shared/releases/semester-start.js';
import {
  toAppliedCohortVersionDto,
  toCohortAssignmentDto,
} from './cohort-versions.mapper.js';
import type {
  AppliedCohortVersionDto,
  AssignCohortVersionsDto,
  CohortVersionListDto,
  UpdateCohortVersionDto,
} from './dto/cohort-version.dto.js';

@Injectable()
export class CohortVersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appliedVersions: AppliedProgramVersionReader,
  ) {}

  list(
    programId: string,
    access: AccessContext,
  ): Promise<CohortVersionListDto> {
    assertSchoolWideDirect(access, PERMISSIONS.VERSION_ASSIGN_COHORT);
    return this.prisma.$transaction(
      async (tx) => {
        await this.authorize(tx, programId, access);
        return this.schedule(tx, programId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  assign(
    programId: string,
    dto: AssignCohortVersionsDto,
    access: AccessContext,
  ): Promise<CohortVersionListDto> {
    assertSchoolWideDirect(access, PERMISSIONS.VERSION_ASSIGN_COHORT);
    return this.write(programId, access, async (tx) => {
      const schedule = await readProgramCohortSchedule(tx, programId);
      this.assertRevision(schedule.revision, dto.expectedRevision);
      const version = await this.targetVersion(
        tx,
        programId,
        dto.programVersionId,
      );
      const semester = await requireSemesterStart(tx, dto.fromSemesterId);
      this.assertEligible(semester, version.effectiveSemester);
      await assertCohortsExist(tx, dto.cohortIds);
      for (const cohortId of dto.cohortIds) {
        if (
          schedule.assignments.some(
            (row) =>
              row.cohort.id === cohortId && row.version.id === version.id,
          )
        )
          throw new AppException(APPLIED_VERSION_ERRORS.COHORT_VERSION_EXISTS);
        this.assertStartAvailable(schedule.assignments, cohortId, semester);
      }
      await tx.cohortVersion.createMany({
        data: dto.cohortIds.map((cohortId) => ({
          cohortId,
          programVersionId: version.id,
          fromSemesterId: semester.id,
        })),
      });
      return this.schedule(tx, programId);
    });
  }

  update(
    programId: string,
    assignmentId: string,
    dto: UpdateCohortVersionDto,
    access: AccessContext,
  ): Promise<CohortVersionListDto> {
    assertSchoolWideDirect(access, PERMISSIONS.VERSION_ASSIGN_COHORT);
    return this.write(programId, access, async (tx) => {
      const schedule = await readProgramCohortSchedule(tx, programId);
      this.assertRevision(schedule.revision, dto.expectedRevision);
      const assignment = schedule.assignments.find(
        (row) => row.id === assignmentId,
      );
      if (!assignment)
        throw new AppException(APPLIED_VERSION_ERRORS.ASSIGNMENT_NOT_FOUND);
      const version = await this.targetVersion(
        tx,
        programId,
        assignment.version.id,
      );
      const semester = await requireSemesterStart(tx, dto.fromSemesterId);
      this.assertEligible(semester, version.effectiveSemester);
      if (assignment.fromSemester.id === semester.id)
        return this.toList(programId, schedule);
      this.assertStartAvailable(
        schedule.assignments.filter((row) => row.id !== assignmentId),
        assignment.cohort.id,
        semester,
      );
      await tx.cohortVersion.update({
        where: { id: assignment.id },
        data: { fromSemesterId: semester.id },
      });
      return this.schedule(tx, programId);
    });
  }

  applied(
    programId: string,
    cohortId: string,
    semesterId: string,
    access: AccessContext,
  ): Promise<AppliedCohortVersionDto> {
    assertSchoolWideDirect(access, PERMISSIONS.VERSION_ASSIGN_COHORT);
    return this.prisma.$transaction(
      async (tx) => {
        await this.authorize(tx, programId, access);
        return toAppliedCohortVersionDto(
          await this.appliedVersions.forCohort(
            { programId, cohortId, semesterId },
            tx,
          ),
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async authorize(
    tx: Prisma.TransactionClient,
    programId: string,
    access: AccessContext,
  ): Promise<void> {
    assertSchoolWideDirect(access, PERMISSIONS.VERSION_ASSIGN_COHORT);
    const program = await tx.program.findUnique({
      where: { id: programId },
      select: { id: true, facultyId: true },
    });
    if (!program) throw new AppException(RELEASE_ERRORS.PROGRAM_NOT_FOUND);
    access.assertCan(PERMISSIONS.PROGRAM_VIEW, programTarget(program));
  }

  private async write(
    programId: string,
    access: AccessContext,
    operation: (tx: Prisma.TransactionClient) => Promise<CohortVersionListDto>,
  ): Promise<CohortVersionListDto> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await lockPrograms(tx, [programId]);
          await this.authorize(tx, programId, access);
          return operation(tx);
        },
        {
          ...RELEASE_TRANSACTION,
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new AppException(APPLIED_VERSION_ERRORS.COHORT_VERSION_EXISTS);
        if (error.code === 'P2034')
          throw new AppException(
            APPLIED_VERSION_ERRORS.ASSIGNMENT_STATE_CHANGED,
          );
      }
      throw error;
    }
  }
  private async targetVersion(
    tx: Prisma.TransactionClient,
    programId: string,
    versionId: string,
  ) {
    const version = await tx.programVersion.findFirst({
      where: { id: versionId, programId },
      include: { effectiveSemester: true },
    });
    if (!version) throw new AppException(RELEASE_ERRORS.VERSION_NOT_FOUND);
    return issuedVersionFact(version);
  }
  private assertRevision(actual: string, expected: string): void {
    if (actual !== expected)
      throw new AppException(APPLIED_VERSION_ERRORS.ASSIGNMENT_STATE_CHANGED);
  }
  private assertEligible(
    from: StartedSemester,
    effective: StartedSemester,
  ): void {
    if (from.startDate.getTime() < effective.startDate.getTime())
      throw new AppException(APPLIED_VERSION_ERRORS.ASSIGNMENT_BEFORE_VERSION);
  }
  private assertStartAvailable(
    assignments: readonly CohortAssignmentFact[],
    cohortId: string,
    semester: StartedSemester,
  ): void {
    if (
      assignments.some(
        (row) =>
          row.cohort.id === cohortId &&
          row.fromSemester.startDate.getTime() === semester.startDate.getTime(),
      )
    )
      throw new AppException(APPLIED_VERSION_ERRORS.ASSIGNMENT_START_CONFLICT);
  }
  private toList(
    programId: string,
    schedule: { assignments: CohortAssignmentFact[]; revision: string },
  ): CohortVersionListDto {
    return {
      programId,
      revision: schedule.revision,
      assignments: schedule.assignments.map(toCohortAssignmentDto),
    };
  }
  private async schedule(
    tx: Prisma.TransactionClient,
    programId: string,
  ): Promise<CohortVersionListDto> {
    return this.toList(
      programId,
      await readProgramCohortSchedule(tx, programId),
    );
  }
}
