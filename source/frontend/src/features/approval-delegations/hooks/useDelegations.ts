import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createDelegation,
  fetchDelegationAccess,
  fetchDelegationLevels,
  fetchDelegations,
  fetchDelegators,
  fetchRecipients,
  revokeDelegation,
  type DelegationQuery,
} from '../api/delegations';

const ROOT = ['approval-delegations'] as const;

export const DELEGATION_KEYS = {
  all: ROOT,
  access: [...ROOT, 'access'] as const,
  list: (query: DelegationQuery) => [...ROOT, 'list', query] as const,
  recipients: (q: string) => [...ROOT, 'recipients', q] as const,
  delegators: (q: string) => [...ROOT, 'delegators', q] as const,
  levels: (delegatorId?: string) => [...ROOT, 'levels', delegatorId] as const,
};

export function useDelegationAccess() {
  return useQuery({
    queryKey: DELEGATION_KEYS.access,
    queryFn: fetchDelegationAccess,
  });
}

export function useDelegations(query: DelegationQuery) {
  return useQuery({
    queryKey: DELEGATION_KEYS.list(query),
    queryFn: () => fetchDelegations(query),
    placeholderData: keepPreviousData,
  });
}

export function useRecipientOptions(q: string, enabled: boolean) {
  return useQuery({
    queryKey: DELEGATION_KEYS.recipients(q),
    queryFn: () => fetchRecipients(q),
    enabled,
  });
}

export function useDelegatorOptions(q: string, enabled: boolean) {
  return useQuery({
    queryKey: DELEGATION_KEYS.delegators(q),
    queryFn: () => fetchDelegators(q),
    enabled,
  });
}

export function useDelegationLevels(
  delegatorId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: DELEGATION_KEYS.levels(delegatorId),
    queryFn: () => fetchDelegationLevels(delegatorId),
    enabled,
  });
}

function useDelegationMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ROOT }),
  });
}

export const useCreateDelegation = () =>
  useDelegationMutation(createDelegation);
export const useRevokeDelegation = () =>
  useDelegationMutation(revokeDelegation);
