import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../../../generated/prisma/client.js';
import { writeCatalog } from './catalog-writer.js';

describe('catalog writer', () => {
  it('batches creates and applies planned updates through the transaction only', async () => {
    const createMany = vi.fn();
    const update = vi.fn();
    const tx = {
      course: { createMany, update },
    } as unknown as Prisma.TransactionClient;
    const creates = [
      {
        courseCode: 'A',
        courseName: 'Tên A',
        credits: '2.5',
        courseType: 'THEORY' as const,
        ownerFacultyId: 'f',
      },
    ];
    await writeCatalog(tx, {
      creates,
      updates: [{ id: 'b', data: { courseName: 'Tên mới' } }],
    });
    expect(createMany).toHaveBeenCalledExactlyOnceWith({ data: creates });
    expect(update).toHaveBeenCalledExactlyOnceWith({
      where: { id: 'b' },
      data: { courseName: 'Tên mới' },
    });
  });
  it('does nothing for an unchanged catalog', async () => {
    await expect(
      writeCatalog({} as Prisma.TransactionClient, {
        creates: [],
        updates: [],
      }),
    ).resolves.toBeUndefined();
  });
});
