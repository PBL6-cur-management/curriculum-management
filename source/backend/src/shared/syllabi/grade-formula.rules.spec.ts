import { describe, expect, it } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import {
  ASSESSMENT_CONDITION,
  assessmentIssues,
  totalAssessmentWeight,
  uncoveredClos,
  weightTotalMessage,
  type AssessmentRuleComponent,
  type AssessmentRuleInput,
} from './grade-formula.rules.js';

const CLOS = [
  { id: 'c1', cloCode: 'CLO1', sortOrder: 1 },
  { id: 'c2', cloCode: 'CLO2', sortOrder: 2 },
];

function component(
  code: string,
  weight: string,
  over: Partial<AssessmentRuleComponent> = {},
): AssessmentRuleComponent {
  return {
    componentCode: code,
    weight,
    isConditional: false,
    conditionThreshold: null,
    failingScore: null,
    mappings: [
      { cloId: 'c1', cloWeight: null },
      { cloId: 'c2', cloWeight: null },
    ],
    ...over,
  };
}

function input(
  components: AssessmentRuleComponent[],
  over: Partial<AssessmentRuleInput> = {},
): AssessmentRuleInput {
  return {
    failingScore: null,
    clos: CLOS,
    assessmentComponents: components,
    ...over,
  };
}

const codes = (i: AssessmentRuleInput) =>
  assessmentIssues(i).map((issue) => issue.code);

describe('assessmentIssues', () => {
  it('accepts an exact 100 total split three ways', () => {
    const i = input([
      component('A', '33.33'),
      component('B', '33.33'),
      component('C', '33.34'),
    ]);
    expect(totalAssessmentWeight(i.assessmentComponents).toString()).toBe(
      '100',
    );
    expect(assessmentIssues(i)).toEqual([]);
  });

  it('names the missing and the excess percentage', () => {
    expect(weightTotalMessage(new Prisma.Decimal(90))).toBe(
      'Tổng trọng số là 90%, còn thiếu 10%. Điều chỉnh để tổng bằng 100%.',
    );
    expect(weightTotalMessage(new Prisma.Decimal(110))).toContain('vượt 10%');
    expect(codes(input([component('A', '90')]))).toEqual([
      ASSESSMENT_CONDITION.WEIGHT_TOTAL,
    ]);
  });

  it('rejects an empty formula', () => {
    expect(codes(input([]))).toContain(ASSESSMENT_CONDITION.FORMULA_EMPTY);
  });

  it('rejects zero, over-100 and malformed weights', () => {
    for (const weight of ['0', '100.01', '1e2', '', 'NaN', '1,5']) {
      expect(
        codes(input([component('A', weight)])),
        `weight ${weight}`,
      ).toContain(ASSESSMENT_CONDITION.COMPONENT_INVALID);
    }
  });

  it('rejects duplicate codes after normalization', () => {
    const issues = assessmentIssues(
      input([component('gk', '50'), component(' GK ', '50')]),
    );
    expect(issues.map((issue) => issue.field)).toContain(
      'components.1.componentCode',
    );
  });

  it('requires a threshold for a conditional component but accepts zero', () => {
    expect(
      codes(input([component('A', '100', { isConditional: true })])),
    ).toContain(ASSESSMENT_CONDITION.CONDITIONAL_THRESHOLD);
    expect(
      assessmentIssues(
        input([
          component('A', '100', {
            isConditional: true,
            conditionThreshold: '0',
          }),
        ]),
      ),
    ).toEqual([]);
  });

  it('refuses a threshold on a non-conditional component and negative cutoffs', () => {
    expect(
      codes(input([component('A', '100', { conditionThreshold: '5' })])),
    ).toContain(ASSESSMENT_CONDITION.COMPONENT_INVALID);
    expect(
      codes(input([component('A', '100', { failingScore: '-1' })])),
    ).toContain(ASSESSMENT_CONDITION.COMPONENT_INVALID);
    expect(
      codes(input([component('A', '100')], { failingScore: '-0.5' })),
    ).toContain(ASSESSMENT_CONDITION.COMPONENT_INVALID);
  });

  it('treats a null cloWeight as a mapped cell', () => {
    const i = input([component('A', '100')]);
    expect(uncoveredClos(i)).toEqual([]);
    expect(assessmentIssues(i)).toEqual([]);
  });

  it('flags foreign, duplicate and out-of-range mappings and does not count foreign ones as coverage', () => {
    const i = input([
      component('A', '100', {
        mappings: [
          { cloId: 'c1', cloWeight: '0' },
          { cloId: 'c1', cloWeight: null },
          { cloId: 'other', cloWeight: null },
        ],
      }),
    ]);
    expect(
      codes(i).filter((c) => c === ASSESSMENT_CONDITION.MAPPING_INVALID),
    ).toHaveLength(3);
    expect(uncoveredClos(i).map((clo) => clo.cloCode)).toEqual(['CLO2']);
  });

  it('lists every uncovered CLO in CLO order even when the formula is complete', () => {
    const issues = assessmentIssues(
      input([component('A', '100', { mappings: [] })]),
    );
    expect(issues.map((issue) => issue.field)).toEqual([
      'clos.CLO1',
      'clos.CLO2',
    ]);
  });

  it('does not require a minimum number of CLOs', () => {
    expect(
      assessmentIssues(
        input([component('A', '100', { mappings: [] })], { clos: [] }),
      ),
    ).toEqual([]);
  });
});
