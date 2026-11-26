import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { nextPageNumber } from '../../../shared/api/pagination';
import { CHANGE_REQUEST_QUERY_ROOT } from '../../../shared/change-requests/changeRequestQueryRoot';
import {
  createChangeRequest,
  deleteChangeRequest,
  getChangeRequest,
  getConflicts,
  getDiff,
  fetchCourseInfo,
  fetchCourseRelationRows,
  fetchGroupDetail,
  fetchProgramDirectors,
  fetchTargetLabel,
  getSubmitPreview,
  listChangeRequests,
  listSubjectGroups,
  rebaseChangeRequest,
  removeDocument,
  replaceAuthoredItems,
  searchPrograms,
  submitChangeRequest,
  updateChangeRequest,
  uploadDocument,
  withdrawChangeRequest,
  type ApprovalQueueQuery,
  type AuthoredItemInput,
  type ChangeDocumentType,
  type ChangeRequestDetail,
  type ChangeRequestQuery,
  type ChangeTargetType,
  type UpdateChangeRequestBody,
} from '../api/changeRequests';

export const CHANGE_REQUEST_QUERY_KEYS = {
  all: CHANGE_REQUEST_QUERY_ROOT,
  list: (query: ChangeRequestQuery) =>
    [...CHANGE_REQUEST_QUERY_ROOT, 'list', query] as const,
  detail: (id: string) => [...CHANGE_REQUEST_QUERY_ROOT, 'detail', id] as const,
  diff: (id: string) => [...CHANGE_REQUEST_QUERY_ROOT, 'diff', id] as const,
  preview: (id: string) =>
    [...CHANGE_REQUEST_QUERY_ROOT, 'preview', id] as const,
  conflicts: (targetType: ChangeTargetType, targetId: string) =>
    [...CHANGE_REQUEST_QUERY_ROOT, 'conflicts', targetType, targetId] as const,
  source: (name: string, id: string) =>
    [...CHANGE_REQUEST_QUERY_ROOT, 'source', name, id] as const,
  programs: (q: string) =>
    [...CHANGE_REQUEST_QUERY_ROOT, 'programs', q] as const,
  subjectGroups: [...CHANGE_REQUEST_QUERY_ROOT, 'subject-groups'] as const,
  finalApproval: (id: string) =>
    [...CHANGE_REQUEST_QUERY_ROOT, 'final-approval', id] as const,
  history: (id: string) =>
    [...CHANGE_REQUEST_QUERY_ROOT, 'history', id] as const,
  comments: (id: string) =>
    [...CHANGE_REQUEST_QUERY_ROOT, 'comments', id] as const,
  queue: (query: ApprovalQueueQuery) =>
    [...CHANGE_REQUEST_QUERY_ROOT, 'queue', query] as const,
};

export function useChangeRequests(query: ChangeRequestQuery) {
  return useQuery({
    queryKey: CHANGE_REQUEST_QUERY_KEYS.list(query),
    queryFn: () => listChangeRequests(query),
    placeholderData: keepPreviousData,
  });
}

export function useChangeRequest(id: string) {
  return useQuery({
    queryKey: CHANGE_REQUEST_QUERY_KEYS.detail(id),
    queryFn: () => getChangeRequest(id),
    enabled: Boolean(id),
  });
}

export function useConflicts(
  targetType: ChangeTargetType | undefined,
  targetId: string | undefined,
) {
  return useQuery({
    queryKey: CHANGE_REQUEST_QUERY_KEYS.conflicts(
      targetType ?? 'COURSE',
      targetId ?? '',
    ),
    queryFn: () => getConflicts(targetType!, targetId!),
    enabled: Boolean(targetType && targetId),
  });
}

export const useRequestDiff = (id: string) =>
  useQuery({
    queryKey: CHANGE_REQUEST_QUERY_KEYS.diff(id),
    queryFn: () => getDiff(id),
    enabled: Boolean(id),
  });

// The preview is computed now, not from a cache taken before the last edit.
export const useSubmitPreview = (id: string) =>
  useQuery({
    queryKey: CHANGE_REQUEST_QUERY_KEYS.preview(id),
    queryFn: () => getSubmitPreview(id),
    staleTime: 0,
    gcTime: 0,
  });

