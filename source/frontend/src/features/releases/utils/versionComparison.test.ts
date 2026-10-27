import { describe, expect, it } from 'vitest';
import { versionRef } from '../testRender';
import { comparisonPath, isIssuedVersion } from './versionComparison';

describe('version comparison choices', () => {
  it('keeps issued lifecycle states but excludes Draft and incomplete metadata', () => {
    for (const status of ['PENDING', 'ACTIVE', 'HISTORICAL'] as const)
      expect(isIssuedVersion(versionRef({ status }))).toBe(true);
    for (const patch of [
      { status: 'DRAFT' as const },
      { publishedAt: null },
      { versionNumber: null },
      { effectiveSemester: null },
    ])
      expect(isIssuedVersion(versionRef(patch))).toBe(false);
  });
  it('preserves pair order and safely encodes query IDs and pin context', () => {
    expect(comparisonPath('p1', 'old & x', 'new?')).toBe(
      '/programs/p1/version-comparison?beforeVersionId=old+%26+x&afterVersionId=new%3F',
    );
    expect(comparisonPath('p1', 'new', 'old', 'c1')).toBe(
      '/programs/p1/version-comparison/syllabi/c1?beforeVersionId=new&afterVersionId=old',
    );
  });
});
