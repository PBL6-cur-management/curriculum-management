import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../../../src/generated/prisma/client.js';
import { dutDecisionPlaceholder, seedDutPrograms } from './seed-programs.js';

describe('dutDecisionPlaceholder', () => {
  it('labels the source program and version', () => {
    expect(dutDecisionPlaceholder('7480201', '2.0')).toBe('DUT-7480201-2.0');
  });
});

describe('seedDutPrograms on an existing program', () => {
  it('fills only the missing decision numbers of issued versions and skips the program', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 'v1', versionNumber: '1.0' },
      { id: 'v2', versionNumber: '2.0' },
    ]);
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      program: { findUnique: vi.fn().mockResolvedValue({ id: 'p1' }) },
      programVersion: { findMany, update },
      $transaction: vi.fn(),
    } as unknown as PrismaClient;

    const result = await seedDutPrograms(
      prisma,
      { programs: [{ programCode: '7480201', versions: [] }] } as never,
      {} as never,
    );

    expect(result).toEqual({
      created: [],
      skippedExisting: ['7480201'],
      backfilledDecisions: 2,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          programId: 'p1',
          decisionNumber: null,
          sourceRequestId: null,
          status: { in: ['PENDING', 'ACTIVE', 'HISTORICAL'] },
        }),
      }),
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: 'v2' },
      data: { decisionNumber: 'DUT-7480201-2.0' },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
