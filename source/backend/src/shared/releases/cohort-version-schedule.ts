import { createHash } from 'node:crypto';
import type {
  Prisma,
  ProgramVersion,
  Semester,
} from '../../generated/prisma/client.js';
import { AppException } from '../exception/app.exception.js';
import { APPLIED_VERSION_ERRORS } from './applied-version.errors.js';
import type {
  CohortAssignmentFact,
  CohortVersionsLookup,
  CohortVersionResolution,
  IssuedVersionFact,
} from './applied-version.types.js';
import { RELEASE_ERRORS } from './release.errors.js';
import {
  requireSemesterStart,
  type StartedSemester,
} from './semester-start.js';

const LINK_INCLUDE = {
  cohort: true,
  fromSemester: true,
  programVersion: { include: { effectiveSemester: true } },
} as const satisfies Prisma.CohortVersionInclude;
type LinkRow = Prisma.CohortVersionGetPayload<{ include: typeof LINK_INCLUDE }>;

export function startedSemester(semester: Semester): StartedSemester {
  if (!semester.startDate)
    throw new AppException(RELEASE_ERRORS.SEMESTER_START_UNKNOWN);
  return { ...semester, startDate: semester.startDate };
}

export function issuedVersionFact(
  version: ProgramVersion & { effectiveSemester: Semester | null },
): IssuedVersionFact {
  if (
    version.status === 'DRAFT' ||
    version.sourceRequestId !== null ||
    !version.versionNumber ||
    !version.decisionNumber ||
    !version.publishedAt ||
    !version.effectiveSemester
  ) {
    throw new AppException(APPLIED_VERSION_ERRORS.VERSION_NOT_ISSUED);
  }
  return {
    id: version.id,
    programId: version.programId,
    versionNumber: version.versionNumber,
    status: version.status,
    decisionNumber: version.decisionNumber,
    effectiveSemester: startedSemester(version.effectiveSemester),
    publishedAt: version.publishedAt,
  };
}

function normalizeAssignment(row: LinkRow): CohortAssignmentFact {
  let version: IssuedVersionFact;
  try {
    version = issuedVersionFact(row.programVersion);
  } catch (error) {
    if (
      error instanceof AppException &&
      error.code === APPLIED_VERSION_ERRORS.VERSION_NOT_ISSUED.code
    )
      throw new AppException(APPLIED_VERSION_ERRORS.INVALID_COHORT_ASSIGNMENT);
    throw error;
  }
  const fromSemester = startedSemester(row.fromSemester);
  if (
    fromSemester.startDate.getTime() <
    version.effectiveSemester.startDate.getTime()
  )
    throw new AppException(APPLIED_VERSION_ERRORS.INVALID_COHORT_ASSIGNMENT);
  return {
    id: row.id,
    cohort: {
      id: row.cohort.id,
      cohortCode: row.cohort.cohortCode,
      intakeYear: row.cohort.intakeYear,
    },
    version,
    fromSemester,
    createdAt: row.createdAt,
  };
}

export function compareAssignmentsNewestFirst(
  left: CohortAssignmentFact,
  right: CohortAssignmentFact,
): number {
  return (
    right.fromSemester.startDate.getTime() -
      left.fromSemester.startDate.getTime() ||
    right.createdAt.getTime() - left.createdAt.getTime() ||
    (left.id === right.id ? 0 : left.id < right.id ? 1 : -1)
  );
}
export function pickAppliedAssignment(
  rows: readonly CohortAssignmentFact[],
  semester: StartedSemester,
): CohortAssignmentFact | null {
  return (
    rows
      .filter(
        (row) =>
          row.fromSemester.startDate.getTime() <= semester.startDate.getTime(),
      )
      .sort(compareAssignmentsNewestFirst)[0] ?? null
  );
}

export async function readCohortResolutions(
  tx: Prisma.TransactionClient,
  input: CohortVersionsLookup,
): Promise<CohortVersionResolution[]> {
  const cohortIds = [...new Set(input.cohortIds)];
  if (cohortIds.length === 0) return [];
  const program = await tx.program.findUnique({
    where: { id: input.programId },
    select: { id: true },
  });
  if (!program) throw new AppException(RELEASE_ERRORS.PROGRAM_NOT_FOUND);
  const cohorts = await tx.cohort.findMany({
    where: { id: { in: cohortIds } },
    select: { id: true, cohortCode: true, intakeYear: true },
  });
  if (cohorts.length !== cohortIds.length)
    throw new AppException(RELEASE_ERRORS.COHORT_NOT_FOUND);
  const semester = await requireSemesterStart(tx, input.semesterId);
  const links = await tx.cohortVersion.findMany({
    where: {
      cohortId: { in: cohortIds },
      programVersion: { programId: input.programId },
    },
    include: LINK_INCLUDE,
  });
  const byCohort = new Map<string, CohortAssignmentFact[]>();
  for (const row of links) {
    const fact = normalizeAssignment(row);
    const rows = byCohort.get(fact.cohort.id) ?? [];
    rows.push(fact);
    byCohort.set(fact.cohort.id, rows);
  }
  return cohortIds.map((cohortId) => ({
    programId: input.programId,
    cohort: cohorts.find((cohort) => cohort.id === cohortId)!,
    semester,
    assignment: pickAppliedAssignment(byCohort.get(cohortId) ?? [], semester),
  }));
}

export const ASSIGNMENT_REVISION_VERSION = 1;
export const ASSIGNMENT_REVISION_ALGORITHM = 'sha256';
export interface ScheduleRevisionInput {
  programId: string;
  links: readonly {
    id: string;
    cohortId: string;
    programVersionId: string;
    fromSemesterId: string;
    createdAt: string;
  }[];
  semesters: readonly { id: string; startDate: string | null }[];
}
export function assignmentRevision(input: ScheduleRevisionInput): string {
  const compareIds = (left: { id: string }, right: { id: string }) =>
    left.id === right.id ? 0 : left.id < right.id ? -1 : 1;
  const links = [...input.links].sort(compareIds).map((row) => ({
    id: row.id,
    cohortId: row.cohortId,
    programVersionId: row.programVersionId,
    fromSemesterId: row.fromSemesterId,
    createdAt: row.createdAt,
  }));
  const semesters = [...input.semesters]
    .sort(compareIds)
    .map((row) => ({ id: row.id, startDate: row.startDate }));
  return createHash(ASSIGNMENT_REVISION_ALGORITHM)
    .update(
      JSON.stringify({
        version: ASSIGNMENT_REVISION_VERSION,
        programId: input.programId,
        links,
        semesters,
      }),
    )
    .digest('hex');
}
export async function readProgramCohortSchedule(
  tx: Prisma.TransactionClient,
  programId: string,
): Promise<{ assignments: CohortAssignmentFact[]; revision: string }> {
  const links = await tx.cohortVersion.findMany({
    where: { programVersion: { programId } },
    include: LINK_INCLUDE,
  });
  const semesters = await tx.semester.findMany({
    select: { id: true, startDate: true },
  });
  return {
    assignments: links
      .map(normalizeAssignment)
      .sort(compareAssignmentsNewestFirst),
    revision: assignmentRevision({
      programId,
      links: links.map((row) => ({
        id: row.id,
        cohortId: row.cohortId,
        programVersionId: row.programVersionId,
        fromSemesterId: row.fromSemesterId,
        createdAt: row.createdAt.toISOString(),
      })),
      semesters: semesters.map((row) => ({
        id: row.id,
        startDate: row.startDate?.toISOString() ?? null,
      })),
    }),
  };
}
