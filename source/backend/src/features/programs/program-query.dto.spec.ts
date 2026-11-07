import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ProgramQueryDto } from './program-query.dto.js';

async function errorsFor(plain: Record<string, unknown>) {
  return validate(plainToInstance(ProgramQueryDto, plain));
}

describe('ProgramQueryDto years', () => {
  it('accepts numeric strings in range', async () => {
    expect(
      await errorsFor({ releaseYear: '2026', intakeYear: '2021' }),
    ).toEqual([]);
  });

  it.each([
    { releaseYear: 'abc' },
    { releaseYear: '1899' },
    { intakeYear: '2101' },
    { intakeYear: '2020.5' },
  ])('rejects %o', async (plain) => {
    expect((await errorsFor(plain)).length).toBeGreaterThan(0);
  });
});
