import type {
  CohortAssignmentFact,
  CohortVersionResolution,
  IssuedVersionFact,
} from '../../shared/releases/applied-version.types.js';
import { toSemesterDto } from '../../shared/releases/semester.dto.js';
import type {
  AppliedCohortVersionDto,
  CohortVersionAssignmentDto,
} from './dto/cohort-version.dto.js';
import type { IssuedVersionDto } from './dto/version-comparison.dto.js';

export function toIssuedVersionDto(fact: IssuedVersionFact): IssuedVersionDto {
  return {
    id: fact.id,
    versionNumber: fact.versionNumber,
    status: fact.status,
    decisionNumber: fact.decisionNumber,
    effectiveSemester: toSemesterDto(fact.effectiveSemester),
  };
}
export function toCohortAssignmentDto(
  fact: CohortAssignmentFact,
): CohortVersionAssignmentDto {
  return {
    id: fact.id,
    cohort: {
      id: fact.cohort.id,
      cohortCode: fact.cohort.cohortCode,
      intakeYear: fact.cohort.intakeYear,
    },
    version: toIssuedVersionDto(fact.version),
    fromSemester: toSemesterDto(fact.fromSemester),
    createdAt: fact.createdAt.toISOString(),
  };
}
export function toAppliedCohortVersionDto(
  resolution: CohortVersionResolution,
): AppliedCohortVersionDto {
  return {
    programId: resolution.programId,
    cohort: {
      id: resolution.cohort.id,
      cohortCode: resolution.cohort.cohortCode,
      intakeYear: resolution.cohort.intakeYear,
    },
    semester: toSemesterDto(resolution.semester),
    state: resolution.assignment ? 'ASSIGNED' : 'UNASSIGNED',
    assignment: resolution.assignment
      ? toCohortAssignmentDto(resolution.assignment)
      : null,
  };
}
