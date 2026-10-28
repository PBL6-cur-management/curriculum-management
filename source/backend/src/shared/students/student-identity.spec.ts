import { describe, expect, it } from 'vitest';
import {
  isValidStudentCode,
  normalizeStudentCode,
} from './student-identity.js';

describe('student identity', () => {
  it('trims and upper-cases without touching leading zeroes', () => {
    expect(normalizeStudentCode('  0012ab-3 ')).toBe('0012AB-3');
  });

  it.each(['102210001', 'A1-B_2', 'ABC'])('accepts %s', (code) => {
    expect(isValidStudentCode(code)).toBe(true);
  });

  it.each(['', 'AB', '-ABC', 'AB CD', 'ab.cd', 'A'.repeat(33), 'MÃ123'])(
    'rejects %s',
    (code) => {
      expect(isValidStudentCode(code)).toBe(false);
    },
  );
});
