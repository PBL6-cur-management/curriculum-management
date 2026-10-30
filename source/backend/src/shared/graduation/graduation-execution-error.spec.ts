import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { AppException } from '../exception/app.exception.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { graduationTransaction } from './graduation-audit.writer.js';
import { GRADUATION_LIMITS } from './graduation.constants.js';
import { GRADUATION_ERRORS } from './graduation.errors.js';
import {
  graduationExecutionError,
  graduationSqlState,
  isGraduationTransactionConflict,
} from './graduation-execution-error.js';

function databaseError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError(
    'Invalid query with private student input and SQL parameters',
    {
      clientVersion: '7',
      code,
      meta,
    },
  );
}

describe('graduation execution failures', () => {
  it.each(['40001', '40P01'])(
    'retries raw SQL transaction failure %s',
    async (sqlState) => {
      const failure = databaseError('P2010', {
        code: sqlState,
        message: 'private SQL details',
      });
      const prisma = {
        $transaction: vi
          .fn()
          .mockRejectedValueOnce(failure)
          .mockResolvedValue('committed'),
      };
      await expect(
        graduationTransaction(prisma as unknown as PrismaService, vi.fn()),
      ).resolves.toBe('committed');
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(graduationExecutionError(failure)).toContain(
        `sqlState=${sqlState}`,
      );
      expect(graduationExecutionError(failure)).not.toMatch(
        /private|student|parameters/,
      );
    },
  );

  it('recognizes the Prisma driver-adapter SQLSTATE shape without exposing driver bodies', () => {
    const failure = databaseError('P2010', {
      driverAdapterError: {
        cause: {
          originalCode: '40001',
          originalMessage: 'student-secret',
          kind: 'TransactionWriteConflict',
        },
      },
    });
    expect(graduationSqlState(failure)).toBe('40001');
    expect(isGraduationTransactionConflict(failure)).toBe(true);
    expect(graduationExecutionError(failure)).toContain(
      'message=Transaction serialization conflict.',
    );
    expect(graduationExecutionError(failure)).not.toContain('student-secret');
  });

  it('still recognizes normalized ORM write conflicts', () => {
    expect(isGraduationTransactionConflict(databaseError('P2034'))).toBe(true);
  });

  it.each(['40001', '40P01'])(
    'recognizes a direct driver error with SQLSTATE %s without raw messages',
    async (sqlState) => {
      const failure = Object.assign(new Error('student-secret'), {
        code: sqlState,
      });
      const prisma = {
        $transaction: vi
          .fn()
          .mockRejectedValueOnce(failure)
          .mockResolvedValue('committed'),
      };
      await expect(
        graduationTransaction(prisma as unknown as PrismaService, vi.fn()),
      ).resolves.toBe('committed');
      expect(graduationExecutionError(failure)).toContain(
        `name=Error code=DATABASE_ERROR sqlState=${sqlState}`,
      );
      expect(graduationExecutionError(failure)).not.toContain('student-secret');
    },
  );

  it('recognizes an unwrapped driver-adapter cause and logs a safe adapter name', () => {
    const failure = Object.assign(new Error('student-secret'), {
      name: 'DriverAdapterError',
      cause: { originalCode: '40P01', originalMessage: 'student-secret' },
    });
    expect(isGraduationTransactionConflict(failure)).toBe(true);
    expect(graduationExecutionError(failure)).toContain(
      'name=DriverAdapterError code=DATABASE_ERROR sqlState=40P01',
    );
    expect(graduationExecutionError(failure)).not.toContain('student-secret');
  });

  it('gives an unclassified plain Error a stable safe code instead of its body', () => {
    expect(
      graduationExecutionError(
        new Error('Synthetic crash before receipt transaction commit'),
      ),
    ).toBe(
      'name=Error code=UNCLASSIFIED_EXECUTION message=Unexpected execution error; private details omitted.',
    );
  });

  it.each(['23505', '23503', '23514', '42P01'])(
    'does not retry permanent SQLSTATE %s',
    async (code) => {
      const failure = databaseError('P2010', { code });
      const prisma = { $transaction: vi.fn().mockRejectedValue(failure) };
      await expect(
        graduationTransaction(prisma as unknown as PrismaService, vi.fn()),
      ).rejects.toBe(failure);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    databaseError('P2002'),
    new AppException(GRADUATION_ERRORS.STATE_CHANGED),
    new Error('private body'),
  ])(
    'does not retry unique-key, domain or unknown failures',
    async (failure) => {
      const prisma = { $transaction: vi.fn().mockRejectedValue(failure) };
      await expect(
        graduationTransaction(prisma as unknown as PrismaService, vi.fn()),
      ).rejects.toBe(failure);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    },
  );

  it('bounds raw SQL conflict retries instead of swallowing the final error', async () => {
    const failure = databaseError('P2010', { code: '40001' });
    const prisma = { $transaction: vi.fn().mockRejectedValue(failure) };
    await expect(
      graduationTransaction(prisma as unknown as PrismaService, vi.fn()),
    ).rejects.toBe(failure);
    expect(prisma.$transaction).toHaveBeenCalledTimes(
      GRADUATION_LIMITS.TRANSACTION_RETRIES + 1,
    );
  });

  it('logs static domain messages, not a customized exception body', () => {
    const failure = new AppException({
      ...GRADUATION_ERRORS.INPUT_INVALID,
      message: 'student-secret',
    });
    expect(graduationExecutionError(failure)).toContain(
      GRADUATION_ERRORS.INPUT_INVALID.message,
    );
    expect(graduationExecutionError(failure)).not.toContain('student-secret');
  });

  it.each([
    new Error('student-secret'),
    { message: 'student-secret' },
    databaseError('P2010', { code: '23514', message: 'student-secret' }),
  ])('does not log raw error/driver/input bodies', (failure) => {
    expect(graduationExecutionError(failure)).not.toContain('student-secret');
    expect(graduationExecutionError(failure)).toMatch(/name=\w+.*message=/);
  });
});
