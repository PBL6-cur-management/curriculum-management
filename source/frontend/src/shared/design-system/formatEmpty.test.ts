import { describe, expect, it } from 'vitest';
import { EMPTY_LABEL, formatEmpty } from './formatEmpty';

describe('formatEmpty', () => {
  it('names missing values instead of showing a dash', () => {
    expect(formatEmpty(null)).toBe(EMPTY_LABEL);
    expect(formatEmpty(undefined)).toBe(EMPTY_LABEL);
    expect(formatEmpty('   ')).toBe(EMPTY_LABEL);
  });
  it('keeps real values, zero included', () => {
    expect(formatEmpty(0)).toBe('0');
    expect(formatEmpty('K2021')).toBe('K2021');
  });
  it('accepts a context-specific label', () => {
    expect(formatEmpty(null, 'Chưa gán')).toBe('Chưa gán');
  });
});