export const useProgramOptions = (q: string) =>
  useInfiniteQuery({
    queryKey: CHANGE_REQUEST_QUERY_KEYS.programs(q),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => searchPrograms(q, pageParam),
    getNextPageParam: nextPageNumber,
    placeholderData: keepPreviousData,
  });

export const useSubjectGroupOptions = (enabled: boolean) =>
  useQuery({
    queryKey: CHANGE_REQUEST_QUERY_KEYS.subjectGroups,
    queryFn: listSubjectGroups,
    enabled,
  });

// Every request mutation that returns the detail replaces the cached detail and refetches the rest of the root.
export function useRequestMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<ChangeRequestDetail>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (detail) => {
      queryClient.setQueryData(
        CHANGE_REQUEST_QUERY_KEYS.detail(detail.id),
        detail,
      );
      return queryClient.invalidateQueries({
        queryKey: CHANGE_REQUEST_QUERY_ROOT,
        predicate: (query) =>
          !(query.queryKey[1] === 'detail' && query.queryKey[2] === detail.id),
      });
    },
  });
}

export const useCreateChangeRequest = () =>
  useRequestMutation(createChangeRequest);
export const useUpdateChangeRequest = (id: string) =>
  useRequestMutation((body: UpdateChangeRequestBody) =>
    updateChangeRequest(id, body),
  );
export const useRebaseChangeRequest = (id: string) =>
  useRequestMutation(() => rebaseChangeRequest(id));
export const useReplaceAuthoredItems = (id: string) =>
  useRequestMutation((items: AuthoredItemInput[]) =>
    replaceAuthoredItems(id, items),
  );
export const useSubmitChangeRequest = (id: string) =>
  useRequestMutation(() => submitChangeRequest(id));
export const useWithdrawChangeRequest = (id: string) =>
  useRequestMutation(() => withdrawChangeRequest(id));

function useRootMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: CHANGE_REQUEST_QUERY_ROOT }),
  });
}

export const useDeleteChangeRequest = () =>
  useRootMutation((id: string) => deleteChangeRequest(id));
export const useUploadDocument = (requestId: string) =>
  useRootMutation(
    ({
      documentType,
      file,
    }: {
      documentType: ChangeDocumentType;
      file: File;
    }) => uploadDocument(requestId, documentType, file),
  );
export const useRemoveDocument = () =>
  useRootMutation((documentId: string) => removeDocument(documentId));

// What the item editors compare against: the current state of the target in the owning feature's tables.
export const useCourseInfo = (courseId: string) =>
  useQuery({
    queryKey: CHANGE_REQUEST_QUERY_KEYS.source('course', courseId),
    queryFn: () => fetchCourseInfo(courseId),
    enabled: Boolean(courseId),
  });
export const useCourseRelationRows = (courseId: string) =>
  useQuery({
    queryKey: CHANGE_REQUEST_QUERY_KEYS.source('relations', courseId),
    queryFn: () => fetchCourseRelationRows(courseId),
    enabled: Boolean(courseId),
  });
export const useGroupDetail = (groupId: string) =>
  useQuery({
    queryKey: CHANGE_REQUEST_QUERY_KEYS.source('group', groupId),
    queryFn: () => fetchGroupDetail(groupId),
    enabled: Boolean(groupId),
  });
export const useProgramDirectors = (programId: string) =>
  useQuery({
    queryKey: CHANGE_REQUEST_QUERY_KEYS.source('directors', programId),
    queryFn: () => fetchProgramDirectors(programId),
    enabled: Boolean(programId),
  });
export const useTargetLabel = (
  targetType: ChangeTargetType | undefined,
  targetId: string | undefined,
) =>
  useQuery({
    queryKey: CHANGE_REQUEST_QUERY_KEYS.source(
      `label-${targetType ?? ''}`,
      targetId ?? '',
    ),
    queryFn: () => fetchTargetLabel(targetType!, targetId!),
    enabled: Boolean(targetType && targetId),
    retry: false,
  });
