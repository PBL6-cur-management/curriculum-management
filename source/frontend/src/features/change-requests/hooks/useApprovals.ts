import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { COURSE_QUERY_ROOT } from '../../../shared/courses/courseQueryKeys';
import { CURRICULUM_QUERY_ROOT } from '../../../shared/curriculum/curriculumQueryRoot';
import { OUTCOME_QUERY_ROOT } from '../../../shared/outcomes/outcomeQueryRoot';
import {
  approveChangeRequest,
  createComment,
  fetchFinalApproval,
  finalApproveChangeRequest,
  type FinalApproveInput,
  getApprovalHistory,
  getApprovalQueue,
  listComments,
  overrideChangeRequest,
  rejectChangeRequest,
  returnChangeRequest,
  type ApprovalQueueQuery,
  type OverrideDecisionBody,
} from '../api/changeRequests';
import {
  CHANGE_REQUEST_QUERY_KEYS,
  useRequestMutation,
} from './useChangeRequests';

// A decision replaces the cached detail and refetches the rest of the root, the queue included (US-061 AC4).
export const useApproveChangeRequest = (id: string) =>
  useRequestMutation((remark?: string) => approveChangeRequest(id, remark));
export const useReturnChangeRequest = (id: string) =>
  useRequestMutation((remark: string) => returnChangeRequest(id, remark));
export const useRejectChangeRequest = (id: string) =>
  useRequestMutation((remark: string) => rejectChangeRequest(id, remark));
export const useOverrideChangeRequest = (id: string) =>
  useRequestMutation((body: OverrideDecisionBody) =>
    overrideChangeRequest(id, body),
  );

// The preview is what the office decides on: recomputed on every visit, never cached across them.
export function useFinalApprovalPreview(id: string) {
  return useQuery({
    queryKey: CHANGE_REQUEST_QUERY_KEYS.finalApproval(id),
    queryFn: () => fetchFinalApproval(id),
    enabled: Boolean(id),
    staleTime: 0,
  });
}

// Approving releases versions and may publish a revision: everything that shows them is read again.
export function useFinalApprove(id: string) {
  const queryClient = useQueryClient();
  const approve = useRequestMutation((body: FinalApproveInput) =>
    finalApproveChangeRequest(id, body),
  );
  return {
    ...approve,
    mutateAsync: (body: FinalApproveInput) =>
      approve.mutateAsync(body).then(async (detail) => {
        await Promise.all(
          [
            ['programs'],
            ['releases'],
            ['syllabi'],
            ['consistency'],
            CURRICULUM_QUERY_ROOT,
            OUTCOME_QUERY_ROOT,
            COURSE_QUERY_ROOT,
          ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
        );
        return detail;
      }),
  };
}

// Loaded when the history is opened: the current round is already on the page.
export function useApprovalHistory(id: string, enabled: boolean) {
  return useQuery({
    queryKey: CHANGE_REQUEST_QUERY_KEYS.history(id),
    queryFn: () => getApprovalHistory(id),
    enabled,
  });
}

export function useComments(id: string) {
  return useQuery({
    queryKey: CHANGE_REQUEST_QUERY_KEYS.comments(id),
    queryFn: () => listComments(id),
  });
}

export function useCreateComment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => createComment(id, content),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: CHANGE_REQUEST_QUERY_KEYS.comments(id),
      }),
  });
}

export function useApprovalQueue(query: ApprovalQueueQuery) {
  return useQuery({
    queryKey: CHANGE_REQUEST_QUERY_KEYS.queue(query),
    queryFn: () => getApprovalQueue(query),
    // Changing the request-type filter keeps the previous rows instead of blanking the table.
    placeholderData: keepPreviousData,
  });
}
