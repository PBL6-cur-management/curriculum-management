import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cohortSchedule, json } from '../testRender';
import {
  RELEASE_QUERY_KEYS,
  useAppliedCohortVersion,
  useAssignCohortVersions,
  useCohortVersions,
  useUpdateCohortVersion,
  useReleaseVersion,
  useIssueCorrection,
  useUpdateSemester,
} from './useReleases';

afterEach(() => vi.unstubAllGlobals());
function harness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return { client, wrapper: Wrapper };
}
describe('cohort version query boundaries', () => {
  it('release, correction and semester edits invalidate all new release projections', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json({}))),
    );
    const { client, wrapper } = harness();
    const keys = [
      RELEASE_QUERY_KEYS.comparison('p1', 'v1', 'v2'),
      RELEASE_QUERY_KEYS.syllabusComparison('p1', 'c1', 'v1', 'v2'),
      RELEASE_QUERY_KEYS.cohortVersions('p1'),
      RELEASE_QUERY_KEYS.applied('p1', 'k1', 's1'),
    ];
    const hooks = renderHook(
      () => ({
        release: useReleaseVersion('p1', 'v1'),
        correction: useIssueCorrection('p1', 'v1', 'copy'),
        semester: useUpdateSemester(),
      }),
      { wrapper },
    );
    const actions = [
      () =>
        hooks.result.current.release.mutateAsync({
          decisionNumber: 'QD',
          versionNumber: '1.0',
          cohortIds: [],
          signedDate: '2026-10-01',
          effectiveSemesterId: 's1',
        }),
      () =>
        hooks.result.current.correction.mutateAsync({
          reason: 'Sửa nội dung',
          moveCohorts: false,
        }),
      () =>
        hooks.result.current.semester.mutateAsync({
          id: 's1',
          body: { startDate: '2027-01-01' },
        }),
    ];
    for (const action of actions) {
      for (const key of keys) client.setQueryData(key, {});
      await act(async () => {
        await action();
      });
      for (const key of keys)
        expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    }
  });
  it('separates ordered pairs, program, cohort and semester keys and disables incomplete lookups', async () => {
    expect(RELEASE_QUERY_KEYS.comparison('p', 'v1', 'v2')).not.toEqual(
      RELEASE_QUERY_KEYS.comparison('p', 'v2', 'v1'),
    );
    expect(RELEASE_QUERY_KEYS.applied('p', 'k', 's1')).not.toEqual(
      RELEASE_QUERY_KEYS.applied('p', 'k', 's2'),
    );
    expect(RELEASE_QUERY_KEYS.applied('p', 'k', 's1')).not.toEqual(
      RELEASE_QUERY_KEYS.applied('other', 'k', 's1'),
    );
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(json({ assignment: null, state: 'UNASSIGNED' })),
    );
    vi.stubGlobal('fetch', fetch);
    const { wrapper } = harness();
    const lookup = renderHook(
      ({ semester }) => useAppliedCohortVersion('p', 'k', semester),
      { wrapper, initialProps: { semester: '' } },
    );
    expect(fetch).not.toHaveBeenCalled();
    lookup.rerender({ semester: 's1' });
    await waitFor(() => expect(lookup.result.current.isSuccess).toBe(true));
    expect(lookup.result.current.data?.assignment).toBeNull();
  });
  it('invalidates release and program projections after POST and PATCH', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json(cohortSchedule()))),
    );
    const { client, wrapper } = harness();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const hooks = renderHook(
      () => ({
        create: useAssignCohortVersions('p1'),
        update: useUpdateCohortVersion('p1', 'a1'),
      }),
      { wrapper },
    );
    await act(async () => {
      await hooks.result.current.create.mutateAsync({
        cohortIds: ['k1'],
        programVersionId: 'v1',
        fromSemesterId: 's1',
        expectedRevision: 'a'.repeat(64),
      });
      await hooks.result.current.update.mutateAsync({
        fromSemesterId: 's2',
        expectedRevision: 'b'.repeat(64),
      });
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['releases'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['programs'] });
  });
  it('does not retry stale assignment writes and leaves the schedule server-owned', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>((_, init) =>
      Promise.resolve(
        init?.method === 'POST'
          ? json(
              { code: 'ASSIGNMENT_STATE_CHANGED', message: 'Đã thay đổi' },
              409,
            )
          : json(cohortSchedule()),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const { wrapper } = harness();
    const hooks = renderHook(
      () => ({
        read: useCohortVersions('p1'),
        create: useAssignCohortVersions('p1'),
      }),
      { wrapper },
    );
    await waitFor(() => expect(hooks.result.current.read.isSuccess).toBe(true));
    await act(async () => {
      await expect(
        hooks.result.current.create.mutateAsync({
          cohortIds: ['k1'],
          programVersionId: 'v1',
          fromSemesterId: 's1',
          expectedRevision: 'a'.repeat(64),
        }),
      ).rejects.toMatchObject({ code: 'ASSIGNMENT_STATE_CHANGED' });
    });
    expect(
      fetch.mock.calls.filter(([, init]) => init?.method === 'POST'),
    ).toHaveLength(1);
    expect(hooks.result.current.read.data).toEqual(cohortSchedule());
  });
});
