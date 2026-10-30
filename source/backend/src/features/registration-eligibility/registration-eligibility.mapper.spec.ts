import { evaluateEligibility } from '../../shared/registration-eligibility/eligibility-evaluator.js';
import { eligibilityFixture } from '../../shared/registration-eligibility/eligibility.test-fixtures.js';
import { toRegistrationEligibilityDto } from './registration-eligibility.mapper.js';

describe('eligibility mapper', () => {
  const context = eligibilityFixture();
  const answer = {
    contractVersion: 1 as const,
    context: context.resolution,
    evaluatedAt: '2026-10-29T00:00:00.000Z',
    ...evaluateEligibility(context, { maxDepth: 20 }),
  };
  it('whitelists fresh nested objects and preserves exact strings/nulls', () => {
    const result = toRegistrationEligibilityDto({
      ...answer,
      secret: 'private',
    } as typeof answer);
    expect(result).toEqual(answer);
    expect(result).not.toHaveProperty('secret');
    expect(result.context).not.toBe(answer.context);
    expect(result.items[0].course).not.toBe(answer.items[0].course);
    expect(result.items[0].credits).toBe('0');
  });
  it('rejects contradictory completed and conditional states', () => {
    for (const patch of [
      { completed: true },
      { eligibility: 'CONDITIONAL' as const },
      { eligibility: null },
    ])
      expect(() =>
        toRegistrationEligibilityDto({
          ...answer,
          items: [{ ...answer.items[0], ...patch }],
        }),
      ).toThrow();
  });
});
