import { Prisma } from '../../generated/prisma/client.js';
import type { StudentDataSource } from '../../generated/prisma/client.js';
import type { AcademicResultValue } from './student-import.types.js';

export interface AcademicAttemptFact extends AcademicResultValue {
  id: string;
  semesterStart: Date;
  dataSource: StudentDataSource;
  revision: number;
}

export interface BestAcademicCourseFacts {
  courseId: string;
  attempts: readonly AcademicAttemptFact[];
  bestScoredAttempt: AcademicAttemptFact | null;
  hasPassedAttempt: boolean;
  isExempt: boolean;
  hasInProgressAttempt: boolean;
}

const codepointCompare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const chronological = (a: AcademicAttemptFact, b: AcademicAttemptFact) =>
  a.semesterStart.getTime() - b.semesterStart.getTime() ||
  codepointCompare(a.id, b.id);

// Better means a higher score4; a tie goes to the later semester, then to the smaller id so the choice never depends on input order.
function better(a: AcademicAttemptFact, b: AcademicAttemptFact): boolean {
  const byScore = new Prisma.Decimal(a.score4!).comparedTo(
    new Prisma.Decimal(b.score4!),
  );
  if (byScore !== 0) return byScore > 0;
  const byStart = a.semesterStart.getTime() - b.semesterStart.getTime();
  if (byStart !== 0) return byStart > 0;
  return codepointCompare(a.id, b.id) < 0;
}

// Source facts only: nothing is recomputed from marks, EXEMPT is not turned into a grade and IN_PROGRESS is not a failure.
export function bestAcademicResults(
  attempts: readonly AcademicAttemptFact[],
): BestAcademicCourseFacts[] {
  const byCourse = new Map<string, AcademicAttemptFact[]>();
  for (const attempt of attempts) {
    byCourse.set(attempt.courseId, [
      ...(byCourse.get(attempt.courseId) ?? []),
      attempt,
    ]);
  }
  return [...byCourse.entries()]
    .sort(([a], [b]) => codepointCompare(a, b))
    .map(([courseId, group]) => {
      const ordered = [...group].sort(chronological);
      let best: AcademicAttemptFact | null = null;
      for (const attempt of ordered) {
        const scored =
          (attempt.status === 'PASSED' || attempt.status === 'FAILED') &&
          attempt.score4 !== null;
        if (scored && (best === null || better(attempt, best))) best = attempt;
      }
      return {
        courseId,
        attempts: ordered,
        bestScoredAttempt: best,
        hasPassedAttempt: ordered.some((row) => row.status === 'PASSED'),
        isExempt: ordered.some((row) => row.status === 'EXEMPT'),
        hasInProgressAttempt: ordered.some(
          (row) => row.status === 'IN_PROGRESS',
        ),
      };
    });
}
