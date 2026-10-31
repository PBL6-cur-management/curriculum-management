import { describe, expect, it } from 'vitest';
import type {
  CohortAssignmentFact,
  CohortVersionResolution,
} from '../../shared/releases/applied-version.types.js';
import {
  toAppliedCohortVersionDto,
  toCohortAssignmentDto,
} from './cohort-versions.mapper.js';

describe('cohort version mappers', () => {
  const date = new Date('2026-01-01T00:00:00.000Z');
  const semester = {
    id: 's',
    semesterCode: 'S',
    academicYear: 'Y',
    termInYear: 1,
    startDate: date,
    startDateEstimated: false,
    createdAt: date,
    updatedAt: date,
  };
  const cohort = { id: 'c', cohortCode: 'K2023', intakeYear: 2023 };
  const assignment: CohortAssignmentFact = {
    id: 'a',
    cohort,
    version: {
      id: 'v',
      programId: 'p',
      versionNumber: '1.0',
      status: 'HISTORICAL',
      decisionNumber: 'QD',
      effectiveSemester: semester,
      publishedAt: date,
    },
    fromSemester: semester,
    createdAt: date,
  };
  it('returns explicit wire fields, ISO dates and string version numbers without internal metadata', () => {
    const dto = toCohortAssignmentDto(assignment);
    expect(dto.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(dto.fromSemester).toEqual({
      id: 's',
      semesterCode: 'S',
      academicYear: 'Y',
      termInYear: 1,
      startDate: '2026-01-01',
      startDateEstimated: false,
    });
    expect(dto.version).toEqual({
      id: 'v',
      versionNumber: '1.0',
      status: 'HISTORICAL',
      decisionNumber: 'QD',
      effectiveSemester: dto.fromSemester,
    });
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
  });
  it('sets state iff assignment is present', () => {
    const resolution: CohortVersionResolution = {
      programId: 'p',
      cohort,
      semester,
      assignment,
    };
    expect(toAppliedCohortVersionDto(resolution)).toMatchObject({
      state: 'ASSIGNED',
      assignment: { id: 'a' },
    });
    expect(
      toAppliedCohortVersionDto({ ...resolution, assignment: null }),
    ).toMatchObject({ state: 'UNASSIGNED', assignment: null });
  });
});
