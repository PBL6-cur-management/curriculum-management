import { Prisma } from '../../generated/prisma/client.js';
import { compareCodepoints } from './eligibility.constants.js';
import type {
  AcademicEvidence,
  EligibilityEvaluationContext,
  EligibilityRequisiteFact,
  EligibilityRowFact,
} from './eligibility.types.js';

export function prerequisiteThreshold(
  requisite: EligibilityRequisiteFact,
  rowsByCourse: ReadonlyMap<string, EligibilityRowFact>,
): Prisma.Decimal | null {
  return (
    requisite.minScore ??
    rowsByCourse.get(requisite.sourceCourseId)?.minStudiedScore ??
    null
  );
}
export function compareEvidence(
  left: AcademicEvidence,
  right: AcademicEvidence,
): number {
  const leftScore = left.attempt.score4;
  const rightScore = right.attempt.score4;
  const score =
    leftScore === null
      ? rightScore === null
        ? 0
        : 1
      : rightScore === null
        ? -1
        : new Prisma.Decimal(rightScore).comparedTo(
            new Prisma.Decimal(leftScore),
          );
  return (
    score ||
    right.attempt.semesterStart.getTime() -
      left.attempt.semesterStart.getTime() ||
    compareCodepoints(left.course.courseCode, right.course.courseCode) ||
    compareCodepoints(left.attempt.id, right.attempt.id)
  );
}
function candidates(
  context: EligibilityEvaluationContext,
  ids: Iterable<string>,
): AcademicEvidence[] {
  return [...new Set(ids)]
    .flatMap((id) =>
      (context.attempts.get(id) ?? []).map((attempt) => ({
        attempt,
        course: context.courses.get(id)!.course,
      })),
    )
    .sort(compareEvidence);
}
export function completionEvidence(
  context: EligibilityEvaluationContext,
  courseId: string,
): AcademicEvidence | null {
  const recognized = candidates(
    context,
    context.equivalents.get(courseId) ?? [courseId],
  ).filter(
    (row) => row.attempt.status === 'PASSED' || row.attempt.status === 'EXEMPT',
  );
  return (
    recognized.find((row) => row.course.id === courseId) ??
    recognized[0] ??
    null
  );
}
export function priorEvidence(
  context: EligibilityEvaluationContext,
  courseId: string,
): AcademicEvidence | null {
  return (
    candidates(context, context.equivalents.get(courseId) ?? [courseId]).find(
      (row) => row.attempt.status !== 'IN_PROGRESS',
    ) ?? null
  );
}
export function prerequisiteCandidates(
  context: EligibilityEvaluationContext,
  sourceCourseId: string,
): readonly AcademicEvidence[] {
  const source = context.courses.get(sourceCourseId)!;
  const ids = new Set(
    context.equivalents.get(sourceCourseId) ?? [sourceCourseId],
  );
  if (source.status === 'DISCONTINUED')
    for (const replacement of source.activeReplacementIds)
      for (const id of context.equivalents.get(replacement) ?? [replacement])
        ids.add(id);
  return candidates(context, ids).filter(
    (row) => row.attempt.status === 'PASSED' || row.attempt.status === 'EXEMPT',
  );
}
