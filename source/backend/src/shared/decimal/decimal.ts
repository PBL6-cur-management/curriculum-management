import type { Prisma } from '../../generated/prisma/client.js';

// Decimal(5,2): up to three integer digits and two decimals.
export const CREDITS_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;
export const CREDITS_MESSAGE =
  'Số tín chỉ phải là số từ 0 đến 999.99, tối đa 2 chữ số thập phân (ví dụ 3, 2.5 hoặc 0).';

// Decimals travel as strings so the exact value survives JSON (F00-11).
export function toWireDecimal(value: Prisma.Decimal): string {
  return value.toString();
}

// 4-point scale, Decimal(4,2): 0 to 4 with at most two decimals (DEC-11).
export const GRADE_POINT_PATTERN = /^(4(\.0{1,2})?|[0-3](\.\d{1,2})?)$/;
export const GRADE_POINT_MESSAGE =
  'Ngưỡng điểm theo thang 4: từ 0 đến 4, tối đa 2 chữ số thập phân (ví dụ 2 hoặc 2.5).';

// 10-point scale, Decimal(4,2): 0 to 10 with at most two decimals (DEC-11 fix: prerequisite thresholds are 10-point).
export const SCORE10_PATTERN = /^(10(\.0{1,2})?|\d(\.\d{1,2})?)$/;
export const SCORE10_MESSAGE = 'Điểm phải từ 0 đến 10';
