import {
  CourseRelationType,
  CourseStatus,
  type Course,
  type CurriculumItem,
  type Prisma,
  type ProgramVersion,
} from '../../../generated/prisma/client.js';
import {
  CYCLE_CHECKED_TYPES,
  type RequisiteEdge,
} from '../../../shared/courses/requisite-graph.js';
import type { WarningGroup } from '../../../shared/curriculum/curriculum-warnings.js';

export type CurriculumCourseRow = Pick<
  Course,
  'id' | 'courseCode' | 'courseName' | 'credits' | 'status'
>;
export type ExistingItemRow = Pick<
  CurriculumItem,
  'id' | 'plannedSemester' | 'electiveGroupId'
> & { courseCode: string };
export interface CurriculumContext {
  version: Pick<
    ProgramVersion,
    | 'id'
    | 'semesterCount'
    | 'compulsoryCredits'
    | 'electiveCredits'
    | 'totalCredits'
  >;
  program: { programCode: string; programName: string; majorCode: string };
  coursesByCode: Map<string, CurriculumCourseRow>;
  existingItems: Map<string, ExistingItemRow>;
  groups: WarningGroup[];
  catalogEdges: RequisiteEdge[];
  catalogMinScores: Map<string, Prisma.Decimal>;
}

export async function loadCurriculumContext(
  client: Prisma.TransactionClient,
  versionId: string,
  codes: readonly string[],
): Promise<CurriculumContext> {
  const [version, courses, existing, groups, relations] = await Promise.all([
    client.programVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: { program: { select: { programCode: true } } },
    }),
    client.course.findMany({
      where: {
        OR: [
          { courseCode: { in: [...codes] } },
          {
            relationsAsSource: {
              some: { relationType: { in: [...CYCLE_CHECKED_TYPES] } },
            },
          },
          {
            relationsAsTarget: {
              some: { relationType: { in: [...CYCLE_CHECKED_TYPES] } },
            },
          },
        ],
      },
      select: {
        id: true,
        courseCode: true,
        courseName: true,
        credits: true,
        status: true,
      },
    }),
    client.curriculumItem.findMany({
      where: { versionId },
      select: {
        id: true,
        courseId: true,
        plannedSemester: true,
        electiveGroupId: true,
        course: { select: { courseCode: true } },
      },
    }),
    client.electiveGroup.findMany({
      where: { versionId },
      select: { id: true, groupCode: true, minCredits: true, minCourses: true },
    }),
    client.courseRelation.findMany({
      where: {
        relationType: { in: [...CYCLE_CHECKED_TYPES] },
        sourceCourse: { status: { not: CourseStatus.CANCELLED } },
        targetCourse: { status: { not: CourseStatus.CANCELLED } },
      },
      select: {
        sourceCourseId: true,
        targetCourseId: true,
        relationType: true,
        minScore: true,
      },
    }),
  ]);
  return {
    version,
    program: {
      programCode: version.program.programCode,
      programName: version.programName,
      majorCode: version.majorCode,
    },
    coursesByCode: new Map(
      courses.map((course) => [course.courseCode, course]),
    ),
    existingItems: new Map(
      existing.map((item) => [
        item.courseId,
        {
          id: item.id,
          plannedSemester: item.plannedSemester,
          electiveGroupId: item.electiveGroupId,
          courseCode: item.course.courseCode,
        },
      ]),
    ),
    groups,
    catalogEdges: relations.map(({ sourceCourseId, targetCourseId }) => ({
      sourceCourseId,
      targetCourseId,
    })),
    catalogMinScores: new Map(
      relations
        .filter(
          (relation) =>
            relation.relationType === CourseRelationType.PREREQUISITE &&
            relation.minScore !== null,
        )
        .map((relation) => [
          `${relation.sourceCourseId}>${relation.targetCourseId}`,
          relation.minScore!,
        ]),
    ),
  };
}
