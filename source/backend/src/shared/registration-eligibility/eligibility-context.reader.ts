import { Prisma } from '../../generated/prisma/client.js';
import { AppException } from '../exception/app.exception.js';
import { issuedVersionFact } from '../releases/cohort-version-schedule.js';
import { requireSemesterStart } from '../releases/semester-start.js';
import type { AcademicAttemptFact } from '../students/best-academic-results.js';
import type { StudentAppliedVersionResult } from '../students/student-applied-version.types.js';
import {
  ELIGIBILITY_WARNING_PRIORITY,
  compareCodepoints,
} from './eligibility.constants.js';
import { ELIGIBILITY_ERRORS } from './eligibility.errors.js';
import { eligibilityWarning } from './eligibility-reasons.js';
import type {
  EligibilityCatalogFact,
  EligibilityEvaluationContext,
  EligibilityRowFact,
  EligibilityWarning,
} from './eligibility.types.js';

const invalid = () => new AppException(ELIGIBILITY_ERRORS.DATA_INVALID);
function validScore(value: Prisma.Decimal | null): boolean {
  return value === null || (value.isFinite() && value.gte(0) && value.lte(4));
}
function attemptScore(value: string | null): Prisma.Decimal | null {
  if (value === null) return null;
  try {
    return new Prisma.Decimal(value);
  } catch {
    throw invalid();
  }
}

