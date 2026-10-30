import { Injectable } from '@nestjs/common';
import { ProgramVersionStatus } from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { programTarget } from '../../shared/programs/program-target.js';
import type {
  ProgramTimelineDto,
  TimelineEventDto,
  TimelineSemesterDto,
} from './publication.dto.js';
import { PUBLICATION_ERRORS } from './publication.errors.js';

const ISSUED = [
  ProgramVersionStatus.PENDING,
  ProgramVersionStatus.ACTIVE,
  ProgramVersionStatus.HISTORICAL,
];
const SEMESTER_SELECT = {
  id: true,
  semesterCode: true,
  startDate: true,
} as const;
const REF_SELECT = { id: true, versionNumber: true } as const;

const semester = (row: {
  id: string;
  semesterCode: string;
  startDate: Date | null;
}): TimelineSemesterDto => ({
  id: row.id,
  semesterCode: row.semesterCode,
  startDate: row.startDate ? row.startDate.toISOString().slice(0, 10) : null,
});

const time = (value: string | null) =>
  value ? Date.parse(value) : Number.POSITIVE_INFINITY;

// Order of the issued history: effective semester start, then publication time, then id. A version with
// no known start goes last rather than being guessed into place.
export function compareEvents(a: TimelineEventDto, b: TimelineEventDto) {
  return (
    time(a.effectiveSemester?.startDate ?? null) -
      time(b.effectiveSemester?.startDate ?? null) ||
    time(a.publishedAt) - time(b.publishedAt) ||
    a.versionId.localeCompare(b.versionId)
  );
}

// MH-46 — US-112: issued versions only (never a Draft or a request copy), each with the cohorts assigned to it
// from their starting semester. Assignments are stored schedule facts, not a count of students.
@Injectable()
export class VersionTimelineReader {
  constructor(private readonly prisma: PrismaService) {}

  async read(
    access: AccessContext,
    programId: string,
  ): Promise<ProgramTimelineDto> {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: {
        id: true,
        programCode: true,
        facultyId: true,
        versions: {
          where: { status: { in: ISSUED }, sourceRequestId: null },
          select: {
            id: true,
            versionNumber: true,
            status: true,
            programName: true,
            decisionNumber: true,
            publishedAt: true,
            createdAt: true,
            effectiveSemester: { select: SEMESTER_SELECT },
            previousVersion: { select: REF_SELECT },
            correctionOf: { select: REF_SELECT },
            cohortVersions: {
              select: {
                id: true,
                createdAt: true,
                cohort: { select: { cohortCode: true, intakeYear: true } },
                fromSemester: { select: SEMESTER_SELECT },
              },
            },
          },
        },
      },
    });
    const target = program ? programTarget(program) : null;
    if (
      !program ||
      !target ||
      access.modeFor(PERMISSIONS.PROGRAM_VIEW, target) === null ||
      access.modeFor(PERMISSIONS.VERSION_VIEW_HISTORY, target) === null
    )
      throw new AppException(PUBLICATION_ERRORS.PROGRAM_NOT_FOUND);
    const events: TimelineEventDto[] = program.versions.map((version) => ({
      versionId: version.id,
      versionNumber: version.versionNumber,
      status: version.status,
      decisionNumber: version.decisionNumber,
      publishedAt: version.publishedAt?.toISOString() ?? null,
      effectiveSemester: version.effectiveSemester
        ? semester(version.effectiveSemester)
        : null,
      previousVersion: version.previousVersion,
      correctionOf: version.correctionOf,
      assignments: [...version.cohortVersions]
        .sort(
          (a, b) =>
            time(semester(a.fromSemester).startDate) -
              time(semester(b.fromSemester).startDate) ||
            a.cohort.cohortCode.localeCompare(b.cohort.cohortCode),
        )
        .map((assignment) => ({
          id: assignment.id,
          cohortCode: assignment.cohort.cohortCode,
          intakeYear: assignment.cohort.intakeYear,
          fromSemester: semester(assignment.fromSemester),
        })),
    }));
    const newest = [...program.versions].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )[0];
    return {
      programId: program.id,
      programCode: program.programCode,
      programName: newest?.programName ?? program.programCode,
      events: events.sort(compareEvents),
    };
  }
}
