import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../../generated/prisma/client.js';
import { lockSyllabusAssessment } from './syllabus-assessment-lock.js';

function txWith(sourceRequestId: string | null) {
  const locked: string[] = [];
  const tx = {
    syllabus: { findUnique: vi.fn().mockResolvedValue({ sourceRequestId }) },
    $queryRaw: vi.fn((strings: TemplateStringsArray) => {
      locked.push(/FROM "(\w+)"/.exec(strings.join(''))![1]!);
      return Promise.resolve([]);
    }),
  };
  return { tx: tx as unknown as Prisma.TransactionClient, locked };
}

describe('lockSyllabusAssessment', () => {
  it('locks the request row before the revision of a working copy', async () => {
    const { tx, locked } = txWith('req1');
    await lockSyllabusAssessment(tx, 's1');
    expect(locked).toEqual(['ChangeRequest', 'Syllabus']);
  });

  it('locks only the revision for an ordinary Draft', async () => {
    const { tx, locked } = txWith(null);
    await lockSyllabusAssessment(tx, 's1');
    expect(locked).toEqual(['Syllabus']);
  });
});
