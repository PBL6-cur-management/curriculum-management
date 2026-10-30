import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/api/client';
import * as api from '../api/graduation';
import {
  eligibleGraduation,
  graduationAudit,
  graduationBatch,
  graduationLookup,
} from '../testRender';
import {
  GRADUATION_QUERY_KEYS,
  graduationBatchPollInterval,
  useGraduation,
  useGraduationBatch,
  useSaveGraduation,
} from './useGraduation';

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return { client, wrapper: Wrapper };
}
describe('graduation query boundaries', () => {
  it('keys all context, page-size and filter dimensions separately', () => {
    const context = graduationLookup;
    for (const field of ['studentId', 'programId', 'semesterId'] as const)
      expect(GRADUATION_QUERY_KEYS.live(context)).not.toEqual(
        GRADUATION_QUERY_KEYS.live({ ...context, [field]: 'another' }),
      );
    expect(
      GRADUATION_QUERY_KEYS.history(context, { page: 1, pageSize: 10 }),
    ).not.toEqual(
      GRADUATION_QUERY_KEYS.history(context, { page: 1, pageSize: 20 }),
    );
    expect(
      GRADUATION_QUERY_KEYS.items('batch', {
        page: 1,
        q: 'A',
        outcome: 'ERROR',
      }),
    ).not.toEqual(
      GRADUATION_QUERY_KEYS.items('batch', {
        page: 1,
        q: 'B',
        outcome: 'REVIEWED',
      }),
    );
    expect(
      GRADUATION_QUERY_KEYS.batches({ page: 1, pageSize: 10 }),
    ).not.toEqual(GRADUATION_QUERY_KEYS.batches({ page: 2, pageSize: 10 }));
  });
  it('does not fetch an incomplete lookup', () => {
    const fetch = vi.spyOn(api, 'fetchGraduation');
    renderHook(
      () => useGraduation({ ...graduationLookup, semesterId: '' }),
      setup(),
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it('ignores a late response after changing student context', async () => {
    let resolveOld!: (value: api.GraduationOutcome) => void;
    vi.spyOn(api, 'fetchGraduation').mockImplementation((lookup) =>
      lookup.studentId === 'student'
        ? new Promise((resolve) => {
            resolveOld = resolve;
          })
        : Promise.resolve({
            status: 'CANNOT_AUDIT',
            result: null,
            error: {
              code: 'GRADUATION_INPUT_INVALID',
              message: 'Chưa có mapping.',
              enrollmentId: null,
            },
          }),
    );
    const options = setup();
    const { result, rerender } = renderHook(
      ({ lookup }) => useGraduation(lookup),
      { ...options, initialProps: { lookup: graduationLookup } },
    );
    await waitFor(() =>
      expect(api.fetchGraduation).toHaveBeenCalledWith(graduationLookup),
    );
    rerender({ lookup: { ...graduationLookup, studentId: 'other' } });
    await waitFor(() =>
      expect(result.current.data?.status).toBe('CANNOT_AUDIT'),
    );
    await act(async () =>
      resolveOld({
        status: 'REVIEWED',
        result: eligibleGraduation,
        error: null,
      }),
    );
    expect(result.current.data?.status).toBe('CANNOT_AUDIT');
    expect(result.current.data?.result).toBeNull();
  });
  it('saves explicitly, reuses the supplied key and invalidates only the matching context', async () => {
    const options = setup();
    const own = GRADUATION_QUERY_KEYS.history(graduationLookup, {
      page: 1,
      pageSize: 20,
    });
    const other = GRADUATION_QUERY_KEYS.history(
      { ...graduationLookup, studentId: 'other' },
      { page: 1, pageSize: 20 },
    );
    options.client.setQueryData(own, { items: [], total: 0 });
    options.client.setQueryData(other, { items: [], total: 0 });
    const save = vi
      .spyOn(api, 'saveGraduation')
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(graduationAudit);
    const { result } = renderHook(useSaveGraduation, options);
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      await result.current
        .mutateAsync({ lookup: graduationLookup, requestKey: 'retained-key' })
        .catch(() => undefined);
    });
    await act(async () => {
      await result.current.mutateAsync({
        lookup: graduationLookup,
        requestKey: 'retained-key',
      });
    });
    expect(save.mock.calls.map((call) => call[1])).toEqual([
      'retained-key',
      'retained-key',
    ]);
    expect(options.client.getQueryState(own)?.isInvalidated).toBe(true);
    expect(options.client.getQueryState(other)?.isInvalidated).toBe(false);
    expect(
      options.client.getQueryData(GRADUATION_QUERY_KEYS.audit('audit')),
    ).toEqual(graduationAudit);
  });
  it.each(['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED'] as const)(
    'stops polling terminal %s',
    (status) => {
      expect(graduationBatchPollInterval(status)).toBe(false);
    },
  );
  it.each([401, 403, 404])(
    'stops queued polling on transport status %s',
    (status) => {
      expect(
        graduationBatchPollInterval('QUEUED', new ApiError(status, {})),
      ).toBe(false);
    },
  );
  it('polls only active batch reads and stops after terminal or unmount', async () => {
    vi.useFakeTimers();
    const fetch = vi
      .spyOn(api, 'fetchGraduationBatch')
      .mockResolvedValueOnce({
        ...graduationBatch,
        status: 'RUNNING',
        processedCount: 1,
      })
      .mockResolvedValue(graduationBatch);
    const { result, unmount } = renderHook(
      () => useGraduationBatch('batch'),
      setup(),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(result.current.data?.status).toBe('RUNNING');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2020);
    });
    expect(result.current.data?.status).toBe('COMPLETED_WITH_ERRORS');
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    unmount();
    await vi.advanceTimersByTimeAsync(6000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
