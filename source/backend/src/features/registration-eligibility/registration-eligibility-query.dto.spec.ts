import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  EligibilityStudentsQueryDto,
  RegistrationEligibilityQueryDto,
} from './dto/registration-eligibility-query.dto.js';

describe('eligibility query DTOs', () => {
  it.each([
    {},
    { programId: '', semesterId: 's' },
    { programId: ['p'], semesterId: 's' },
    { programId: 'p', semesterId: ['s'] },
    { programId: 'p', semesterId: 's', versionId: 'override' },
  ])('rejects missing, array, empty or extra context', async (input) => {
    const errors = await validate(
      plainToInstance(RegistrationEligibilityQueryDto, input),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors.length).toBeGreaterThan(0);
  });
  it('accepts opaque ids and applies paging defaults', async () => {
    expect(
      await validate(
        plainToInstance(RegistrationEligibilityQueryDto, {
          programId: 'opaque',
          semesterId: 'not-a-uuid',
        }),
      ),
    ).toEqual([]);
    const picker = plainToInstance(EligibilityStudentsQueryDto, {
      semesterId: 's',
    });
    expect(await validate(picker)).toEqual([]);
    expect(picker).toMatchObject({ page: 1, pageSize: 20 });
  });
  it.each([
    { q: 'a'.repeat(201) },
    { page: 0 },
    { pageSize: 101 },
    { q: ['array'] },
  ])('validates picker bounds', async (extra) => {
    expect(
      (
        await validate(
          plainToInstance(EligibilityStudentsQueryDto, {
            semesterId: 's',
            ...extra,
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
