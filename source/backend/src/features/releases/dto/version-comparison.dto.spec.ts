import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { VersionComparisonQueryDto } from './version-comparison.dto.js';

describe('VersionComparisonQueryDto', () => {
  it('accepts opaque ids and identical endpoints', async () => {
    expect(
      await validate(
        plainToInstance(VersionComparisonQueryDto, {
          beforeVersionId: 'cuid2',
          afterVersionId: 'cuid2',
        }),
      ),
    ).toEqual([]);
  });
  it.each([
    {},
    { beforeVersionId: '', afterVersionId: 'id' },
    { beforeVersionId: 'id' },
    { beforeVersionId: 4, afterVersionId: 'id' },
  ])('requires two nonempty string ids: %j', async (query) => {
    expect(
      await validate(plainToInstance(VersionComparisonQueryDto, query)),
    ).not.toEqual([]);
  });
});
