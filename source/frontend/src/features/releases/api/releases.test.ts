import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assignCohortVersions,
  fetchAppliedCohortVersion,
  fetchAssignmentPrograms,
  fetchCohortVersions,
  fetchPinnedSyllabusComparison,
  fetchVersionComparison,
  updateCohortVersion,
} from './releases';
import { cohortSchedule, json } from '../testRender';

afterEach(() => vi.unstubAllGlobals());
describe('typed comparison and assignment adapters', () => {
  it('encodes all six route contexts and uses the shared CSRF client', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(json(cohortSchedule())),
    );
    vi.stubGlobal('fetch', fetch);
    await fetchVersionComparison('p/x', 'old &', 'new?');
    await fetchPinnedSyllabusComparison('p/x', 'c/x', 'old', 'new');
    await fetchCohortVersions('p/x');
    await fetchAppliedCohortVersion('p/x', 'k/x', 's &');
    const body = {
      cohortIds: ['k1'],
      programVersionId: 'v1',
      fromSemesterId: 's1',
      expectedRevision: 'a'.repeat(64),
    };
    expect(await assignCohortVersions('p/x', body)).toEqual(cohortSchedule());
    await updateCohortVersion('p/x', 'a/x', {
      fromSemesterId: 's1',
      expectedRevision: body.expectedRevision,
    });
    await fetchAssignmentPrograms({ page: 2, pageSize: 20, q: 'máy tính' });
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/programs/p%2Fx/version-comparison?beforeVersionId=old+%26&afterVersionId=new%3F',
      '/api/programs/p%2Fx/version-comparison/syllabi/c%2Fx?beforeVersionId=old&afterVersionId=new',
      '/api/programs/p%2Fx/cohort-versions',
      '/api/programs/p%2Fx/cohorts/k%2Fx/applied-version?semesterId=s+%26',
      '/api/programs/p%2Fx/cohort-versions',
      '/api/programs/p%2Fx/cohort-versions/a%2Fx',
      '/api/programs?page=2&pageSize=20&q=m%C3%A1y+t%C3%ADnh',
    ]);
    expect(fetch).toHaveBeenNthCalledWith(
      5,
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
        headers: expect.objectContaining({
          'X-Requested-With': 'XMLHttpRequest',
        }),
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      6,
      expect.any(String),
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});
