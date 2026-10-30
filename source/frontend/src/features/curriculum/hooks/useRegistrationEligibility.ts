import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ELIGIBILITY_QUERY_ROOT } from '../../../shared/registration-eligibility/eligibilityQueryRoot';
import {
  fetchEligibilityStudents,
  fetchRegistrationEligibility,
  type EligibilityLookup,
  type EligibilityStudentQuery,
} from '../api/registrationEligibility';

export const ELIGIBILITY_QUERY_OPTIONS = {
  STALE_TIME_MS: 0,
  GC_TIME_MS: 0,
  SEARCH_DEBOUNCE_MS: 300,
} as const;
export const ELIGIBILITY_QUERY_KEYS = {
  all: ELIGIBILITY_QUERY_ROOT,
  answer: (lookup: EligibilityLookup | null) =>
    [...ELIGIBILITY_QUERY_ROOT, 'answer', lookup] as const,
  students: (query: EligibilityStudentQuery | null) =>
    [...ELIGIBILITY_QUERY_ROOT, 'students', query] as const,
};
function usePrivateQueryCleanup(key: readonly unknown[]) {
  const client = useQueryClient();
  const identity = JSON.stringify(key);
  const lifecycle = useRef({ generation: 0, identity });
  useEffect(() => {
    const state = lifecycle.current;
    const generation = ++state.generation;
    state.identity = identity;
    return () => {
      void Promise.resolve().then(async () => {
        const reused = () =>
          state.generation !== generation && state.identity === identity;
        if (reused()) return;
        const queryKey = JSON.parse(identity) as readonly unknown[];
        await client.cancelQueries({ queryKey, exact: true });
        if (!reused()) client.removeQueries({ queryKey, exact: true });
      });
    };
  }, [client, identity]);
}
const options = {
  staleTime: ELIGIBILITY_QUERY_OPTIONS.STALE_TIME_MS,
  gcTime: ELIGIBILITY_QUERY_OPTIONS.GC_TIME_MS,
  retry: false,
  refetchOnMount: 'always' as const,
  refetchOnWindowFocus: 'always' as const,
};
export function useRegistrationEligibility(lookup: EligibilityLookup | null) {
  const queryKey = ELIGIBILITY_QUERY_KEYS.answer(lookup);
  usePrivateQueryCleanup(queryKey);
  return useQuery({
    queryKey,
    queryFn: () => fetchRegistrationEligibility(lookup!),
    enabled: Boolean(
      lookup?.studentId && lookup.programId && lookup.semesterId,
    ),
    ...options,
  });
}
export function useEligibilityStudents(query: EligibilityStudentQuery | null) {
  const queryKey = ELIGIBILITY_QUERY_KEYS.students(query);
  usePrivateQueryCleanup(queryKey);
  return useQuery({
    queryKey,
    queryFn: () => fetchEligibilityStudents(query!),
    enabled: Boolean(query?.programId && query.semesterId),
    ...options,
  });
}
