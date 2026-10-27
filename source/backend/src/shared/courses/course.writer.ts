import {
  CourseStatus,
  CourseType,
  Prisma,
} from '../../generated/prisma/client.js';
import type { CourseRequestField } from '../change-requests/authored-item.types.js';
import { CREDITS_PATTERN } from '../decimal/decimal.js';
import { AppException } from '../exception/app.exception.js';
import { HOME_FACULTY_CODE } from '../org-units/home-faculty.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  COURSE_WRITE_ERRORS,
  OWNER_CONSTRAINT,
} from './course-write.errors.js';

import { ownerProblem, OWNER_PROBLEM } from './course-owners.js';

type Db = PrismaService | Prisma.TransactionClient;

export interface Owners {
  ownerFacultyId: string;
  ownerGroupId: string | null;
  isForeign: boolean;
}

// The faculty must be an active FACULTY unit and the group an active group of that faculty (US-012).
export async function assertCourseOwners(
  db: Db,
  ownerFacultyId: string,
  ownerGroupId: string | null,
): Promise<Owners> {
  const faculty = await db.orgUnit.findUnique({
    where: { id: ownerFacultyId },
  });
  if (ownerProblem(faculty, null, false) === OWNER_PROBLEM.FACULTY_INVALID) {
    throw new AppException(COURSE_WRITE_ERRORS.OWNER_FACULTY_INVALID, [
      {
        field: 'ownerFacultyId',
        constraints: [OWNER_CONSTRAINT.ACTIVE_FACULTY],
      },
    ]);
  }
  if (ownerGroupId !== null) {
    const group = await db.subjectGroup.findUnique({
      where: { id: ownerGroupId },
    });
    if (ownerProblem(faculty, group, true) === OWNER_PROBLEM.GROUP_INVALID) {
      throw new AppException(COURSE_WRITE_ERRORS.OWNER_GROUP_INVALID, [
        {
          field: 'ownerGroupId',
          constraints: [OWNER_CONSTRAINT.GROUP_OF_FACULTY],
        },
      ]);
    }
  }
  return {
    ownerFacultyId,
    ownerGroupId,
    isForeign: faculty!.unitCode !== HOME_FACULTY_CODE,
  };
}

// A course attribute changed by an approved request (F-13 authors it, F-15 applies it). The request's three levels
// stand in for the edit-path check; every data rule of the catalog edit still runs on the value.
export async function applyApprovedCourseField(
  tx: Prisma.TransactionClient,
  courseId: string,
  field: CourseRequestField,
  value: string | null,
): Promise<void> {
  const current = await tx.course.findUniqueOrThrow({
    where: { id: courseId },
  });
  if (current.status === CourseStatus.CANCELLED) {
    throw new AppException(COURSE_WRITE_ERRORS.COURSE_CANCELLED);
  }
  const data = await courseFieldData(tx, current.ownerFacultyId, field, value);
  await tx.course.update({ where: { id: courseId }, data });
}

async function courseFieldData(
  tx: Prisma.TransactionClient,
  ownerFacultyId: string,
  field: CourseRequestField,
  value: string | null,
): Promise<Prisma.CourseUpdateInput> {
  const invalid = () =>
    new AppException(COURSE_WRITE_ERRORS.COURSE_FIELD_INVALID, [
      { field, constraints: [COURSE_WRITE_ERRORS.COURSE_FIELD_INVALID.code] },
    ]);
  switch (field) {
    case 'courseName':
      if (value === null || value.trim() === '') throw invalid();
      return { courseName: value };
    case 'englishName':
      return { englishName: value };
    case 'credits':
      if (value === null || !CREDITS_PATTERN.test(value)) throw invalid();
      return { credits: new Prisma.Decimal(value) };
    case 'courseType':
      if (
        value === null ||
        !(Object.values(CourseType) as string[]).includes(value)
      ) {
        throw invalid();
      }
      return { courseType: value as CourseType };
    case 'ownerGroupId':
      await assertCourseOwners(tx, ownerFacultyId, value);
      return {
        ownerGroup:
          value === null ? { disconnect: true } : { connect: { id: value } },
      };
  }
}
