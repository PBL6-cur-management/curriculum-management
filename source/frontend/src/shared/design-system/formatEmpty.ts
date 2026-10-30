// Nhãn cho giá trị trống: nói rõ "Chưa có" thay vì gạch ngang không nghĩa.
export const EMPTY_LABEL = 'Chưa có';

export function formatEmpty(
  value: string | number | null | undefined,
  label: string = EMPTY_LABEL,
): string {
  if (value === null || value === undefined) return label;
  const text = String(value);
  return text.trim() === '' ? label : text;
}
