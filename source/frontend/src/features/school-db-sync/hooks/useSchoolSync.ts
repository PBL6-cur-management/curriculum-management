import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { STUDENT_QUERY_ROOT } from '../../../shared/students/studentQueryRoot';
import {
  fetchSyncConfiguration,
  fetchSyncConflicts,
  fetchSyncMappings,
  fetchSyncRun,
  fetchSyncRuns,
  retrySyncRun,
  saveSyncConfiguration,
  saveSyncMappings,
  startSyncRun,
  testSyncConnection,
  type SaveSyncConfiguration,
  type SyncMapping,
  type SyncRunQuery,
} from '../api/schoolSync';
import { SYNC_POLL_INTERVAL_MS } from '../constants/syncLabels';

export const SYNC_QUERY_KEYS = {
  all: ['school-db-sync'] as const,
  configuration: ['school-db-sync', 'configuration'] as const,
  mappings: ['school-db-sync', 'mappings'] as const,
  runs: ['school-db-sync', 'runs'] as const,
  runList: (query: SyncRunQuery) => ['school-db-sync', 'runs', 'list', query] as const,
  run: (id: string) => ['school-db-sync', 'runs', 'detail', id] as const,
  conflicts: (id: string, page: number, pageSize: number) =>
    ['school-db-sync', 'runs', 'conflicts', id, page, pageSize] as const,
};

export function useSyncConfiguration() {
  return useQuery({
    queryKey: SYNC_QUERY_KEYS.configuration,
    queryFn: fetchSyncConfiguration,
    // While a run is in progress the page follows it, so "Đồng bộ ngay" comes back by itself.
    refetchInterval: (state) =>
      state.state.data?.activeRunId ? SYNC_POLL_INTERVAL_MS : false,
  });
}

export function useSyncMappings() {
  return useQuery({ queryKey: SYNC_QUERY_KEYS.mappings, queryFn: fetchSyncMappings });
}

export function useSaveSyncConfiguration() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveSyncConfiguration) => saveSyncConfiguration(body),
    onSuccess: (saved) => {
      client.setQueryData(SYNC_QUERY_KEYS.configuration, saved);
      void client.invalidateQueries({ queryKey: SYNC_QUERY_KEYS.mappings });
    },
  });
}

export function useTestSyncConnection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (revision: number) => testSyncConnection(revision),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: SYNC_QUERY_KEYS.configuration }),
  });
}

export function useSaveSyncMappings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ revision, items }: { revision: number; items: SyncMapping[] }) =>
      saveSyncMappings(revision, items),
    onSuccess: (saved) => {
      client.setQueryData(SYNC_QUERY_KEYS.mappings, saved);
      void client.invalidateQueries({ queryKey: SYNC_QUERY_KEYS.configuration });
    },
  });
}

export function useStartSyncRun() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ runId, requestId }: { runId?: string; requestId: string }) =>
      runId ? retrySyncRun(runId, requestId) : startSyncRun(requestId),
    onSuccess: () => client.invalidateQueries({ queryKey: SYNC_QUERY_KEYS.all }),
  });
}

export function useSyncRuns(query: SyncRunQuery) {
  return useQuery({
    queryKey: SYNC_QUERY_KEYS.runList(query),
    queryFn: () => fetchSyncRuns(query),
    placeholderData: keepPreviousData,
    refetchInterval: (state) =>
      state.state.data?.items.some((run) => run.status === 'RUNNING')
        ? SYNC_POLL_INTERVAL_MS
        : false,
  });
}

export function useSyncRun(runId: string) {
  const client = useQueryClient();
  return useQuery({
    queryKey: SYNC_QUERY_KEYS.run(runId),
    queryFn: async () => {
      const run = await fetchSyncRun(runId);
      // A finished run may have changed students and results shown elsewhere.
      if (run.status === 'SUCCEEDED') {
        void client.invalidateQueries({ queryKey: STUDENT_QUERY_ROOT });
      }
      return run;
    },
    refetchInterval: (state) =>
      state.state.data?.status === 'RUNNING' ? SYNC_POLL_INTERVAL_MS : false,
  });
}

export function useSyncConflicts(runId: string, page: number, pageSize: number, enabled: boolean) {
  return useQuery({
    queryKey: SYNC_QUERY_KEYS.conflicts(runId, page, pageSize),
    queryFn: () => fetchSyncConflicts(runId, page, pageSize),
    placeholderData: keepPreviousData,
    enabled,
  });
}
