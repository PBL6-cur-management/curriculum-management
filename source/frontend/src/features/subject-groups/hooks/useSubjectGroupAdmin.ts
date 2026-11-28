import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { subjectGroupsQueryKey } from '../../../shared/subject-groups/subjectGroups';
import {
  activateSubjectGroup,
  addMember,
  createSubjectGroup,
  deactivateSubjectGroup,
  demoteCoordinator,
  endMember,
  fetchDeactivationImpact,
  fetchSubjectGroup,
  promoteCoordinator,
  revokeMember,
  updateSubjectGroup,
  type DemoteCoordinatorRequest,
  type PromoteCoordinatorRequest,
} from '../api/subjectGroupAdmin';

export const SUBJECT_GROUP_QUERY_KEYS = {
  detail: (groupId: string) => ['subject-groups', 'detail', groupId] as const,
  impact: (groupId: string) =>
    ['subject-groups', 'detail', groupId, 'impact'] as const,
};
export function useSubjectGroup(groupId: string) {
  return useQuery({
    queryKey: SUBJECT_GROUP_QUERY_KEYS.detail(groupId),
    queryFn: () => fetchSubjectGroup(groupId),
  });
}
export function useDeactivationImpact(groupId: string | null) {
  return useQuery({
    queryKey: SUBJECT_GROUP_QUERY_KEYS.impact(groupId ?? ''),
    queryFn: () => fetchDeactivationImpact(groupId ?? ''),
    enabled: groupId !== null,
  });
}
function useInvalidateGroups() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: subjectGroupsQueryKey });
}
export function useCreateSubjectGroup() {
  const invalidate = useInvalidateGroups();
  return useMutation({ mutationFn: createSubjectGroup, onSuccess: invalidate });
}
export function useUpdateSubjectGroup() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: ({
      groupId,
      body,
    }: {
      groupId: string;
      body: Parameters<typeof updateSubjectGroup>[1];
    }) => updateSubjectGroup(groupId, body),
    onSuccess: invalidate,
  });
}
export function useDeactivateSubjectGroup() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: deactivateSubjectGroup,
    onSuccess: invalidate,
  });
}
export function useActivateSubjectGroup() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: activateSubjectGroup,
    onSuccess: invalidate,
  });
}
export function useAddMember() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: ({
      groupId,
      body,
    }: {
      groupId: string;
      body: Parameters<typeof addMember>[1];
    }) => addMember(groupId, body),
    onSuccess: invalidate,
  });
}
export function useEndMember() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: ({
      groupId,
      memberId,
      body,
    }: {
      groupId: string;
      memberId: string;
      body: Parameters<typeof endMember>[2];
    }) => endMember(groupId, memberId, body),
    onSuccess: invalidate,
  });
}
export function useRevokeMember() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: ({
      groupId,
      memberId,
    }: {
      groupId: string;
      memberId: string;
    }) => revokeMember(groupId, memberId),
    onSuccess: invalidate,
  });
}
export function usePromoteCoordinator() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: ({
      groupId,
      lecturerId,
      body,
    }: {
      groupId: string;
      lecturerId: string;
      body?: PromoteCoordinatorRequest;
    }) => promoteCoordinator(groupId, lecturerId, body),
    onSuccess: invalidate,
  });
}
export function useDemoteCoordinator() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: ({
      groupId,
      lecturerId,
      body,
    }: {
      groupId: string;
      lecturerId: string;
      body?: DemoteCoordinatorRequest;
    }) => demoteCoordinator(groupId, lecturerId, body),
    onSuccess: invalidate,
  });
}
