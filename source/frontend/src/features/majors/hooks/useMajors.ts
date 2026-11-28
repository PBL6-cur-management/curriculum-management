import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createMajor,
  fetchMajors,
  setMajorStatus,
  updateMajor,
  type CreateMajorRequest,
  type MajorQuery,
  type MajorStatus,
  type UpdateMajorRequest,
} from '../api/majors';

export const MAJOR_QUERY_KEYS = {
  all: ['majors'] as const,
  list: (query: MajorQuery) => ['majors', 'list', query] as const,
};

export function useMajors(query: MajorQuery) {
  return useQuery({
    queryKey: MAJOR_QUERY_KEYS.list(query),
    queryFn: () => fetchMajors(query),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateMajors() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: MAJOR_QUERY_KEYS.all });
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
    mutationFn: ({ majorId, status }: { majorId: string; status: MajorStatus }) =>
      setMajorStatus(majorId, status),
    onSuccess: invalidate,
  });
}
