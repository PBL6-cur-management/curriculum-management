import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { STUDENT_QUERY_ROOT } from '../../../shared/students/studentQueryRoot';
import {
  fetchCohorts,
  fetchSemesters,
  releaseOptionKeys,
} from '../../../shared/releases/semesters';
import {
  createStudentEnrollment,
  fetchAppliedVersion,
  fetchEnrollmentTargets,
  fetchStudent,
  fetchStudentPrograms,
  fetchStudentResults,
  fetchStudents,
  reconcileStudent,
  type EnrollmentCommand,
  type StudentContext,
  type StudentDetailContext,
  type StudentListParams,
  type StudentResultParams,
} from '../api/students';

export const studentKeys = {
  all: STUDENT_QUERY_ROOT,
  list: (params: StudentListParams) =>
    [...STUDENT_QUERY_ROOT, 'list', params] as const,
  programs: (semesterId: string) =>
    [...STUDENT_QUERY_ROOT, 'programs', semesterId] as const,
  detail: (studentId: string, context: StudentDetailContext) =>
    [...STUDENT_QUERY_ROOT, 'detail', studentId, context] as const,
  results: (studentId: string, params: StudentResultParams) =>
    [...STUDENT_QUERY_ROOT, 'results', studentId, params] as const,
  applied: (studentId: string, context: StudentContext) =>
    [...STUDENT_QUERY_ROOT, 'applied', studentId, context] as const,
  targets: (studentId: string, context: StudentContext) =>
    [...STUDENT_QUERY_ROOT, 'targets', studentId, context] as const,
};
const hasContext = (context: StudentContext) =>
  Boolean(context.programId && context.semesterId);
export function useStudentSemesters() {
  return useQuery({
    queryKey: releaseOptionKeys.semesters,
    queryFn: fetchSemesters,
  });
}
export function useStudentCohorts() {
  return useQuery({
    queryKey: releaseOptionKeys.cohorts,
    queryFn: fetchCohorts,
  });
}
export function useStudentPrograms(semesterId: string) {
  return useQuery({
    queryKey: studentKeys.programs(semesterId),
    queryFn: () => fetchStudentPrograms(semesterId),
    enabled: Boolean(semesterId),
  });
}
export function useStudents(params: StudentListParams) {
  return useQuery({
    queryKey: studentKeys.list(params),
    queryFn: () => fetchStudents(params),
    enabled: Boolean(params.semesterId),
    placeholderData: (previous, previousQuery) => {
      const prior = previousQuery?.queryKey[2] as StudentListParams | undefined;
      return prior &&
        prior.semesterId === params.semesterId &&
        prior.programId === params.programId &&
        prior.q === params.q &&
        prior.cohortId === params.cohortId &&
        prior.status === params.status
        ? keepPreviousData(previous)
        : undefined;
    },
  });
}
export function useStudent(studentId: string, context: StudentDetailContext) {
  return useQuery({
    queryKey: studentKeys.detail(studentId, context),
    queryFn: () => fetchStudent(studentId, context),
    enabled: Boolean(studentId && context.semesterId),
  });
}
export function useStudentResults(
  studentId: string,
  params: StudentResultParams,
) {
  return useQuery({
    queryKey: studentKeys.results(studentId, params),
    queryFn: () => fetchStudentResults(studentId, params),
    enabled: Boolean(studentId) && hasContext(params),
  });
}
export function useStudentAppliedVersion(
  studentId: string,
  context: StudentContext,
) {
  return useQuery({
    queryKey: studentKeys.applied(studentId, context),
    queryFn: () => fetchAppliedVersion(studentId, context),
    enabled: Boolean(studentId) && hasContext(context),
  });
}
export function useEnrollmentTargets(
  studentId: string,
  context: StudentContext,
  enabled: boolean,
) {
  return useQuery({
    queryKey: studentKeys.targets(studentId, context),
    queryFn: () => fetchEnrollmentTargets(studentId, context),
    enabled: enabled && Boolean(studentId) && hasContext(context),
  });
}
export function useCreateStudentEnrollment(studentId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: EnrollmentCommand) =>
      createStudentEnrollment(studentId, body),
    retry: false,
    onSuccess: () => client.invalidateQueries({ queryKey: STUDENT_QUERY_ROOT }),
  });
}
export function useReconcileStudent(studentId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (expectedStudentUpdatedAt: string) =>
      reconcileStudent(studentId, { expectedStudentUpdatedAt }),
    retry: false,
    onSuccess: () => client.invalidateQueries({ queryKey: STUDENT_QUERY_ROOT }),
  });
}
