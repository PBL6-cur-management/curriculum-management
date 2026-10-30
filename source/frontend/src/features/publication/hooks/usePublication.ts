import { useQuery } from '@tanstack/react-query';
import {
  fetchCourseGraph,
  fetchPdfExport,
  fetchProgramHealth,
  fetchVersionTimeline,
} from '../api/publication';

const PDF_POLL_MS = 1500;

export const PUBLICATION_KEYS = {
  graph: (programId: string, versionId: string) =>
    ['publication', 'graph', programId, versionId] as const,
  health: (programId: string, versionId: string) =>
    ['publication', 'health', programId, versionId] as const,
  timeline: (programId: string) =>
    ['publication', 'timeline', programId] as const,
  pdf: (exportId: string) => ['publication', 'pdf', exportId] as const,
};

export function useCourseGraph(programId: string, versionId: string) {
  return useQuery({
    queryKey: PUBLICATION_KEYS.graph(programId, versionId),
    queryFn: () => fetchCourseGraph(programId, versionId),
  });
}

export function useProgramHealth(programId: string, versionId: string) {
  return useQuery({
    queryKey: PUBLICATION_KEYS.health(programId, versionId),
    queryFn: () => fetchProgramHealth(programId, versionId),
  });
}

export function useVersionTimeline(programId: string) {
  return useQuery({
    queryKey: PUBLICATION_KEYS.timeline(programId),
    queryFn: () => fetchVersionTimeline(programId),
  });
}

// Polls until the worker finishes: READY, FAILED or EXPIRED stop the polling.
export function usePdfExport(exportId: string | null) {
  return useQuery({
    queryKey: PUBLICATION_KEYS.pdf(exportId ?? ''),
    queryFn: () => fetchPdfExport(exportId!),
    enabled: Boolean(exportId),
    refetchInterval: (query) =>
      ['QUEUED', 'RUNNING'].includes(query.state.data?.state ?? 'QUEUED')
        ? PDF_POLL_MS
        : false,
  });
}
