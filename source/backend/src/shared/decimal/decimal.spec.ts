import { describe, expect, it } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import {
  CREDITS_PATTERN,
  GRADE_POINT_PATTERN,
  SCORE10_PATTERN,
  toWireDecimal,
} from './decimal.js';

describe('credits decimal', () => {
  it.each(['0', '2.5', '2.50', '999.99', '3'])('accepts %s', (value) => {
    expect(CREDITS_PATTERN.test(value)).toBe(true);
  });

  it.each(['-1', '1.234', '1000', 'abc', '', ' 2', '2 ', '.5', '1.'])(
    'rejects %j',
    (value) => {
      expect(CREDITS_PATTERN.test(value)).toBe(false);
    },
  );

  it('drops trailing zeros on the wire', () => {
    expect(toWireDecimal(new Prisma.Decimal('2.50'))).toBe('2.5');
    expect(toWireDecimal(new Prisma.Decimal('3.00'))).toBe('3');
    expect(toWireDecimal(new Prisma.Decimal('0'))).toBe('0');
  });
});

describe('grade point decimal', () => {
  it.each(['0', '2', '2.5', '4', '4.00', '3.99', '0.05'])(
    'accepts %s',
    (value) => {
      expect(GRADE_POINT_PATTERN.test(value)).toBe(true);
    },
  );

  it.each(['4.01', '5', '-1', '2.555', '', ' 2', '.5', '2.', '10'])(
    'rejects %j',
    (value) => {
      expect(GRADE_POINT_PATTERN.test(value)).toBe(false);
    },
  );
});

describe('score10 decimal', () => {
  it.each(['0', '4', '4.0', '9.99', '10', '10.00'])('accepts %s', (value) => {
    expect(SCORE10_PATTERN.test(value)).toBe(true);
  });
  it.each(['10.01', '11', '-1', '2.555', '', ' 2', '.5', '2.'])(
    'rejects %j',
    (value) => {
      expect(SCORE10_PATTERN.test(value)).toBe(false);
    },
  );
});