export async function readEligibilityContext(
  tx: Prisma.TransactionClient,
  resolution: StudentAppliedVersionResult,
  attempts: readonly AcademicAttemptFact[],
): Promise<EligibilityEvaluationContext> {
  const version = await tx.programVersion.findFirst({
    where: {
      id: resolution.programVersionId,
      programId: resolution.programId,
      sourceRequestId: null,
    },
    include: {
      effectiveSemester: true,
      curriculumItems: {
        include: { course: true, requisites: true },
        orderBy: [
          { plannedSemester: 'asc' },
          { sortOrder: 'asc' },
          { id: 'asc' },
        ],
      },
    },
  });
  if (!version) throw invalid();
  issuedVersionFact(version);
  const semester = await requireSemesterStart(tx, resolution.semesterId);
  const ids = new Set(attempts.map((attempt) => attempt.courseId));
  for (const row of version.curriculumItems) {
    ids.add(row.courseId);
    row.requisites.forEach((edge) => ids.add(edge.sourceCourseId));
  }
  const initial = await tx.course.findMany({
    where: { id: { in: [...ids] } },
    include: {
      relationsAsSource: {
        where: {
          relationType: 'REPLACEMENT',
          targetCourse: { status: 'ACTIVE' },
        },
        include: { targetCourse: true },
      },
    },
  });
  if (initial.length !== ids.size) throw invalid();
  const metadata = new Map(initial.map((course) => [course.id, course]));
  const allMetadata = new Map(
    initial.map((course) => [course.id, { ...course }]),
  );
  const groupIds = new Set<string>();
  initial.forEach((course) => {
    if (course.equivalenceGroupId) groupIds.add(course.equivalenceGroupId);
    course.relationsAsSource.forEach((edge) => {
      const replacement = edge.targetCourse;
      if (replacement.id === course.id) throw invalid();
      allMetadata.set(replacement.id, {
        ...replacement,
        relationsAsSource: [],
      });
      if (replacement.equivalenceGroupId)
        groupIds.add(replacement.equivalenceGroupId);
    });
  });
  const members = await tx.course.findMany({
    where: { equivalenceGroupId: { in: [...groupIds] } },
  });
  members.forEach((course) => {
    if (!allMetadata.has(course.id))
      allMetadata.set(course.id, { ...course, relationsAsSource: [] });
  });
  const courses = new Map<string, EligibilityCatalogFact>();
  allMetadata.forEach((course) =>
    courses.set(course.id, {
      course: {
        id: course.id,
        courseCode: course.courseCode,
        courseName: course.courseName,
        nameSource: 'CATALOG',
      },
      status: course.status,
      equivalenceGroupId: course.equivalenceGroupId,
      activeReplacementIds:
        metadata
          .get(course.id)
          ?.relationsAsSource.map((edge) => edge.targetCourseId)
          .sort(compareCodepoints) ?? [],
    }),
  );
  const rows: EligibilityRowFact[] = version.curriculumItems.map((row) => {
    if (row.courseNameSnapshot === null || row.creditsSnapshot === null)
      throw new AppException(ELIGIBILITY_ERRORS.SNAPSHOT_INCOMPLETE);
    if (
      !validScore(row.minStudiedScore) ||
      !row.creditsSnapshot.isFinite() ||
      row.creditsSnapshot.lt(0)
    )
      throw invalid();
    const course = {
      id: row.courseId,
      courseCode: row.course.courseCode,
      courseName: row.courseNameSnapshot,
      nameSource: 'SNAPSHOT' as const,
    };
    courses.set(row.courseId, { ...courses.get(row.courseId)!, course });
    return {
      itemId: row.id,
      course,
      credits: row.creditsSnapshot,
      catalogStatus: row.course.status,
      plannedSemester: row.plannedSemester,
      sortOrder: row.sortOrder,
      minStudiedScore: row.minStudiedScore,
      requisites: row.requisites.map((edge) => {
        if (
          edge.sourceCourseId === row.courseId ||
          edge.relationType === 'REPLACEMENT' ||
          (edge.relationType !== 'PREREQUISITE' && edge.minScore !== null) ||
          !validScore(edge.minScore)
        )
          throw invalid();
        return {
          id: edge.id,
          targetCourseId: row.courseId,
          sourceCourseId: edge.sourceCourseId,
          relationType: edge.relationType,
          minScore: edge.minScore,
        };
      }),
    };
  });
  const equivalents = new Map<string, ReadonlySet<string>>();
  courses.forEach((course) =>
    equivalents.set(
      course.course.id,
      new Set(
        [...courses.values()]
          .filter(
            (other) =>
              other.course.id === course.course.id ||
              (course.equivalenceGroupId !== null &&
                other.equivalenceGroupId === course.equivalenceGroupId),
          )
          .map((other) => other.course.id),
      ),
    ),
  );
  const indexedAttempts = new Map<string, AcademicAttemptFact[]>();
  const attemptIds = new Set<string>();
  attempts.forEach((attempt) => {
    if (
      attempt.studentId !== resolution.studentId ||
      attemptIds.has(attempt.id) ||
      !Number.isFinite(attempt.semesterStart.getTime()) ||
      attempt.semesterStart > semester.startDate ||
      !validScore(attemptScore(attempt.score4))
    )
      throw invalid();
    attemptIds.add(attempt.id);
    const bucket = indexedAttempts.get(attempt.courseId) ?? [];
    bucket.push(attempt);
    indexedAttempts.set(attempt.courseId, bucket);
  });
  const warnings = new Map<string, EligibilityWarning>();
  const warn = (code: EligibilityWarning['code'], id: string) =>
    warnings.set(
      `${code}:${id}`,
      eligibilityWarning(code, courses.get(id)!.course),
    );
  const inFrame = new Set(rows.map((row) => row.course.id));
  rows.forEach((row) => {
    if (row.catalogStatus !== 'ACTIVE')
      warn('COURSE_NOT_ACTIVE', row.course.id);
    row.requisites.forEach((edge) => {
      const source = courses.get(edge.sourceCourseId)!;
      if (!inFrame.has(edge.sourceCourseId))
        warn('EXTERNAL_REQUISITE', edge.sourceCourseId);
      if (
        edge.relationType === 'PREREQUISITE' &&
        source.status === 'DISCONTINUED' &&
        !source.activeReplacementIds.length
      )
        warn('REPLACEMENT_UNAVAILABLE', edge.sourceCourseId);
    });
  });
  return {
    resolution,
    rows,
    courses,
    equivalents,
    attempts: indexedAttempts,
    warnings: [...warnings.values()].sort(
      (left, right) =>
        ELIGIBILITY_WARNING_PRIORITY[left.code] -
          ELIGIBILITY_WARNING_PRIORITY[right.code] ||
        compareCodepoints(left.course.courseCode, right.course.courseCode) ||
        compareCodepoints(left.course.id, right.course.id),
    ),
  };
}
