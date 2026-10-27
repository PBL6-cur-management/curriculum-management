import { describe, expect, it, vi } from 'vitest';
import { AccessContext } from '../../shared/authz/access-context.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import { ImportListQueryDto } from './dto/import.dto.js';
import { ImportsReader } from './imports.reader.js';

describe('ImportsReader', () => {
  it('hides inaccessible batch identities with 404', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const reader = new ImportsReader({
      importBatch: { findFirst },
    } as unknown as PrismaService);
    await expect(
      reader.detail('hidden', new AccessContext('user', [])),
    ).rejects.toMatchObject({ code: 'IMPORT_BATCH_NOT_FOUND' });
    expect(findFirst.mock.calls[0][0].where.AND).toEqual([
      { id: 'hidden' },
      { OR: [{ performedById: 'user' }] },
    ]);
  });
  it('paginates the same scoped filter for count and data, excluding blobs and reports from list selects', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(3);
    const reader = new ImportsReader({
      importBatch: { findMany, count },
    } as unknown as PrismaService);
    const query = Object.assign(new ImportListQueryDto(), {
      mine: true,
      page: 2,
      pageSize: 2,
      status: 'DRY_RUN' as const,
    });
    expect(await reader.list(query, new AccessContext('user', []))).toEqual({
      items: [],
      total: 3,
      page: 2,
      pageSize: 2,
    });
    expect(findMany.mock.calls[0][0]).toMatchObject({
      skip: 2,
      take: 2,
      where: {
        AND: [expect.any(Object), { performedById: 'user', status: 'DRY_RUN' }],
      },
    });
    expect(findMany.mock.calls[0][0].where).toEqual(
      count.mock.calls[0][0].where,
    );
    expect(findMany.mock.calls[0][0].select).not.toHaveProperty('file');
    expect(findMany.mock.calls[0][0].select).not.toHaveProperty('errorReport');
  });
  it('checks visibility before downloading and refuses a missing retained file', async () => {
    const findFirst = vi.fn().mockResolvedValue({ fileName: 'file.xlsx' });
    const findFile = vi.fn().mockResolvedValue(null);
    const reader = new ImportsReader({
      importBatch: { findFirst },
      importBatchFile: { findFirst: findFile },
    } as unknown as PrismaService);
    await expect(
      reader.file('batch', new AccessContext('user', [])),
    ).rejects.toMatchObject({ code: 'IMPORT_FILE_EXPIRED' });
    expect(findFile.mock.calls[0][0].where).toMatchObject({
      batchId: 'batch',
      expiresAt: { gt: expect.any(Date) },
    });
    findFile.mockResolvedValue({ content: new Uint8Array([1, 2]) });
    expect(await reader.file('batch', new AccessContext('user', []))).toEqual({
      content: new Uint8Array([1, 2]),
      fileName: 'file.xlsx',
    });
  });
});
