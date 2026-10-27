import { CourseStatus } from '../../generated/prisma/client.js';

export const FIRST_SEMESTER = 1;

export function isSemesterInRange(
  semesterCount: number,
  semester: number,
): boolean {
  return (
    Number.isInteger(semester) &&
    semester >= FIRST_SEMESTER &&
    semester <= semesterCount
  );
}

export function isCourseAddable(status: CourseStatus): boolean {
  return status === CourseStatus.ACTIVE;
}
