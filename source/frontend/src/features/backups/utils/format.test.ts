import { describe, expect, it } from 'vitest';
import { NO_RECORD } from '../constants/backupLabels';
import { formatBackupBytes, formatRecoveryMs } from './format';

describe('formatRecoveryMs', () => {
  it('keeps "not recorded" apart from a measured zero', () => {
    expect(formatRecoveryMs(null)).toBe(NO_RECORD);
    expect(formatRecoveryMs(0)).toBe('0 ms');
  });

  it('reads as milliseconds, seconds, then minutes', () => {
    expect(formatRecoveryMs(850)).toBe('850 ms');
    expect(formatRecoveryMs(42_000)).toBe('42 giây');
    expect(formatRecoveryMs(120_000)).toBe('2 phút');
    expect(formatRecoveryMs(125_000)).toBe('2 phút 5 giây');
  });
});

describe('formatBackupBytes', () => {
  it('keeps "not recorded" apart from a measured zero', () => {
    expect(formatBackupBytes(null)).toBe(NO_RECORD);
    expect(formatBackupBytes('0')).toBe('0 B');
  });

  it('scales through the units with one decimal', () => {
    expect(formatBackupBytes('1023')).toBe('1023 B');
    expect(formatBackupBytes('1024')).toBe('1.0 KB');
    expect(formatBackupBytes('1572864')).toBe('1.5 MB');
  });

  it('stays exact beyond Number.MAX_SAFE_INTEGER', () => {
    // 2^63 bytes is 8 EB; the unit caps at TB and the count must not wrap or turn into NaN.
    const result = formatBackupBytes('9223372036854775808');
    expect(result).toMatch(/TB$/);
    expect(result).not.toContain('NaN');
  });

  it('refuses text that is not a plain byte count', () => {
    expect(formatBackupBytes('12e3')).toBe(NO_RECORD);
    expect(formatBackupBytes('-5')).toBe(NO_RECORD);
  });
});
