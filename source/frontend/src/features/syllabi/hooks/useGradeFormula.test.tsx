import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHANGE_REQUEST_QUERY_ROOT } from '../../../shared/change-requests/changeRequestQueryRoot';
import { useReplaceGradeFormula } from './useGradeFormula';
import { SYLLABUS_QUERY_KEYS } from './useSyllabus';

afterEach(() => vi.unstubAllGlobals());

describe('useReplaceGradeFormula', () => {
  it('invalidates the course syllabus, the requests and the release checks before the save settles', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              failingScore: null,
              totalWeight: '0',
              components: [],
              warnings: [],
            }),
          ),
        ),
      ),
    );
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useReplaceGradeFormula('c1'), {
      wrapper,
    });

    await act(() =>
      result.current.mutateAsync({
        syllabusId: 's1',
        body: { expectedUpdatedAt: 't', failingScore: null, components: [] },
      }),
    );

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(SYLLABUS_QUERY_KEYS.courseRoot('c1'));
    expect(keys).toContainEqual(CHANGE_REQUEST_QUERY_ROOT);
    expect(keys).toContainEqual(['releases']);
  });
});
