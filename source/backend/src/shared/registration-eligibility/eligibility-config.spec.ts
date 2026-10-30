import 'reflect-metadata';
import { validateEnv } from '../config/env.validation.js';

const raw = {
  DATABASE_URL: 'postgresql://test:test@localhost/synthetic',
  SESSION_SECRET: 'synthetic-secret-with-at-least-32-chars',
};
describe('eligibility depth configuration', () => {
  it('defaults to twenty and coerces numeric environment strings', () => {
    expect(validateEnv(raw).ELIGIBILITY_MAX_DEPTH).toBe(20);
    expect(
      validateEnv({ ...raw, ELIGIBILITY_MAX_DEPTH: '1' }).ELIGIBILITY_MAX_DEPTH,
    ).toBe(1);
  });
  it.each(['0', '21', '1.5', 'NaN'])('rejects invalid depth %s', (value) => {
    expect(() => validateEnv({ ...raw, ELIGIBILITY_MAX_DEPTH: value })).toThrow(
      'Invalid environment',
    );
  });
});
