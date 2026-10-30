import dayjs from 'dayjs';

export function displayCredits(value: string | null): string {
  return value === null ? 'Không quy định' : value.replace('.', ',');
}
export function displayTime(value: string | null): string {
  return value ? dayjs(value).format('DD/MM/YYYY HH:mm') : 'Chưa có';
}
