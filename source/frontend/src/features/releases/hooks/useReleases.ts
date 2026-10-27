import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CHANGE_REQUEST_QUERY_ROOT } from '../../../shared/change-requests/changeRequestQueryRoot';
import { COURSE_QUERY_ROOT } from '../../../shared/courses/courseQueryKeys';
import { CURRICULUM_QUERY_ROOT } from '../../../shared/curriculum/curriculumQueryRoot';
import { OUTCOME_QUERY_ROOT } from '../../../shared/outcomes/outcomeQueryRoot';
import { RELEASE_OPTIONS_QUERY_ROOT } from '../../../shared/releases/semesters';
import {
  createCohort,
  fetchAssignmentPrograms,
  fetchVersionComparison,
  fetchPinnedSyllabusComparison,
  fetchCohortVersions,
  fetchAppliedCohortVersion,
  assignCohortVersions,
  updateCohortVersion,
  type AssignmentProgramQuery,
  type AssignCohortVersionsInput,
  type UpdateCohortVersionInput,
  createSemester,
  discardCorrection,
  fetchReleaseCheck,
  fetchVersionDetail,
  fetchVersionHistory,
  issueCorrection,
  openCorrection,
  releaseVersion,
  updateCohort,
  updateSemester,
  type CohortInput,
  type CohortPatch,
  type IssueCorrectionInput,
  type ReleaseVersionInput,
  type SemesterInput,
  type SemesterPatch,
} from '../api/releases';

export const RELEASE_QUERY_ROOT = ['releases'] as const;
export const RELEASE_QUERY_KEYS = {
  assignmentPrograms: (query: AssignmentProgramQuery) =>
    [...RELEASE_QUERY_ROOT, 'assignment-programs', query] as const,
  comparison: (programId: string, before: string, after: string) =>
    [...RELEASE_QUERY_ROOT, 'comparison', programId, before, after] as const,
  syllabusComparison: (
    programId: string,
    courseId: string,
    before: string,
    after: string,
  ) =>
    [
      ...RELEASE_QUERY_ROOT,
      'syllabus-comparison',
      programId,
      courseId,
      before,
      after,
    ] as const,
  cohortVersions: (programId: string) =>
    [...RELEASE_QUERY_ROOT, 'cohort-versions', programId] as const,
  applied: (programId: string, cohortId: string, semesterId: string) =>
    [
      ...RELEASE_QUERY_ROOT,
      'applied',
      programId,
      cohortId,
      semesterId,
    ] as const,
  check: (programId: string, versionId: string) =>
    [...RELEASE_QUERY_ROOT, 'check', programId, versionId] as const,
  history: (programId: string) =>
    [...RELEASE_QUERY_ROOT, 'history', programId] as const,
  detail: (programId: string, versionId: string) =>
    [...RELEASE_QUERY_ROOT, 'detail', programId, versionId] as const,
};

// A release changes what several screens show: program and version lists, the curriculum, syllabi pinned per version
// and the requests that produced them. Nothing is guessed on the client; the next read says what is in force (D5).
// The program, syllabus and consistency roots belong to features this one cannot import, so their names are repeated.
const PROGRAM_ROOT = ['programs'] as const;
const SYLLABUS_ROOT = ['syllabi'] as const;
const CONSISTENCY_ROOT = ['consistency'] as const;

export const COHORT_ASSIGNMENT_STALE_TIME_MS = 0;
export function useAssignmentPrograms(query: AssignmentProgramQuery) {
  return useQuery({
    queryKey: RELEASE_QUERY_KEYS.assignmentPrograms(query),
    queryFn: () => fetchAssignmentPrograms(query),
  });
}
export function useVersionComparison(
  programId: string,
  before: string,
  after: string,
) {
  return useQuery({
    queryKey: RELEASE_QUERY_KEYS.comparison(programId, before, after),
    queryFn: () => fetchVersionComparison(programId, before, after),
    enabled: Boolean(programId && before && after),
  });
}
export function usePinnedSyllabusComparison(
  programId: string,
  courseId: string,
  before: string,
  after: string,
) {
  return useQuery({
    queryKey: RELEASE_QUERY_KEYS.syllabusComparison(
      programId,
      courseId,
      before,
      after,
    ),
    queryFn: () =>
      fetchPinnedSyllabusComparison(programId, courseId, before, after),
    enabled: Boolean(programId && courseId && before && after),
  });
}
export function useCohortVersions(programId: string) {
  return useQuery({
    queryKey: RELEASE_QUERY_KEYS.cohortVersions(programId),
    queryFn: () => fetchCohortVersions(programId),
    enabled: Boolean(programId),
    staleTime: COHORT_ASSIGNMENT_STALE_TIME_MS,
  });
}
export function useAppliedCohortVersion(
  programId: string,
  cohortId: string,
  semesterId: string,
) {
  return useQuery({
    queryKey: RELEASE_QUERY_KEYS.applied(programId, cohortId, semesterId),
    queryFn: () => fetchAppliedCohortVersion(programId, cohortId, semesterId),
    enabled: Boolean(programId && cohortId && semesterId),
    staleTime: COHORT_ASSIGNMENT_STALE_TIME_MS,
  });
}
export function useAssignCohortVersions(programId: string) {
  const invalidate = useInvalidateReleased();
  return useMutation({
    mutationFn: (body: AssignCohortVersionsInput) =>
      assignCohortVersions(programId, body),
    onSuccess: invalidate,
    retry: false,
  });
}
export function useUpdateCohortVersion(
  programId: string,
  assignmentId: string,
) {
  const invalidate = useInvalidateReleased();
  return useMutation({
    mutationFn: (body: UpdateCohortVersionInput) =>
      updateCohortVersion(programId, assignmentId, body),
    onSuccess: invalidate,
    retry: false,
  });
}

