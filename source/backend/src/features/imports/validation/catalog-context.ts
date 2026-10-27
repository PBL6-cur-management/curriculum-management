import type { Course, Prisma } from '../../../generated/prisma/client.js';
import type { CourseUsageReader } from '../../../shared/courses/course-usage.reader.js';
import type {
  OwnerFacultyRow,
  OwnerGroupRow,
} from '../../../shared/courses/course-owners.js';
import { HOME_FACULTY_CODE } from '../../../shared/org-units/home-faculty.js';

export type CatalogCourseRow = Pick<
  Course,
  | 'id'
  | 'courseCode'
  | 'courseName'
  | 'englishName'
  | 'credits'
  | 'courseType'
  | 'status'
  | 'ownerFacultyId'
  | 'ownerGroupId'
>;
export interface CatalogContext {
  coursesByCode: Map<string, CatalogCourseRow>;
  releasedCourseIds: Set<string>;
  facultiesByCode: Map<string, OwnerFacultyRow>;
  groupsByCode: Map<string, OwnerGroupRow>;
  homeFacultyCode: string;
}

export async function loadCatalogContext(
  client: Prisma.TransactionClient,
  usage: CourseUsageReader,
  codes: readonly string[],
): Promise<CatalogContext> {
  const [courses, faculties, groups] = await Promise.all([
    client.course.findMany({ where: { courseCode: { in: [...codes] } } }),
    client.orgUnit.findMany(),
    client.subjectGroup.findMany(),
  ]);
  return {
    coursesByCode: new Map(
      courses.map((course) => [course.courseCode, course]),
    ),
    releasedCourseIds: await usage.releasedCourseIds(
      courses.map((course) => course.id),
      client,
    ),
    facultiesByCode: new Map(
      faculties.map((faculty) => [faculty.unitCode, faculty]),
    ),
    groupsByCode: new Map(groups.map((group) => [group.groupCode, group])),
    homeFacultyCode: HOME_FACULTY_CODE,
  };
}
