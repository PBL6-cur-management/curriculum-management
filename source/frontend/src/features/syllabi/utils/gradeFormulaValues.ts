export const FORMULA_VALUE_LIMITS = {
  TOTAL_PERCENT: 100,
  PERCENT_SCALE: 100,
  DECIMAL_PLACES: 2,
  COMPONENTS_MAX: 100,
  CODE_MAX: 20,
  NAME_MAX: 200,
  FORM_MAX: 2000,
  TEMPORARY_CODE_PREFIX: '__F12_TMP__',
} as const;

const PERCENT_PATTERN = /^\d{1,3}(?:\.\d{1,2})?$/;
const THRESHOLD_PATTERN = /^\d{1,7}(?:\.\d{1,2})?$/;

export interface WeightSummary {
  total: string;
  // 100 minus the total: positive is missing, negative is excess.
  difference: string;
  valid: boolean;
}

// One decimal comma becomes a dot; anything else (mixed separators, exponents) is left for validation to refuse.
export function normalizeDecimalInput(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') return null;
  const commas = trimmed.split(',').length - 1;
  return commas === 1 && !trimmed.includes('.')
    ? trimmed.replace(',', '.')
    : trimmed;
}

// Sums are integer hundredths so 33.33 + 33.33 + 33.34 is exactly 100.
function toHundredths(text: string): number {
  const [whole = '0', fraction = ''] = text.split('.');
  return (
    Number(whole) * FORMULA_VALUE_LIMITS.PERCENT_SCALE +
    Number(fraction.padEnd(FORMULA_VALUE_LIMITS.DECIMAL_PLACES, '0'))
  );
}

function formatHundredths(hundredths: number): string {
  const sign = hundredths < 0 ? '-' : '';
  const absolute = Math.abs(hundredths);
  const whole = Math.trunc(absolute / FORMULA_VALUE_LIMITS.PERCENT_SCALE);
  const fraction = String(absolute % FORMULA_VALUE_LIMITS.PERCENT_SCALE)
    .padStart(FORMULA_VALUE_LIMITS.DECIMAL_PLACES, '0')
    .replace(/0+$/, '');
  return `${sign}${whole}${fraction ? `.${fraction}` : ''}`;
}

export function isValidPercent(value: string | null | undefined): boolean {
  const text = normalizeDecimalInput(value);
  if (text === null || !PERCENT_PATTERN.test(text)) return false;
  const hundredths = toHundredths(text);
  return (
    hundredths > 0 &&
    hundredths <=
      FORMULA_VALUE_LIMITS.TOTAL_PERCENT * FORMULA_VALUE_LIMITS.PERCENT_SCALE
  );
}

// Optional: blank is valid, and so is zero.
export function isValidThreshold(value: string | null | undefined): boolean {
  const text = normalizeDecimalInput(value);
  return text === null || THRESHOLD_PATTERN.test(text);
}

export function summarizeWeights(values: readonly string[]): WeightSummary {
  let total = 0;
  let allValid = true;
  for (const value of values) {
    const text = normalizeDecimalInput(value);
    if (text !== null && isValidPercent(text)) {
      total += toHundredths(text);
    } else {
      allValid = false;
    }
  }
  const target =
    FORMULA_VALUE_LIMITS.TOTAL_PERCENT * FORMULA_VALUE_LIMITS.PERCENT_SCALE;
  return {
    total: formatHundredths(total),
    difference: formatHundredths(target - total),
    valid: allValid && values.length > 0 && total === target,
  };
}

// 'components.1.weight' becomes ['components', 1, 'weight'], the NamePath Form.setFields takes.
export function assessmentFieldPath(field: string): (string | number)[] {
  return field
    .split('.')
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

// Codes compare the way the server stores them: trimmed and upper-cased.
export function normalizeComponentCode(
  code: string | null | undefined,
): string {
  return (code ?? '').trim().toUpperCase();
}
