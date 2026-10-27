import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  AppliedVersionQueryDto,
  AssignCohortVersionsDto,
  UpdateCohortVersionDto,
} from './cohort-version.dto.js';

const valid = {
  cohortIds: ['cohort'],
  programVersionId: 'version',
  fromSemesterId: 'semester',
  expectedRevision: 'a'.repeat(64),
};
describe('cohort version DTOs', () => {
  it('accepts an explicit batch', async () => {
    expect(
      await validate(plainToInstance(AssignCohortVersionsDto, valid)),
    ).toEqual([]);
  });
  it.each([
    { cohortIds: [] },
    { cohortIds: ['a', 'a'] },
    { cohortIds: [''] },
    { cohortIds: [1] },
    { cohortIds: Array.from({ length: 51 }, (_, index) => String(index)) },
    { programVersionId: '' },
    { fromSemesterId: '' },
    { expectedRevision: 'A'.repeat(64) },
    { expectedRevision: 'a'.repeat(63) },
  ])('rejects invalid batch %j', async (patch) => {
    expect(
      await validate(
        plainToInstance(AssignCohortVersionsDto, { ...valid, ...patch }),
      ),
    ).not.toEqual([]);
  });
  it('requires an explicit query semester', async () => {
    expect(await validate(new AppliedVersionQueryDto())).not.toEqual([]);
    expect(
      await validate(
        plainToInstance(AppliedVersionQueryDto, { semesterId: 'opaque' }),
      ),
    ).toEqual([]);
  });
  it('rejects patch identity fields under the application whitelist', async () => {
    const dto = plainToInstance(UpdateCohortVersionDto, {
      fromSemesterId: 's',
      expectedRevision: valid.expectedRevision,
      cohortId: 'other',
    });
    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'cohortId' }),
      ]),
    );
  });
});
