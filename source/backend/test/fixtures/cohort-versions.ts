import type request from 'supertest';
import type {
  AppliedCohortVersionDto,
  AssignCohortVersionsDto,
  CohortVersionListDto,
} from '../../src/features/releases/dto/cohort-version.dto.js';
import type { CohortVersionLookup } from '../../src/shared/releases/applied-version.types.js';
import { expectFixtureStatus } from './version-comparison.js';

type Agent = ReturnType<typeof request.agent>;
export async function readCohortVersions(
  agent: Agent,
  programId: string,
): Promise<CohortVersionListDto> {
  return (
    await agent
      .get(`/api/programs/${programId}/cohort-versions`)
      .expect(expectFixtureStatus(200))
  ).body as CohortVersionListDto;
}
export async function assignCohorts(
  agent: Agent,
  programId: string,
  input: AssignCohortVersionsDto,
): Promise<CohortVersionListDto> {
  return (
    await agent
      .post(`/api/programs/${programId}/cohort-versions`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send(input)
      .expect(expectFixtureStatus(201))
  ).body as CohortVersionListDto;
}
export async function appliedVersion(
  agent: Agent,
  input: CohortVersionLookup,
): Promise<AppliedCohortVersionDto> {
  return (
    await agent
      .get(
        `/api/programs/${input.programId}/cohorts/${input.cohortId}/applied-version`,
      )
      .query({ semesterId: input.semesterId })
      .expect(expectFixtureStatus(200))
  ).body as AppliedCohortVersionDto;
}
