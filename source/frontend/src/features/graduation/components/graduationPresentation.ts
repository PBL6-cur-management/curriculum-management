import dayjs from 'dayjs';

export function displayCredits(value: string | null): string {
  return value === null ? 'Không quy định' : value.replace('.', ',');
}
export function displayTime(value: string | null): string {
  return value ? dayjs(value).format('DD/MM/YYYY HH:mm') : 'Chưa có';
}
export function displayGpa(
  cumulativeGpa?: string | null,
  minGraduationGpa?: string | null,
): string {
  const actual =
    cumulativeGpa === undefined || cumulativeGpa === null
      ? 'Chưa có'
      : cumulativeGpa;
  return minGraduationGpa ? `${actual} / ${minGraduationGpa}` : actual;
}
