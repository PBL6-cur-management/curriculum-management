import { describe, expect, it } from 'vitest';
import {
  assessmentFieldPath,
  isValidPercent,
  isValidThreshold,
  normalizeDecimalInput,
  summarizeWeights,
} from './gradeFormulaValues';

describe('summarizeWeights', () => {
  it('sums in hundredths so thirds do not drift', () => {
    expect(summarizeWeights(['33.33', '33.33', '33.34'])).toEqual({
      total: '100',
      difference: '0',
      valid: true,
    });
  });

  it('reports what is missing and what is over', () => {
    expect(summarizeWeights(['30', '60.5'])).toMatchObject({
      total: '90.5',
      difference: '9.5',
      valid: false,
    });
    expect(summarizeWeights(['70', '40'])).toMatchObject({
      total: '110',
      difference: '-10',
      valid: false,
    });
  });

  it('is invalid when any row is unreadable, even if the readable rows total 100', () => {
    expect(summarizeWeights(['100', 'abc']).valid).toBe(false);
    expect(summarizeWeights([]).valid).toBe(false);
  });
});

describe('normalizeDecimalInput', () => {
  it('turns one decimal comma into a dot and empties into null', () => {
    expect(normalizeDecimalInput('12,5')).toBe('12.5');
    expect(normalizeDecimalInput('  ')).toBeNull();
    expect(normalizeDecimalInput(undefined)).toBeNull();
    expect(normalizeDecimalInput('0')).toBe('0');
  });

  it('leaves mixed separators for validation to refuse', () => {
    expect(isValidPercent('1,000.5')).toBe(false);
    expect(isValidPercent('1e2')).toBe(false);
    expect(isValidPercent('12.345')).toBe(false);
  });
});

describe('limits', () => {
  it('accepts a percent above 0 up to 100 and refuses 0 and 100.01', () => {
    expect(isValidPercent('0.01')).toBe(true);
    expect(isValidPercent('100')).toBe(true);
    expect(isValidPercent('0')).toBe(false);
    expect(isValidPercent('100.01')).toBe(false);
  });

  it('accepts a blank or zero threshold', () => {
    expect(isValidThreshold('')).toBe(true);
    expect(isValidThreshold('0')).toBe(true);
    expect(isValidThreshold('-1')).toBe(false);
  });
});

describe('assessmentFieldPath', () => {
  it('turns server field names into form paths', () => {
    expect(assessmentFieldPath('components.1.weight')).toEqual([
      'components',
      1,
      'weight',
    ]);
    expect(assessmentFieldPath('failingScore')).toEqual(['failingScore']);
  });
});
