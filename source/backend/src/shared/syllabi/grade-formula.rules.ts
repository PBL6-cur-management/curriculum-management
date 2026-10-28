import { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

export const GRADE_FORMULA_LIMITS = {
  TOTAL_PERCENT: 100,
  DECIMAL_PLACES: 2,
  COMPONENTS_MAX: 100,
  CODE_MAX: 20,
  NAME_MAX: 200,
  FORM_MAX: 2000,
  THRESHOLD_INTEGER_DIGITS: 7,
  // Retained rows hold codes in this namespace while a code swap is applied, so user codes may not use it.
  TEMPORARY_CODE_PREFIX: '__F12_TMP__',
} as const;
export const PERCENT_PATTERN = /^(?:\d{1,3})(?:\.\d{1,2})?$/;
export const THRESHOLD_PATTERN = /^\d{1,7}(?:\.\d{1,2})?$/;
export const PERCENT_MESSAGE =
  'Tỷ trọng là số lớn hơn 0 và không quá 100, tối đa 2 chữ số thập phân.';
export const THRESHOLD_MESSAGE =
  'Ngưỡng là số không âm, tối đa 7 chữ số nguyên và 2 chữ số thập phân.';

export const ASSESSMENT_CONDITION = {
  FORMULA_EMPTY: 'ASSESSMENT_FORMULA_EMPTY',
  WEIGHT_TOTAL: 'ASSESSMENT_WEIGHT_TOTAL_INVALID',
  COMPONENT_INVALID: 'ASSESSMENT_COMPONENT_INVALID',
  CONDITIONAL_THRESHOLD: 'ASSESSMENT_CONDITION_THRESHOLD_REQUIRED',
  CLO_UNCOVERED: 'ASSESSMENT_CLO_UNCOVERED',
  MAPPING_INVALID: 'ASSESSMENT_MAPPING_INVALID',
} as const;

type DecimalInput = string | Prisma.Decimal;

export interface AssessmentRuleClo {
  id: string;
  cloCode: string;
  sortOrder: number;
}
export interface AssessmentRuleComponent {
  id?: string;
  componentCode: string;
  weight: DecimalInput;
  isConditional: boolean;
  conditionThreshold: DecimalInput | null;
  failingScore: DecimalInput | null;
  mappings: readonly { cloId: string; cloWeight: DecimalInput | null }[];
}
export interface AssessmentRuleInput {
  failingScore: DecimalInput | null;
  clos: readonly AssessmentRuleClo[];
  assessmentComponents: readonly AssessmentRuleComponent[];
}
export interface AssessmentRuleIssue {
  code: (typeof ASSESSMENT_CONDITION)[keyof typeof ASSESSMENT_CONDITION];
  field: string;
  message: string;
}

const PLAIN_DECIMAL = /^\d+(?:\.\d+)?$/;

// Strings must be plain decimals: blanks, commas, exponents, NaN and Infinity are never coerced.
function parseDecimal(value: DecimalInput): Prisma.Decimal | null {
  if (typeof value === 'string') {
    return PLAIN_DECIMAL.test(value) ? new Prisma.Decimal(value) : null;
  }
  return value.isFinite() ? value : null;
}

export function totalAssessmentWeight(
  components: readonly AssessmentRuleComponent[],
): Prisma.Decimal {
  let total = new Prisma.Decimal(0);
  for (const component of components) {
    const weight = parseDecimal(component.weight);
    if (weight) total = total.plus(weight);
  }
  return total;
}

export function weightTotalMessage(total: Prisma.Decimal): string {
  const gap = new Prisma.Decimal(GRADE_FORMULA_LIMITS.TOTAL_PERCENT).minus(
    total,
  );
  const direction = gap.isPositive()
    ? `còn thiếu ${gap.toString()}%`
    : `vượt ${gap.abs().toString()}%`;
  return `Tổng trọng số là ${total.toString()}%, ${direction}. Điều chỉnh để tổng bằng ${GRADE_FORMULA_LIMITS.TOTAL_PERCENT}%.`;
}

function isNonNegative(value: DecimalInput | null): boolean {
  if (value === null) return true;
  const parsed = parseDecimal(value);
  return parsed !== null && !parsed.isNegative();
}

function inPercentRange(value: DecimalInput): boolean {
  const parsed = parseDecimal(value);
  return parsed !== null && parsed.gt(0) && parsed.lte(100);
}

function componentIssues(
  component: AssessmentRuleComponent,
  index: number,
  seenCodes: Set<string>,
): AssessmentRuleIssue[] {
  const issues: AssessmentRuleIssue[] = [];
  const at = (field: string) => `components.${index}.${field}`;
  if (!inPercentRange(component.weight)) {
    issues.push({
      code: ASSESSMENT_CONDITION.COMPONENT_INVALID,
      field: at('weight'),
      message: 'Tỷ trọng phải lớn hơn 0 và không quá 100%.',
    });
  }
  const code = component.componentCode.trim().toUpperCase();
  if (seenCodes.has(code)) {
    issues.push({
      code: ASSESSMENT_CONDITION.COMPONENT_INVALID,
      field: at('componentCode'),
      message: `Mã thành phần ${code} bị trùng trong công thức.`,
    });
  }
  seenCodes.add(code);
  if (component.isConditional && component.conditionThreshold === null) {
    issues.push({
      code: ASSESSMENT_CONDITION.CONDITIONAL_THRESHOLD,
      field: at('conditionThreshold'),
      message: 'Thành phần điều kiện phải có ngưỡng điều kiện.',
    });
  } else if (
    (!component.isConditional && component.conditionThreshold !== null) ||
    !isNonNegative(component.conditionThreshold)
  ) {
    issues.push({
      code: ASSESSMENT_CONDITION.COMPONENT_INVALID,
      field: at('conditionThreshold'),
      message:
        'Ngưỡng điều kiện chỉ dùng cho thành phần điều kiện và phải là số không âm.',
    });
  }
  if (!isNonNegative(component.failingScore)) {
    issues.push({
      code: ASSESSMENT_CONDITION.COMPONENT_INVALID,
      field: at('failingScore'),
      message: 'Điểm liệt của thành phần phải là số không âm.',
    });
  }
  return issues;
}

function mappingIssues(input: AssessmentRuleInput): AssessmentRuleIssue[] {
  const issues: AssessmentRuleIssue[] = [];
  const cloIds = new Set(input.clos.map((clo) => clo.id));
  input.assessmentComponents.forEach((component, index) => {
    const seen = new Set<string>();
    component.mappings.forEach((mapping, cell) => {
      const field = `components.${index}.mappings.${cell}`;
      if (!cloIds.has(mapping.cloId) || seen.has(mapping.cloId)) {
        issues.push({
          code: ASSESSMENT_CONDITION.MAPPING_INVALID,
          field: `${field}.cloId`,
          message:
            'CLO không thuộc bản đề cương này hoặc đã được ánh xạ cho thành phần.',
        });
      }
      seen.add(mapping.cloId);
      if (mapping.cloWeight !== null && !inPercentRange(mapping.cloWeight)) {
        issues.push({
          code: ASSESSMENT_CONDITION.MAPPING_INVALID,
          field: `${field}.cloWeight`,
          message: 'Tỷ trọng CLO phải lớn hơn 0 và không quá 100%.',
        });
      }
    });
  });
  return issues;
}

// Coverage counts only mappings that point at a CLO of this revision.
export function uncoveredClos(input: AssessmentRuleInput): AssessmentRuleClo[] {
  const covered = new Set(
    input.assessmentComponents.flatMap((component) =>
      component.mappings.map((mapping) => mapping.cloId),
    ),
  );
  return [...input.clos]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
    .filter((clo) => !covered.has(clo.id));
}

export function assessmentIssues(
  input: AssessmentRuleInput,
): AssessmentRuleIssue[] {
  const issues: AssessmentRuleIssue[] = [];
  if (input.assessmentComponents.length === 0) {
    issues.push({
      code: ASSESSMENT_CONDITION.FORMULA_EMPTY,
      field: 'components',
      message: 'Chưa khai báo công thức điểm.',
    });
  } else {
    const total = totalAssessmentWeight(input.assessmentComponents);
    if (!total.eq(GRADE_FORMULA_LIMITS.TOTAL_PERCENT)) {
      issues.push({
        code: ASSESSMENT_CONDITION.WEIGHT_TOTAL,
        field: 'components',
        message: weightTotalMessage(total),
      });
    }
    const seenCodes = new Set<string>();
    input.assessmentComponents.forEach((component, index) => {
      issues.push(...componentIssues(component, index, seenCodes));
    });
  }
  if (!isNonNegative(input.failingScore)) {
    issues.push({
      code: ASSESSMENT_CONDITION.COMPONENT_INVALID,
      field: 'failingScore',
      message: 'Điểm liệt học phần phải là số không âm.',
    });
  }
  issues.push(...mappingIssues(input));
  for (const clo of uncoveredClos(input)) {
    issues.push({
      code: ASSESSMENT_CONDITION.CLO_UNCOVERED,
      field: `clos.${clo.cloCode}`,
      message: `${clo.cloCode} chưa được đánh giá bởi thành phần nào; thêm ánh xạ trước khi gửi duyệt hoặc ban hành.`,
    });
  }
  return issues;
}

export const ASSESSMENT_RULES_SELECT = {
  failingScore: true,
  clos: {
    select: { id: true, cloCode: true, sortOrder: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  },
  assessmentComponents: {
    select: {
      id: true,
      componentCode: true,
      weight: true,
      isConditional: true,
      conditionThreshold: true,
      failingScore: true,
      mappings: {
        select: { cloId: true, cloWeight: true },
        orderBy: [{ clo: { sortOrder: 'asc' } }, { id: 'asc' }],
      },
    },
    orderBy: [{ componentCode: 'asc' }, { id: 'asc' }],
  },
} as const satisfies Prisma.SyllabusSelect;

// A missing revision reads as an empty formula; callers resolve the revision before asking.
export async function loadAssessmentRules(
  db: PrismaService | Prisma.TransactionClient,
  syllabusId: string,
): Promise<AssessmentRuleInput> {
  const row = await db.syllabus.findUnique({
    where: { id: syllabusId },
    select: ASSESSMENT_RULES_SELECT,
  });
  return row ?? { failingScore: null, clos: [], assessmentComponents: [] };
}
