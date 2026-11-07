import { describe, expect, it } from 'vitest';
import { ProgramVersionStatus } from '../../generated/prisma/client.js';
import {
  isReleased,
  releaseYearOf,
  releaseYearWhere,
} from './program-release-year.js';

describe('releaseYearOf', () => {
  it('prefers the signed date', () => {
    expect(
      releaseYearOf(
        new Date('2024-06-01T00:00:00.000Z'),
        new Date('2025-01-01T00:00:00.000Z'),
      ),
    ).toBe(2024);
  });

  it('falls back to the publication instant read in the app zone', () => {
    expect(releaseYearOf(null, new Date('2025-12-31T18:00:00.000Z'))).toBe(
      2026,
    );
  });

  it('is null with neither date', () => {
    expect(releaseYearOf(null, null)).toBeNull();
  });
});

describe('releaseYearWhere', () => {
  it('bounds the signed date in UTC and the publication instant in the app zone', () => {
    expect(releaseYearWhere(2026)).toEqual({
      OR: [
        {
          signedDate: {
            gte: new Date('2026-01-01T00:00:00.000Z'),
            lt: new Date('2027-01-01T00:00:00.000Z'),
          },
        },
        {
          signedDate: null,
          publishedAt: {
            gte: new Date('2025-12-31T17:00:00.000Z'),
            lt: new Date('2026-12-31T17:00:00.000Z'),
          },
        },
      ],
    });
  });
});

describe('isReleased', () => {
  it('excludes Draft', () => {
    expect(isReleased(ProgramVersionStatus.DRAFT)).toBe(false);
    expect(isReleased(ProgramVersionStatus.PENDING)).toBe(true);
    expect(isReleased(ProgramVersionStatus.HISTORICAL)).toBe(true);
  });
});
