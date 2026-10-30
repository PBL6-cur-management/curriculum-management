import { useEffect, useRef, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type Query,
} from '@tanstack/react-query';
import { ApiError } from '../../../shared/api/client';
import {
  fetchCohorts,
  fetchSemesters,
  releaseOptionKeys,
} from '../../../shared/releases/semesters';
import * as api from '../api/graduation';
import type {
  GraduationBatch,
  GraduationBatchFilter,
  GraduationBatchCreate,
  GraduationExportFilters,
  GraduationItemQuery,
  GraduationLookup,
  GraduationPage,
  GraduationStudentQuery,
} from '../schema/graduation';
import {
  GRADUATION_QUERY_ROOT,
  GRADUATION_UI,
} from '../constants/graduationUi';

export const GRADUATION_QUERY_KEYS = {
  live: (lookup: GraduationLookup | null) =>
    [...GRADUATION_QUERY_ROOT, 'live', lookup] as const,
  history: (lookup: GraduationLookup | null, page: GraduationPage) =>
    [...GRADUATION_QUERY_ROOT, 'history', lookup, page] as const,
  audit: (id: string) => [...GRADUATION_QUERY_ROOT, 'audit', id] as const,
  programs: (semesterId: string) =>
    [...GRADUATION_QUERY_ROOT, 'programs', semesterId] as const,
  students: (query: GraduationStudentQuery | null) =>
    [...GRADUATION_QUERY_ROOT, 'students', query] as const,
  batches: (page: GraduationPage) =>
    [...GRADUATION_QUERY_ROOT, 'batches', page] as const,
  batch: (id: string) => [...GRADUATION_QUERY_ROOT, 'batch', id] as const,
  items: (id: string, filters: GraduationItemQuery) =>
    [...GRADUATION_QUERY_ROOT, 'items', id, filters] as const,
  tasks: (lookup: GraduationLookup | null, page: GraduationPage) =>
    [...GRADUATION_QUERY_ROOT, 'tasks', lookup, page] as const,
};
const privateOptions = {
  staleTime: 0,
  gcTime: 0,
  retry: false,
  refetchOnWindowFocus: true,
} as const;
export const hasGraduationContext = (lookup: GraduationLookup | null) =>
  Boolean(lookup?.studentId && lookup.programId && lookup.semesterId);
