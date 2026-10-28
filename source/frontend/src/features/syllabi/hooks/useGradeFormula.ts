import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CHANGE_REQUEST_QUERY_ROOT } from '../../../shared/change-requests/changeRequestQueryRoot';
import {
  replaceAssessmentMappings,
  replaceGradeFormula,
  type GradeFormula,
  type ReplaceAssessmentMappingsRequest,
  type ReplaceGradeFormulaRequest,
} from '../api/syllabi';
import { SYLLABUS_QUERY_KEYS } from './useSyllabus';

// Release checks answer from the same formulas; the key is repeated here because features do not import each other.
const ASSESSMENT_RELEASE_QUERY_ROOT = ['releases'] as const;

export interface FormulaMutationInput {
  syllabusId: string;
  body: ReplaceGradeFormulaRequest;
}
export interface MappingMutationInput {
  syllabusId: string;
  body: ReplaceAssessmentMappingsRequest;
}

// The response is only the aggregate: the course's syllabus is refetched, never patched, so timestamps and
// capability flags stay the server's. The save settles after the refetch completes.
function useAssessmentMutation<TVars>(
  courseId: string,
  mutationFn: (vars: TVars) => Promise<GradeFormula>,
) {
  const queryClient = useQueryClient();
  return useMutation<GradeFormula, Error, TVars>({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: SYLLABUS_QUERY_KEYS.courseRoot(courseId),
        }),
        queryClient.invalidateQueries({ queryKey: CHANGE_REQUEST_QUERY_ROOT }),
        queryClient.invalidateQueries({
          queryKey: ASSESSMENT_RELEASE_QUERY_ROOT,
        }),
      ]);
    },
  });
}

export const useReplaceGradeFormula = (courseId: string) =>
  useAssessmentMutation(
    courseId,
    ({ syllabusId, body }: FormulaMutationInput) =>
      replaceGradeFormula(syllabusId, body),
  );

export const useReplaceAssessmentMappings = (courseId: string) =>
  useAssessmentMutation(
    courseId,
    ({ syllabusId, body }: MappingMutationInput) =>
      replaceAssessmentMappings(syllabusId, body),
  );
