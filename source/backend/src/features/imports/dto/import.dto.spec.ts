import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateImportDto, ImportListQueryDto } from './import.dto.js';

describe('import request DTOs', () => {
  it('requires an enum type and rejects an empty version id', async () => {
    expect(
      await validate(
        plainToInstance(CreateImportDto, { importType: 'INVALID' }),
      ),
    ).toHaveLength(1);
    expect(
      await validate(
        plainToInstance(CreateImportDto, {
          importType: 'CURRICULUM',
          versionId: '',
        }),
      ),
    ).toHaveLength(1);
    expect(
      await validate(
        plainToInstance(CreateImportDto, {
          importType: 'CURRICULUM',
          versionId: 'v',
        }),
      ),
    ).toEqual([]);
  });
  it.each([
    ['true', true],
    ['false', false],
  ])('parses mine=%s', async (value, expected) => {
    const query = plainToInstance(ImportListQueryDto, { mine: value });
    expect(query.mine).toBe(expected);
    expect(await validate(query)).toEqual([]);
  });
  it('rejects invalid booleans and page bounds instead of silently coercing', async () => {
    expect(
      (
        await validate(
          plainToInstance(ImportListQueryDto, { mine: 'maybe', pageSize: 101 }),
        )
      )
        .map((error) => error.property)
        .sort(),
    ).toEqual(['mine', 'pageSize']);
  });
});
