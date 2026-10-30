import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createIntegrationClient,
  fetchIntegrationClients,
  setIntegrationClientLocked,
  updateIntegrationClient,
  type CreateIntegrationClient,
  type IntegrationClientQuery,
  type UpdateIntegrationClient,
} from '../api/integrationClients';

export const INTEGRATION_KEYS = {
  all: ['integration-clients'] as const,
  list: (query: IntegrationClientQuery) =>
    ['integration-clients', 'list', query] as const,
};

export function useIntegrationClients(query: IntegrationClientQuery) {
  return useQuery({
    queryKey: INTEGRATION_KEYS.list(query),
    queryFn: () => fetchIntegrationClients(query),
    placeholderData: keepPreviousData,
  });
}

function useInvalidate() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: INTEGRATION_KEYS.all });
}

// The returned key is handed to the caller once and never put in the query cache.
export function useCreateIntegrationClient() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: CreateIntegrationClient) =>
      createIntegrationClient(body),
    onSuccess: () => void invalidate(),
  });
}

export function useUpdateIntegrationClient() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateIntegrationClient }) =>
      updateIntegrationClient(id, body),
    onSuccess: () => void invalidate(),
  });
}

export function useLockIntegrationClient() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, locked }: { id: string; locked: boolean }) =>
      setIntegrationClientLocked(id, locked),
    onSuccess: () => void invalidate(),
  });
}
