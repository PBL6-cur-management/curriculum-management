import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useEligibilityStudents,
  useRegistrationEligibility,
  ELIGIBILITY_QUERY_KEYS,
} from './useRegistrationEligibility';
import type { EligibilityLookup } from '../api/registrationEligibility';
import { eligibilityAnswerFixture } from '../eligibilityTestFixtures';

afterEach(() => vi.unstubAllGlobals());
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    client,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}
describe('private eligibility queries', () => {
  it('does not fetch absent context or a disabled picker', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const test = setup();
    renderHook(() => {
      useRegistrationEligibility(null);
      useEligibilityStudents(null);
    }, test);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('separates complete keys and never displays the previous student answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(eligibilityAnswerFixture())),
        ),
    );
    const test = setup();
    const first = { studentId: 's1', programId: 'p1', semesterId: 'sem1' };
    const hook = renderHook(
      ({ lookup }: { lookup: EligibilityLookup | null }) =>
        useRegistrationEligibility(lookup),
      { ...test, initialProps: { lookup: first } },
    );
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
    hook.rerender({ lookup: { ...first, studentId: 's2' } });
    expect(hook.result.current.data).toBeUndefined();
    await waitFor(() =>
      expect(
        test.client.getQueryData(ELIGIBILITY_QUERY_KEYS.answer(first)),
      ).toBeUndefined(),
    );
  });
  it('does not retry a subject refusal or retain it as a successful empty answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ message: 'Không tìm thấy sinh viên.' }),
            { status: 404 },
          ),
        ),
    );
    const test = setup();
    const hook = renderHook(
      () =>
        useRegistrationEligibility({
          studentId: 's',
          programId: 'p',
          semesterId: 'sem',
        }),
      test,
    );
    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(hook.result.current.data).toBeUndefined();
  });
});
