import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CHANGE_REQUEST_QUERY_ROOT } from '../../../shared/change-requests/changeRequestQueryRoot';
import { COURSE_QUERY_ROOT } from '../../../shared/courses/courseQueryKeys';
import { CURRICULUM_QUERY_ROOT } from '../../../shared/curriculum/curriculumQueryRoot';
import { OUTCOME_QUERY_ROOT } from '../../../shared/outcomes/outcomeQueryRoot';
import {
  assignGroupItems,
  createGroup,
  createItem,
  deleteGroup,
  deleteItem,
  fetchCurriculum,
  exportCurriculum,
  reorderSemester,
  replaceRequisites,
  updateGroup,
  updateItem,
  type CreateCurriculumItemRequest,
  type CreateElectiveGroupRequest,
  type ReorderCurriculumRequest,
  type ReplaceRequisitesRequest,
  type UpdateCurriculumItemRequest,
  type UpdateElectiveGroupRequest,
} from '../api/curriculum';

export const CURRICULUM_QUERY_KEYS = {
  all: CURRICULUM_QUERY_ROOT,
  version: (versionId: string) =>
    [...CURRICULUM_QUERY_ROOT, versionId] as const,
};

export function useCurriculum(versionId: string) {
  return useQuery({
    queryKey: CURRICULUM_QUERY_KEYS.version(versionId),
    queryFn: () => fetchCurriculum(versionId),
    enabled: Boolean(versionId),
  });
}

export function useExportCurriculum(versionId: string) {
  return useMutation({ mutationFn: () => exportCurriculum(versionId) });
}

// A row write changes totals, warnings and group credits; one refetch of the version is simpler than patching the cache.
// The course pages show curriculum facts ("used in programs"), so they refresh too.
function useCurriculumMutation<TVars, TResult>(
  versionId: string,
  mutationFn: (vars: TVars) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: CURRICULUM_QUERY_KEYS.version(versionId),
        }),
        queryClient.invalidateQueries({ queryKey: COURSE_QUERY_ROOT }),
        // A removed row takes its cells in the PLO and CLO matrices with it.
        queryClient.invalidateQueries({ queryKey: OUTCOME_QUERY_ROOT }),
        // On a request's working copy the request's diff changes too.
        queryClient.invalidateQueries({ queryKey: CHANGE_REQUEST_QUERY_ROOT }),
      ]),
  });
}

export const useCreateItem = (versionId: string) =>
  useCurriculumMutation(versionId, (body: CreateCurriculumItemRequest) =>
    createItem(versionId, body),
  );
export const useUpdateItem = (versionId: string) =>
  useCurriculumMutation(
    versionId,
    ({ itemId, body }: { itemId: string; body: UpdateCurriculumItemRequest }) =>
      updateItem(itemId, body),
  );
export const useDeleteItem = (versionId: string) =>
  useCurriculumMutation(versionId, (itemId: string) => deleteItem(itemId));
export const useReorderSemester = (versionId: string) =>
  useCurriculumMutation(versionId, (body: ReorderCurriculumRequest) =>
    reorderSemester(versionId, body),
  );
export const useReplaceRequisites = (versionId: string) =>
  useCurriculumMutation(
    versionId,
    ({ itemId, body }: { itemId: string; body: ReplaceRequisitesRequest }) =>
      replaceRequisites(itemId, body),
  );
export const useCreateGroup = (versionId: string) =>
  useCurriculumMutation(versionId, (body: CreateElectiveGroupRequest) =>
    createGroup(versionId, body),
  );
export const useUpdateGroup = (versionId: string) =>
  useCurriculumMutation(
    versionId,
    ({
      groupId,
      body,
    }: {
      groupId: string;
      body: UpdateElectiveGroupRequest;
    }) => updateGroup(groupId, body),
  );
export const useDeleteGroup = (versionId: string) =>
  useCurriculumMutation(versionId, (groupId: string) => deleteGroup(groupId));
export const useAssignGroupItems = (versionId: string) =>
  useCurriculumMutation(
    versionId,
    ({ groupId, itemIds }: { groupId: string; itemIds: string[] }) =>
      assignGroupItems(groupId, itemIds),
  );
