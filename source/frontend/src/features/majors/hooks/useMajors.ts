import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createMajor,
  fetchMajorOverview,
  fetchMajors,
  setMajorStatus,
  updateMajor,
  type CreateMajorRequest,
  type MajorQueryExtended,
  type MajorStatus,
  type UpdateMajorRequest,
} from '../api/majors';

export const MAJOR_QUERY_KEYS = {
  all: ['majors'] as const,
  list: (query: MajorQueryExtended) => ['majors', 'list', query] as const,
  overview: (majorId: string) => ['majors', 'overview', majorId] as const,
};

export function useMajors(query: MajorQueryExtended) {
  return useQuery({
    queryKey: MAJOR_QUERY_KEYS.list(query),
    queryFn: () => fetchMajors(query),
    placeholderData: keepPreviousData,
  });
}

export function useMajorOverview(majorId: string) {
  return useQuery({
    queryKey: MAJOR_QUERY_KEYS.overview(majorId),
    queryFn: () => fetchMajorOverview(majorId),
    enabled: Boolean(majorId),
  });
}

function useInvalidateMajors() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: MAJOR_QUERY_KEYS.all });
}

export function useCreateMajor() {
  const invalidate = useInvalidateMajors();
  return useMutation({
    mutationFn: (body: CreateMajorRequest) => createMajor(body),
    onSuccess: invalidate,
  });
}

export function useUpdateMajor() {
  const invalidate = useInvalidateMajors();
  return useMutation({
    mutationFn: ({
      majorId,
      body,
    }: {
      majorId: string;
      body: UpdateMajorRequest;
    }) => updateMajor(majorId, body),
    onSuccess: invalidate,
  });
}

export function useSetMajorStatus() {
  const invalidate = useInvalidateMajors();
  return useMutation({
    mutationFn: ({
      majorId,
      status,
    }: {
      majorId: string;
      status: MajorStatus;
    }) => setMajorStatus(majorId, status),
    onSuccess: invalidate,
  });
}
