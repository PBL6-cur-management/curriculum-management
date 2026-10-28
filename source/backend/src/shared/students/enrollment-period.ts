import type { Prisma } from '../../generated/prisma/client.js';
import type { StartedSemester } from '../releases/semester-start.js';

export interface PeriodRow {
  fromStart: Date | null;
  untilStart: Date | null;
}

// Half-open [from, until): the semester that ends a stay is no longer covered, so a zero-length stay covers nothing.
export function coversSemester(row: PeriodRow, semesterStart: Date): boolean {
  if (!row.fromStart) return false;
  if (row.fromStart.getTime() > semesterStart.getTime()) return false;
  return !row.untilStart || semesterStart.getTime() < row.untilStart.getTime();
}

export function enrollmentCoversWhere(
  semester: StartedSemester,
): Prisma.ProgramEnrollmentWhereInput {
  return {
    fromSemester: { startDate: { lte: semester.startDate } },
    OR: [
      { untilSemesterId: null },
      { untilSemester: { startDate: { gt: semester.startDate } } },
    ],
  };
}
