import {
  CourseStatus,
  SyllabusStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import type { EditState } from '../../shared/authz/edit-path.js';
import {
  PERMISSIONS,
  type PermissionCode,
} from '../../shared/authz/permission-codes.js';
import {
  assertEditPath,
  REQUEST_DRAFT_SELECT,
} from '../../shared/change-requests/request-draft.js';
import { courseTarget } from '../../shared/courses/course-target.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { HOME_FACULTY_CODE } from '../../shared/org-units/home-faculty.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import { SYLLABUS_ERRORS } from './syllabus.errors.js';

export const SYLLABUS_COURSE_SELECT = {
  id: true,
  courseCode: true,
  courseName: true,
  englishName: true,
  credits: true,
  status: true,
  ownerFacultyId: true,
  ownerGroupId: true,
  ownerFaculty: { select: { unitCode: true } },
} as const satisfies Prisma.CourseSelect;
export type SyllabusCourseRow = Prisma.CourseGetPayload<{
  select: typeof SYLLABUS_COURSE_SELECT;
}>;

export const SYLLABUS_ACCESS_SELECT = {
  id: true,
  status: true,
  courseId: true,
  course: { select: SYLLABUS_COURSE_SELECT },
  ...REQUEST_DRAFT_SELECT,
} as const satisfies Prisma.SyllabusSelect;
export type SyllabusAccessRow = Prisma.SyllabusGetPayload<{
  select: typeof SYLLABUS_ACCESS_SELECT;
}>;

// The syllabus follows the course: home-faculty courses are open to request holders until a revision is published.
// HISTORICAL counts as released too: a superseded revision still means the syllabus has been published.
export async function syllabusEditState(
  prisma: Pick<PrismaService, 'syllabus'>,
  course: SyllabusCourseRow,
): Promise<EditState> {
  const published = await prisma.syllabus.findFirst({
    where: { courseId: course.id, status: { not: SyllabusStatus.DRAFT } },
    select: { id: true },
  });
  return {
    released: published !== null,
    draftOpenToRequestHolders:
      course.ownerFaculty.unitCode === HOME_FACULTY_CODE,
  };
}

// Students (program.view scoped to their own program) read published revisions only.
export function seesDrafts(access: AccessContext): boolean {
  return (
    access.has(PERMISSIONS.PROGRAM_VIEW) &&
    access.scopeFor(PERMISSIONS.PROGRAM_VIEW).all
  );
}

export function assertCourseVisible(
  course: SyllabusCourseRow | null,
  access: AccessContext,
): asserts course is SyllabusCourseRow {
  if (
    !course ||
    (course.status === CourseStatus.CANCELLED &&
      !access.has(PERMISSIONS.COURSE_EDIT))
  ) {
    throw new AppException(SYLLABUS_ERRORS.COURSE_NOT_FOUND);
  }
}

export function assertRevisionVisible(
  row: SyllabusAccessRow | null,
  access: AccessContext,
): asserts row is SyllabusAccessRow {
  if (!row || (row.status === SyllabusStatus.DRAFT && !seesDrafts(access))) {
    throw new AppException(SYLLABUS_ERRORS.SYLLABUS_NOT_FOUND);
  }
  assertCourseVisible(row.course, access);
}

// Every write to a revision or its rows goes through here, in this order. CLO writes pass clo.edit.
// A request's working copy is writable by its creator while the request is a Draft (F-13); published data is not.
export async function assertDraftWrite(
  prisma: Pick<PrismaService, 'syllabus'>,
  access: AccessContext,
  row: SyllabusAccessRow | null,
  permission: PermissionCode = PERMISSIONS.SYLLABUS_EDIT,
): Promise<SyllabusAccessRow> {
  assertRevisionVisible(row, access);
  await assertEditPath(
    access,
    permission,
    courseTarget(row.course),
    row.sourceRequest,
    () => syllabusEditState(prisma, row.course),
    row.course.ownerFaculty.unitCode !== HOME_FACULTY_CODE,
  );
  if (row.status !== SyllabusStatus.DRAFT) {
    throw new AppException(SYLLABUS_ERRORS.SYLLABUS_NOT_DRAFT);
  }
  if (row.course.status === CourseStatus.CANCELLED) {
    throw new AppException(SYLLABUS_ERRORS.COURSE_CANCELLED);
  }
  return row;
}

// Every write to a revision's rows touches the revision's updatedAt ("Cập nhật lúc").
export function touchSyllabus(
  client: Pick<PrismaService, 'syllabus'>,
  syllabusId: string,
): Promise<unknown> {
  return client.syllabus.update({
    where: { id: syllabusId },
    data: { updatedAt: new Date() },
  });
}
