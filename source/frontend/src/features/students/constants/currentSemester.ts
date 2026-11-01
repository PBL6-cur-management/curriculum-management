import type { Semester } from '../../../shared/releases/semesters';

// The semester a student list opens on: the latest one already started, else the first one with a start date.
export function currentSemester(
  semesters: readonly Semester[],
  today = new Date().toISOString().slice(0, 10),
): Semester | undefined {
  const dated = semesters
    .filter((semester) => semester.startDate)
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  const started = dated.filter(
    (semester) => String(semester.startDate).slice(0, 10) <= today,
  );
  return started.at(-1) ?? dated[0];
}
