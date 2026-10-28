import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation.js';

const REQUIRED = {
  DATABASE_URL: 'postgresql://ctdt:ctdt@localhost:5432/ctdt',
  SESSION_SECRET: 'x'.repeat(40),
};

describe('validateEnv', () => {
  it('leaves the queue prefix unset by default, so BullMQ keeps its own (production)', () => {
    expect(validateEnv(REQUIRED).BULLMQ_PREFIX).toBeUndefined();
  });

  it('takes a queue prefix, so parallel e2e files can keep their queues apart', () => {
    expect(
      validateEnv({ ...REQUIRED, BULLMQ_PREFIX: 'test-abc' }).BULLMQ_PREFIX,
    ).toBe('test-abc');
  });

  it('refuses an empty queue prefix instead of silently using the default', () => {
    expect(() => validateEnv({ ...REQUIRED, BULLMQ_PREFIX: '' })).toThrow(
      /BULLMQ_PREFIX/,
    );
  });

  it('treats the credential key as optional and accepts only base64 of 32 bytes', () => {
    expect(
      validateEnv(REQUIRED).STUDENT_CREDENTIAL_ENCRYPTION_KEY,
    ).toBeUndefined();
    const key = Buffer.alloc(32, 1).toString('base64');
    expect(
      validateEnv({ ...REQUIRED, STUDENT_CREDENTIAL_ENCRYPTION_KEY: key })
        .STUDENT_CREDENTIAL_ENCRYPTION_KEY,
    ).toBe(key);
    const short = Buffer.alloc(16, 1).toString('base64');
    expect(() =>
      validateEnv({ ...REQUIRED, STUDENT_CREDENTIAL_ENCRYPTION_KEY: short }),
    ).toThrow(/STUDENT_CREDENTIAL_ENCRYPTION_KEY/);
  });

  it('still converts numeric variables', () => {
    expect(validateEnv({ ...REQUIRED, REDIS_PORT: '6380' }).REDIS_PORT).toBe(
      6380,
    );
  });
});
