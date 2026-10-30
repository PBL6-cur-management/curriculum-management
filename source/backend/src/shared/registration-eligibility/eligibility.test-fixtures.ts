import { Prisma } from '../../generated/prisma/client.js';
import type { AcademicAttemptFact } from '../students/best-academic-results.js';
import type {
  EligibilityEvaluationContext,
  EligibilityRequisiteFact,
  EligibilityRowFact,
} from './eligibility.types.js';

export function eligibilityFixture(
  ids: readonly string[] = ['A', 'B', 'C'],
): EligibilityEvaluationContext {
  const rows: EligibilityRowFact[] = ids.map((id, index) => ({
    itemId: `item-${id}`,
    course: {
      id,
      courseCode: id,
      courseName: `Frozen ${id}`,
      nameSource: 'SNAPSHOT',
    },
    credits: new Prisma.Decimal(0),
    catalogStatus: 'ACTIVE',
    plannedSemester: 1,
    sortOrder: index,
    minStudiedScore: null,
    requisites: [],
  }));
  return {
    resolution: {
      studentId: 'student',
      enrollmentId: 'enrollment',
      programId: 'program',
      semesterId: 'semester',
      programVersionId: 'version',
      source: 'COHORT',
      cohortAssignmentId: 'assignment',
    },
    rows,
    courses: new Map(
      rows.map((row) => [
        row.course.id,
        {
          course: row.course,
          status: 'ACTIVE',
          equivalenceGroupId: null,
          activeReplacementIds: [],
        },
      ]),
    ),
    equivalents: new Map(ids.map((id) => [id, new Set([id])])),
    attempts: new Map(),
    warnings: [],
  };
}
export function withRequisites(
  context: EligibilityEvaluationContext,
  edges: readonly (readonly [
    string,
    string,
    EligibilityRequisiteFact['relationType'],
    string?,
  ])[],
): EligibilityEvaluationContext {
  return {
    ...context,
    rows: context.rows.map((row) => ({
      ...row,
      requisites: edges
        .filter(([target]) => target === row.course.id)
        .map(([target, source, relationType, score], index) => ({
          id: `${target}-${index}`,
          targetCourseId: target,
          sourceCourseId: source,
          relationType,
          minScore: score === undefined ? null : new Prisma.Decimal(score),
        })),
    })),
  };
}
export function attempt(
  courseId: string,
  status: AcademicAttemptFact['status'],
  score4: string | null = null,
  id = `result-${courseId}`,
): AcademicAttemptFact {
  return {
    id,
    studentId: 'student',
    courseId,
    semesterId: 'semester',
    semesterStart: new Date('2026-01-01'),
    score10: null,
    score4,
    letterGrade: null,
    status,
    dataSource: 'EXCEL',
    revision: 1,
  };
}
export function withAttempts(
  context: EligibilityEvaluationContext,
  attempts: readonly AcademicAttemptFact[],
): EligibilityEvaluationContext {
  const groups = new Map<string, AcademicAttemptFact[]>();
  attempts.forEach((row) =>
    groups.set(row.courseId, [...(groups.get(row.courseId) ?? []), row]),
  );
  return { ...context, attempts: groups };
}
