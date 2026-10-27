import { useEffect, useRef } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { COURSE_QUERY_ROOT } from '../../../shared/courses/courseQueryKeys';
import { CURRICULUM_QUERY_ROOT } from '../../../shared/curriculum/curriculumQueryRoot';
import { OUTCOME_QUERY_ROOT } from '../../../shared/outcomes/outcomeQueryRoot';
import { PROGRAM_QUERY_KEYS } from '../../programs/hooks/usePrograms';
import {
  commitImport,
  createImport,
  downloadImportFile,
  downloadTemplate,
  fetchImport,
  fetchImports,
  fetchImportTargets,
  fetchImportTypes,
  type ImportQuery,
} from '../api/imports';
import {
  IMPORT_POLL_INTERVAL_MS,
  TRANSIENT_IMPORT_STATUSES,
} from '../constants/importLabels';

export const IMPORT_QUERY_KEYS = {
  all: ['imports'] as const,
  lists: ['imports', 'list'] as const,
  types: ['imports', 'types'] as const,
  targets: ['imports', 'targets'] as const,
  list: (query: ImportQuery) => ['imports', 'list', query] as const,
  detail: (id: string) => ['imports', 'detail', id] as const,
};
export function useImportTypes() {
  return useQuery({
    queryKey: IMPORT_QUERY_KEYS.types,
    queryFn: fetchImportTypes,
  });
}
export function useImportTargets(enabled: boolean) {
  return useQuery({
    queryKey: IMPORT_QUERY_KEYS.targets,
    queryFn: fetchImportTargets,
    enabled,
  });
}
export function useImports(query: ImportQuery) {
  return useQuery({
    queryKey: IMPORT_QUERY_KEYS.list(query),
    queryFn: () => fetchImports(query),
    placeholderData: keepPreviousData,
    refetchInterval: (state) =>
      state.state.data?.items.some((batch) =>
        TRANSIENT_IMPORT_STATUSES.includes(batch.status),
      )
        ? IMPORT_POLL_INTERVAL_MS
        : false,
  });
}
export function useImportBatch(id: string) {
  const client = useQueryClient();
  const refreshed = useRef<string | null>(null);
  const query = useQuery({
    queryKey: IMPORT_QUERY_KEYS.detail(id),
    queryFn: () => fetchImport(id),
    enabled: Boolean(id),
    refetchInterval: (state) =>
      state.state.data &&
      TRANSIENT_IMPORT_STATUSES.includes(state.state.data.status)
        ? IMPORT_POLL_INTERVAL_MS
        : false,
  });
  useEffect(() => {
    if (
      query.data?.status !== 'COMMITTED' ||
      refreshed.current === query.data.id
    )
      return;
    refreshed.current = query.data.id;
    for (const queryKey of [
      IMPORT_QUERY_KEYS.lists,
      IMPORT_QUERY_KEYS.targets,
      COURSE_QUERY_ROOT,
      CURRICULUM_QUERY_ROOT,
      OUTCOME_QUERY_ROOT,
      PROGRAM_QUERY_KEYS.all,
    ]) {
      void client.invalidateQueries({ queryKey });
    }
  }, [client, query.data?.id, query.data?.status]);
  return query;
}
export function useCreateImport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createImport,
    onSuccess: (batch) => {
      client.setQueryData(IMPORT_QUERY_KEYS.detail(batch.id), batch);
      void client.invalidateQueries({ queryKey: IMPORT_QUERY_KEYS.lists });
    },
  });
}
export function useCommitImport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: commitImport,
    onSuccess: (batch) => {
      client.setQueryData(IMPORT_QUERY_KEYS.detail(batch.id), batch);
      void client.invalidateQueries({ queryKey: IMPORT_QUERY_KEYS.lists });
    },
  });
}
export function useDownloadTemplate() {
  return useMutation({ mutationFn: downloadTemplate });
}
export function useDownloadImportFile() {
  return useMutation({ mutationFn: downloadImportFile });
}
