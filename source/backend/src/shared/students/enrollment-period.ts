import type { Prisma } from '../../generated/prisma/client.js';
import type { StartedSemester } from '../releases/semester-start.js';

export interface PeriodRow {
  fromStart: Date | null;
  untilSemester: { startDate: Date | null } | null;
}

export function hasKnownEnrollmentBoundaries(
  row: PeriodRow,
): row is PeriodRow & { fromStart: Date } {
  return (
    row.fromStart !== null &&
    (row.untilSemester === null || row.untilSemester.startDate !== null)
  );
}

// Half-open [from, until): the semester that ends a stay is no longer covered, so a zero-length stay covers nothing.
export function coversSemester(row: PeriodRow, semesterStart: Date): boolean {
  if (!hasKnownEnrollmentBoundaries(row)) return false;
  if (row.fromStart.getTime() > semesterStart.getTime()) return false;
  const untilStart = row.untilSemester?.startDate;
  return !untilStart || semesterStart.getTime() < untilStart.getTime();
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
