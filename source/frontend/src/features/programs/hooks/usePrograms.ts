import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { CHANGE_REQUEST_QUERY_ROOT } from '../../../shared/change-requests/changeRequestQueryRoot';
import {
  assignDirector,
  changeProgramStatus,
  cloneProgram,
  endDirector,
  fetchDirectors,
  fetchProgram,
  fetchPrograms,
  fetchVersionInfo,
  revokeDirector,
  updateProgram,
  updateVersionInfo,
  type AssignDirectorRequest,
  type CloneProgramRequest,
  type ProgramQuery,
  type ProgramStatusAction,
  type UpdateProgramRequest,
  type UpdateVersionInfoRequest,
} from '../api/programs';

export const PROGRAM_QUERY_KEYS = {
  all: ['programs'] as const,
  list: (query: ProgramQuery) => ['programs', 'list', query] as const,
  detail: (programId: string) => ['programs', 'detail', programId] as const,
  directors: (programId: string) =>
    ['programs', 'directors', programId] as const,
  versionInfo: (versionId: string) =>
    ['programs', 'version-info', versionId] as const,
};

export function useProgramList(query: ProgramQuery) {
  return useQuery({
    queryKey: PROGRAM_QUERY_KEYS.list(query),
    queryFn: () => fetchPrograms(query),
    placeholderData: keepPreviousData,
  });
}

export function useProgram(programId: string, enabled = true) {
  return useQuery({
    queryKey: PROGRAM_QUERY_KEYS.detail(programId),
    queryFn: () => fetchProgram(programId),
    enabled: enabled && Boolean(programId),
  });
}

export function useProgramDirectors(programId: string) {
  return useQuery({
    queryKey: PROGRAM_QUERY_KEYS.directors(programId),
    queryFn: () => fetchDirectors(programId),
    enabled: Boolean(programId),
  });
}

// Every program write can change the list row, the detail and the directors; refresh all program data.
function useProgramMutation<TVars, TResult>(
  mutationFn: (vars: TVars) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: PROGRAM_QUERY_KEYS.all }),
  });
}

export const useUpdateProgram = () =>
  useProgramMutation(
    ({ programId, body }: { programId: string; body: UpdateProgramRequest }) =>
      updateProgram(programId, body),
  );
export const useChangeProgramStatus = () =>
  useProgramMutation(
    ({
      programId,
      action,
    }: {
      programId: string;
      action: ProgramStatusAction;
    }) => changeProgramStatus(programId, action),
  );
export const useCloneProgram = () =>
  useProgramMutation(
    ({ programId, body }: { programId: string; body: CloneProgramRequest }) =>
      cloneProgram(programId, body),
  );
export const useAssignDirector = () =>
  useProgramMutation(
    ({ programId, body }: { programId: string; body: AssignDirectorRequest }) =>
      assignDirector(programId, body),
  );
export const useEndDirector = () =>
  useProgramMutation(
    ({
      programId,
      assignmentId,
      validTo,
    }: {
      programId: string;
      assignmentId: string;
      validTo: string;
    }) => endDirector(programId, assignmentId, validTo),
  );
export const useRevokeDirector = () =>
  useProgramMutation(
    ({
      programId,
      assignmentId,
    }: {
      programId: string;
      assignmentId: string;
    }) => revokeDirector(programId, assignmentId),
  );

export function useVersionInfo(versionId: string) {
  return useQuery({
    queryKey: PROGRAM_QUERY_KEYS.versionInfo(versionId),
    queryFn: () => fetchVersionInfo(versionId),
    enabled: Boolean(versionId),
  });
}

// The info of a request's working copy; the request's diff reads it, so that refetches too.
export function useUpdateVersionInfo(versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateVersionInfoRequest) =>
      updateVersionInfo(versionId, body),
    onSuccess: (info) => {
      queryClient.setQueryData(PROGRAM_QUERY_KEYS.versionInfo(versionId), info);
      return queryClient.invalidateQueries({
        queryKey: CHANGE_REQUEST_QUERY_ROOT,
      });
    },
  });
}