export function useReleaseCheck(programId: string, versionId: string) {
  return useQuery({
    queryKey: RELEASE_QUERY_KEYS.check(programId, versionId),
    queryFn: () => fetchReleaseCheck(programId, versionId),
    enabled: Boolean(programId && versionId),
    staleTime: 0,
  });
}

export function useVersionHistory(programId: string) {
  return useQuery({
    queryKey: RELEASE_QUERY_KEYS.history(programId),
    queryFn: () => fetchVersionHistory(programId),
    enabled: Boolean(programId),
  });
}

export function useVersionDetail(programId: string, versionId: string) {
  return useQuery({
    queryKey: RELEASE_QUERY_KEYS.detail(programId, versionId),
    queryFn: () => fetchVersionDetail(programId, versionId),
    enabled: Boolean(programId && versionId),
  });
}

function useInvalidateReleased() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [
        RELEASE_QUERY_ROOT,
        PROGRAM_ROOT,
        CURRICULUM_QUERY_ROOT,
        OUTCOME_QUERY_ROOT,
        COURSE_QUERY_ROOT,
        SYLLABUS_ROOT,
        CONSISTENCY_ROOT,
        CHANGE_REQUEST_QUERY_ROOT,
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
}

export function useReleaseVersion(programId: string, versionId: string) {
  const invalidate = useInvalidateReleased();
  return useMutation({
    mutationFn: (body: ReleaseVersionInput) =>
      releaseVersion(programId, versionId, body),
    onSuccess: invalidate,
  });
}

export function useOpenCorrection(programId: string, versionId: string) {
  const invalidate = useInvalidateReleased();
  return useMutation({
    mutationFn: () => openCorrection(programId, versionId),
    onSuccess: invalidate,
  });
}

export function useIssueCorrection(
  programId: string,
  versionId: string,
  correctionId: string,
) {
  const invalidate = useInvalidateReleased();
  return useMutation({
    mutationFn: (body: IssueCorrectionInput) =>
      issueCorrection(programId, versionId, correctionId, body),
    onSuccess: invalidate,
  });
}

export function useDiscardCorrection(
  programId: string,
  versionId: string,
  correctionId: string,
) {
  const invalidate = useInvalidateReleased();
  return useMutation({
    mutationFn: () => discardCorrection(programId, versionId, correctionId),
    onSuccess: invalidate,
  });
}

// MH-10 writes refresh the selectors every release form reads.
function useInvalidateOptions() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: RELEASE_OPTIONS_QUERY_ROOT,
    });
}

export function useCreateSemester() {
  const invalidate = useInvalidateOptions();
  return useMutation({
    mutationFn: (body: SemesterInput) => createSemester(body),
    onSuccess: invalidate,
  });
}

export function useUpdateSemester() {
  const invalidate = useInvalidateOptions();
  const invalidateReleased = useInvalidateReleased();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SemesterPatch }) =>
      updateSemester(id, body),
    // A start date that has been reached activates Pending versions on the server at once.
    onSuccess: () => Promise.all([invalidate(), invalidateReleased()]),
  });
}

export function useCreateCohort() {
  const invalidate = useInvalidateOptions();
  return useMutation({
    mutationFn: (body: CohortInput) => createCohort(body),
    onSuccess: invalidate,
  });
}

export function useUpdateCohort() {
  const invalidate = useInvalidateOptions();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CohortPatch }) =>
      updateCohort(id, body),
    onSuccess: invalidate,
  });
}