export function graduationPollingBlocked(error: unknown): boolean {
  return error instanceof ApiError && [401, 403, 404].includes(error.status);
}
export function graduationBatchPollInterval(
  status: GraduationBatch['status'] | undefined,
  error?: unknown,
): number | false {
  return !graduationPollingBlocked(error) &&
    (status === 'QUEUED' || status === 'RUNNING')
    ? GRADUATION_UI.POLL_INTERVAL_MS
    : false;
}
export function useDebouncedGraduationSearch(value: string) {
  const [committed, setCommitted] = useState(value);
  useEffect(() => {
    const timer = setTimeout(
      () => setCommitted(value),
      GRADUATION_UI.SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [value]);
  return committed;
}
export function useGraduationSemesters() {
  return useQuery({
    queryKey: releaseOptionKeys.semesters,
    queryFn: fetchSemesters,
  });
}
export function useGraduationCohorts() {
  return useQuery({
    queryKey: releaseOptionKeys.cohorts,
    queryFn: fetchCohorts,
  });
}
export function useGraduationPrograms(semesterId: string) {
  return useQuery({
    queryKey: GRADUATION_QUERY_KEYS.programs(semesterId),
    queryFn: () => api.fetchGraduationPrograms(semesterId),
    enabled: Boolean(semesterId),
    ...privateOptions,
  });
}
export function useGraduationStudents(query: GraduationStudentQuery | null) {
  return useQuery({
    queryKey: GRADUATION_QUERY_KEYS.students(query),
    queryFn: () => api.fetchGraduationStudents(query!),
    enabled: Boolean(query?.programId && query.semesterId),
    ...privateOptions,
  });
}
export function useGraduation(lookup: GraduationLookup | null) {
  return useQuery({
    queryKey: GRADUATION_QUERY_KEYS.live(lookup),
    queryFn: () => api.fetchGraduation(lookup!),
    enabled: hasGraduationContext(lookup),
    ...privateOptions,
  });
}
export function useGraduationHistory(
  lookup: GraduationLookup | null,
  page: GraduationPage,
) {
  return useQuery({
    queryKey: GRADUATION_QUERY_KEYS.history(lookup, page),
    queryFn: () => api.fetchGraduationHistory(lookup!, page),
    enabled: hasGraduationContext(lookup),
    ...privateOptions,
  });
}
export function useGraduationAudit(id: string) {
  return useQuery({
    queryKey: GRADUATION_QUERY_KEYS.audit(id),
    queryFn: () => api.fetchGraduationAudit(id),
    enabled: Boolean(id),
    ...privateOptions,
  });
}
function contextQueries(query: Query, lookup: GraduationLookup): boolean {
  if (query.queryKey[0] !== 'graduation') return false;
  const context =
    query.queryKey[1] === 'audit'
      ? (query.state.data as api.GraduationAudit | undefined)?.result.context
      : ['live', 'history', 'tasks'].includes(String(query.queryKey[1]))
        ? (query.queryKey[2] as GraduationLookup | null)
        : null;
  return Boolean(
    context &&
    context.studentId === lookup.studentId &&
    context.programId === lookup.programId &&
    context.semesterId === lookup.semesterId,
  );
}
export function useSaveGraduation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      lookup,
      requestKey,
    }: {
      lookup: GraduationLookup;
      requestKey: string;
    }) => api.saveGraduation(lookup, requestKey),
    retry: false,
    gcTime: 0,
    onSuccess: (audit, { lookup }) => {
      client.setQueryData(GRADUATION_QUERY_KEYS.audit(audit.id), audit);
      void client.invalidateQueries({
        predicate: (query) => contextQueries(query, lookup),
      });
    },
  });
}
export function useGraduationTasks(
  lookup: GraduationLookup | null,
  page: GraduationPage,
  enabled: boolean,
) {
  const client = useQueryClient();
  const previous = useRef(false);
  const tasks = useQuery({
    queryKey: GRADUATION_QUERY_KEYS.tasks(lookup, page),
    queryFn: () => api.fetchGraduationTasks(lookup!, page),
    enabled: enabled && hasGraduationContext(lookup),
    ...privateOptions,
    refetchInterval: (query) =>
      !graduationPollingBlocked(query.state.error) &&
      query.state.data?.items.some(
        (task) => task.status === 'PENDING' || task.status === 'RUNNING',
      )
        ? GRADUATION_UI.POLL_INTERVAL_MS
        : false,
  });
  useEffect(() => {
    const pending = Boolean(
      tasks.data?.items.some(
        (task) => task.status === 'PENDING' || task.status === 'RUNNING',
      ),
    );
    if (enabled && lookup && tasks.data && previous.current && !pending)
      void client.invalidateQueries({
        predicate: (query) =>
          query.queryKey[1] !== 'tasks' && contextQueries(query, lookup),
      });
    previous.current = pending;
  }, [client, enabled, lookup, tasks.data]);
  return tasks;
}
export function useRetryGraduationTask(lookup: GraduationLookup) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.retryGraduationTask,
    retry: false,
    onSuccess: () =>
      client.invalidateQueries({
        predicate: (query) => contextQueries(query, lookup),
      }),
  });
}
export function usePreviewGraduationBatch() {
  return useMutation({
    mutationFn: (input: GraduationBatchFilter) =>
      api.previewGraduationBatch(input),
    retry: false,
    gcTime: 0,
  });
}
export function useCreateGraduationBatch() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: GraduationBatchCreate) =>
      api.createGraduationBatch(input),
    retry: false,
    gcTime: 0,
    onSuccess: (batch) => {
      client.setQueryData(GRADUATION_QUERY_KEYS.batch(batch.id), batch);
      void client.invalidateQueries({
        queryKey: [...GRADUATION_QUERY_ROOT, 'batches'],
      });
    },
  });
}
export function useGraduationBatches(page: GraduationPage) {
  return useQuery({
    queryKey: GRADUATION_QUERY_KEYS.batches(page),
    queryFn: () => api.fetchGraduationBatches(page),
    ...privateOptions,
  });
}
export function useGraduationBatch(id: string) {
  const client = useQueryClient();
  const previous = useRef<GraduationBatch['status'] | undefined>(undefined);
  const processed = useRef<number | undefined>(undefined);
  const query = useQuery({
    queryKey: GRADUATION_QUERY_KEYS.batch(id),
    queryFn: () => api.fetchGraduationBatch(id),
    enabled: Boolean(id),
    ...privateOptions,
    refetchInterval: (state) =>
      graduationBatchPollInterval(state.state.data?.status, state.state.error),
  });
  useEffect(() => {
    const batch = query.data;
    if (batch && processed.current !== batch.processedCount)
      void client.invalidateQueries({
        queryKey: [...GRADUATION_QUERY_ROOT, 'items', id],
      });
    if (
      batch &&
      previous.current !== batch.status &&
      ['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED'].includes(batch.status)
    ) {
      void client.invalidateQueries({
        queryKey: [...GRADUATION_QUERY_ROOT, 'items', id],
      });
      void client.invalidateQueries({
        predicate: (cached) => {
          if (
            cached.queryKey[0] !== 'graduation' ||
            !['history', 'live'].includes(String(cached.queryKey[1]))
          )
            return false;
          const lookup = cached.queryKey[2] as GraduationLookup | null;
          const data = cached.state.data as
            api.GraduationOutcome | api.GraduationAuditPage | undefined;
          const cohortId =
            data &&
            ('result' in data
              ? data.result?.context.cohortId
              : data.items[0]?.result.context.cohortId);
          return Boolean(
            lookup &&
            lookup.semesterId === batch.filters.semesterId &&
            (!batch.filters.programId ||
              lookup.programId === batch.filters.programId) &&
            (!batch.filters.cohortId ||
              !cohortId ||
              cohortId === batch.filters.cohortId),
          );
        },
      });
    }
    previous.current = batch?.status;
    processed.current = batch?.processedCount;
  }, [client, id, query.data]);
  return query;
}
export function useGraduationItems(id: string, query: GraduationItemQuery) {
  return useQuery({
    queryKey: GRADUATION_QUERY_KEYS.items(id, query),
    queryFn: () => api.fetchGraduationItems(id, query),
    enabled: Boolean(id),
    ...privateOptions,
  });
}
export function useDownloadGraduationBatch(id: string) {
  return useMutation({
    mutationFn: (filters: GraduationExportFilters) =>
      api.downloadGraduationBatch(id, filters),
    retry: false,
  });
}
