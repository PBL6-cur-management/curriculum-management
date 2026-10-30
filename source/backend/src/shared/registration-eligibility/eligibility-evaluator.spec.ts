import { evaluateEligibility } from './eligibility-evaluator.js';
import {
  attempt,
  eligibilityFixture,
  withAttempts,
  withRequisites,
} from './eligibility.test-fixtures.js';

const options = { maxDepth: 20 };
describe('eligibility evaluator', () => {
  it('returns eligible with authoritative empty rules and preserves zero credits', () => {
    const answer = evaluateEligibility(eligibilityFixture(), options);
    expect(
      answer.items.every(
        (item) =>
          item.eligibility === 'ELIGIBLE' &&
          !item.reasons.length &&
          item.credits === '0',
      ),
    ).toBe(true);
  });
  it.each([
    ['2.49', 'INELIGIBLE'],
    ['2.5', 'ELIGIBLE'],
    ['2.51', 'ELIGIBLE'],
  ] as const)('compares Decimal threshold %s', (score, expected) => {
    const context = withAttempts(
      withRequisites(eligibilityFixture(), [['A', 'B', 'PREREQUISITE', '2.5']]),
      [attempt('B', 'PASSED', score)],
    );
    expect(evaluateEligibility(context, options).items[0].eligibility).toBe(
      expected,
    );
  });
  it.each([
    ['0', 'ELIGIBLE'],
    ['2.5', 'INELIGIBLE'],
  ] as const)('does not invent exemption scores at %s', (score, expected) => {
    const context = withAttempts(
      withRequisites(eligibilityFixture(), [['A', 'B', 'PREREQUISITE', score]]),
      [attempt('B', 'EXEMPT')],
    );
    const answer = evaluateEligibility(context, options);
    expect(answer.items[0].eligibility).toBe(expected);
    if (expected === 'INELIGIBLE')
      expect(answer.items[0].reasons[0].code).toBe(
        'PREREQUISITE_SCORE_MISSING',
      );
  });
  it('removes completed nodes even when their own requirements fail', () => {
    const context = withAttempts(
      withRequisites(eligibilityFixture(), [
        ['A', 'B', 'COREQUISITE'],
        ['B', 'C', 'PREREQUISITE'],
      ]),
      [attempt('B', 'PASSED')],
    );
    const answer = evaluateEligibility(context, options);
    expect(answer.items[0].eligibility).toBe('ELIGIBLE');
    expect(answer.items[1]).toMatchObject({
      completed: true,
      eligibility: null,
      requiredConcurrentCourses: [],
    });
    expect(answer.items[1].reasons).toHaveLength(1);
  });
  it('returns the entire transitive reciprocal bundle', () => {
    const context = withRequisites(eligibilityFixture(), [
      ['A', 'B', 'COREQUISITE'],
      ['B', 'A', 'COREQUISITE'],
      ['B', 'C', 'COREQUISITE'],
    ]);
    const answer = evaluateEligibility(context, options);
    expect(answer.items[0].eligibility).toBe('CONDITIONAL');
    expect(
      answer.items[0].requiredConcurrentCourses.map((course) => course.id),
    ).toEqual(['B', 'C']);
  });
  it('propagates leaf blockers without nested messages and returns no actionable bundle', () => {
    const context = withRequisites(eligibilityFixture(['A', 'B', 'C', 'D']), [
      ['A', 'B', 'COREQUISITE'],
      ['B', 'C', 'COREQUISITE'],
      ['C', 'D', 'PREREQUISITE', '2.5'],
    ]);
    const item = evaluateEligibility(context, options).items[0];
    expect(item).toMatchObject({
      eligibility: 'INELIGIBLE',
      requiredConcurrentCourses: [],
    });
    expect(item.reasons[0]).toMatchObject({
      code: 'COREQUISITE_INELIGIBLE',
      causeCode: 'PREREQUISITE_NOT_PASSED',
      viaCourse: { id: 'B' },
      requiredCourse: { id: 'D' },
      requiredScore4: '2.5',
    });
    expect(item.reasons[0].path.map((course) => course.id)).toEqual([
      'A',
      'B',
      'C',
      'D',
    ]);
  });
  it.each([20, 21])(
    'counts %i condensed levels, not recursive calls',
    (length) => {
      const ids = Array.from({ length }, (_, index) =>
        String(index).padStart(2, '0'),
      );
      const context = withRequisites(
        eligibilityFixture(ids),
        ids.slice(1).map((id, index) => [ids[index], id, 'COREQUISITE']),
      );
      const item = evaluateEligibility(context, options).items[0];
      expect(item.eligibility).toBe(
        length === 20 ? 'CONDITIONAL' : 'INELIGIBLE',
      );
    },
  );
  it('explains an actual over-limit route even when a shorter shortcut reaches the boundary', () => {
    const ids = Array.from({ length: 21 }, (_, index) =>
      String(index).padStart(2, '0'),
    );
    const context = withRequisites(eligibilityFixture(ids), [
      ...ids
        .slice(1)
        .map((id, index) => [ids[index], id, 'COREQUISITE'] as const),
      ['00', '20', 'COREQUISITE'],
    ]);
    const reason = evaluateEligibility(context, options).items[0].reasons.find(
      (candidate) => candidate.code === 'COREQUISITE_DEPTH_LIMIT',
    )!;
    expect(reason.path.map((course) => course.id)).toEqual(ids);
    expect(new Set(reason.path.map((course) => course.id)).size).toBe(21);
  });
  it('inspects every member of a large SCC for hard blockers', () => {
    const ids = Array.from({ length: 25 }, (_, index) => `C${index}`);
    const context = withRequisites(eligibilityFixture([...ids, 'X']), [
      ...ids.map(
        (id, index) =>
          [id, ids[(index + 1) % ids.length], 'COREQUISITE'] as const,
      ),
      [ids[24], 'X', 'PRIOR'],
    ]);
    expect(evaluateEligibility(context, options).items[0].eligibility).toBe(
      'INELIGIBLE',
    );
  });
  it('fails closed for unfinished external corequisites but accepts completed external ones', () => {
    const base = withRequisites(eligibilityFixture(), [
      ['A', 'C', 'COREQUISITE'],
    ]);
    const context = {
      ...base,
      rows: base.rows.filter((row) => row.course.id !== 'C'),
    };
    expect(evaluateEligibility(context, options).items[0].reasons[0].code).toBe(
      'COREQUISITE_RULES_UNAVAILABLE',
    );
    expect(
      evaluateEligibility(
        withAttempts(context, [attempt('C', 'PASSED')]),
        options,
      ).items[0].eligibility,
    ).toBe('ELIGIBLE');
  });
  it('keeps diamond provenance deterministic and does not mutate facts', () => {
    const context = withRequisites(
      eligibilityFixture(['A', 'B', 'C', 'D', 'X']),
      [
        ['A', 'B', 'COREQUISITE'],
        ['A', 'C', 'COREQUISITE'],
        ['B', 'D', 'COREQUISITE'],
        ['C', 'D', 'COREQUISITE'],
        ['D', 'X', 'PRIOR'],
      ],
    );
    const before = JSON.stringify([...context.rows]);
    const answer = evaluateEligibility(context, options);
    expect(
      answer.items[0].reasons.map((reason) => reason.viaCourse?.id),
    ).toEqual(['B', 'C']);
    expect(
      evaluateEligibility(
        {
          ...context,
          rows: [...context.rows].reverse().map((row) => ({
            ...row,
            requisites: [...row.requisites].reverse(),
          })),
        },
        options,
      ),
    ).toEqual(answer);
    expect(JSON.stringify(context.rows)).toBe(before);
  });
});
