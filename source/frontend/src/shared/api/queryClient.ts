import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { meQueryKey } from '../auth/me';
import { ApiError } from './client';
import { ERROR_CODES } from './errorCodes';

const MAX_QUERY_RETRIES = 3;
const FIRST_SERVER_ERROR = 500;

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleSessionError }),
  mutationCache: new MutationCache({ onError: handleSessionError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < FIRST_SERVER_ERROR) &&
        failureCount < MAX_QUERY_RETRIES,
    },
  },
});

function handleSessionError(error: Error): void {
  if (!(error instanceof ApiError)) return;
  if (error.code === ERROR_CODES.sessionRequired)
    queryClient.setQueryData(meQueryKey, null);
  else if (error.code === ERROR_CODES.passwordChangeRequired)
    void queryClient.invalidateQueries({ queryKey: meQueryKey });
}
