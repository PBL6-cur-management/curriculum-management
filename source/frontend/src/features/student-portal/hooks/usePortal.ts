import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import {
  fetchSemesters,
  releaseOptionKeys,
} from '../../../shared/releases/semesters';
import { fetchRegistrationEligibility } from '../../curriculum/api/registrationEligibility';
import { fetchGraduation } from '../../graduation/api/graduation';
import {
  fetchPortalCurriculum,
  fetchPortalMe,
  fetchPortalPlos,
  fetchPortalSyllabus,
  type PortalContext,
} from '../api/portal';

export const PORTAL_PARAMS = {
  program: 'program',
  semester: 'semester',
} as const;

// Every key starts with 'portal' so logout's cache clear and a context switch never show one context's answer for another.
export const PORTAL_KEYS = {
  me: (semesterId: string | null) => ['portal', 'me', semesterId] as const,
  curriculum: (c: PortalContext) =>
    ['portal', 'curriculum', c.programId, c.semesterId] as const,
  plos: (c: PortalContext) =>
    ['portal', 'plos', c.programId, c.semesterId] as const,
  syllabus: (c: PortalContext, itemId: string) =>
    ['portal', 'syllabus', c.programId, c.semesterId, itemId] as const,
  eligibility: (c: PortalContext) =>
    ['portal', 'eligibility', c.programId, c.semesterId] as const,
  graduation: (c: PortalContext) =>
    ['portal', 'graduation', c.programId, c.semesterId] as const,
};

export function usePortalSemesters() {
  return useQuery({
    queryKey: releaseOptionKeys.semesters,
    queryFn: fetchSemesters,
  });
}

// Program and semester live in the URL so a link or a refresh shows the same context.
export function usePortalContext() {
  const [search, setSearch] = useSearchParams();
  const semesterParam = search.get(PORTAL_PARAMS.semester);
  const me = useQuery({
    queryKey: PORTAL_KEYS.me(semesterParam),
    queryFn: () => fetchPortalMe(semesterParam ?? undefined),
    placeholderData: keepPreviousData,
  });
  const programs = me.data?.programs ?? [];
  const wanted = search.get(PORTAL_PARAMS.program);
  const program =
    programs.find((row) => row.programId === wanted) ?? programs[0];
  const context: PortalContext | null =
    me.data?.student && me.data.semester && program
      ? {
          studentId: me.data.student.id,
          programId: program.programId,
          semesterId: me.data.semester.id,
        }
      : null;
  function select(next: { program?: string; semester?: string }) {
    const params = new URLSearchParams(search);
    if (next.program) params.set(PORTAL_PARAMS.program, next.program);
    if (next.semester) {
      params.set(PORTAL_PARAMS.semester, next.semester);
      params.delete(PORTAL_PARAMS.program);
    }
    setSearch(params, { replace: true });
  }
  return { me, program, programs, context, select, search: search.toString() };
}

export function usePortalCurriculum(context: PortalContext | null) {
  return useQuery({
    queryKey: context
      ? PORTAL_KEYS.curriculum(context)
      : ['portal', 'curriculum'],
    queryFn: () => fetchPortalCurriculum(context!),
    enabled: context !== null,
  });
}

export function usePortalPlos(context: PortalContext | null) {
  return useQuery({
    queryKey: context ? PORTAL_KEYS.plos(context) : ['portal', 'plos'],
    queryFn: () => fetchPortalPlos(context!),
    enabled: context !== null,
  });
}

export function usePortalSyllabus(
  context: PortalContext | null,
  itemId: string,
) {
  return useQuery({
    queryKey: context
      ? PORTAL_KEYS.syllabus(context, itemId)
      : ['portal', 'syllabus'],
    queryFn: () => fetchPortalSyllabus(context!, itemId),
    enabled: context !== null,
  });
}

export function usePortalEligibility(context: PortalContext | null) {
  return useQuery({
    queryKey: context
      ? PORTAL_KEYS.eligibility(context)
      : ['portal', 'eligibility'],
    queryFn: () => fetchRegistrationEligibility(context!),
    enabled: context !== null,
  });
}

export function usePortalGraduation(context: PortalContext | null) {
  return useQuery({
    queryKey: context
      ? PORTAL_KEYS.graduation(context)
      : ['portal', 'graduation'],
    queryFn: () => fetchGraduation(context!),
    enabled: context !== null,
  });
}
