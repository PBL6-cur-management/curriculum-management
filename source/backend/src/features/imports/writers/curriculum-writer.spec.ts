import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { CurriculumPlanRow } from '../validation/curriculum-validator.js';
import { writeCurriculum } from './curriculum-writer.js';

function row(
  courseId: string,
  existingItemId: string | null,
): CurriculumPlanRow {
  return {
    courseId,
    existingItemId,
    plannedSemester: 2,
    sortOrder: 1,
    blockSymbol: 'CS',
    isElective: false,
    electiveGroupId: null,
    htDa: false,
    tqDa: false,
    minStudiedScore: null,
    minTransferScore: null,
    note: null,
    requisites: [],
  };
}
describe('curriculum writer', () => {
  it('keeps item ids, removes only planned rows, batches inserts and replaces requisites', async () => {
    const deleteMany = vi.fn();
    const update = vi.fn();
    const createManyAndReturn = vi
      .fn()
      .mockResolvedValue([{ id: 'new-id', courseId: 'B' }]);
    const deleteRequisites = vi.fn();
    const createRequisites = vi.fn();
    const tx = {
      curriculumItem: { deleteMany, update, createManyAndReturn },
      curriculumRequisite: {
        deleteMany: deleteRequisites,
        createMany: createRequisites,
      },
    } as unknown as Prisma.TransactionClient;
    const kept = row('A', 'keep-id');
    const added = row('B', null);
    added.requisites.push({
      sourceCourseId: 'A',
      relationType: 'PRIOR',
      minScore: null,
    });
    await writeCurriculum(tx, 'version', {
      rows: [kept, added],
      removedItemIds: ['remove-id'],
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { versionId: 'version', id: { in: ['remove-id'] } },
    });
    expect(update.mock.calls[0][0]).toMatchObject({
      where: { id: 'keep-id', versionId: 'version' },
      data: { courseId: 'A', blockSymbol: 'CS' },
    });
    expect(update.mock.calls[0][0].data).not.toHaveProperty('existingItemId');
    expect(update.mock.calls[0][0].data).not.toHaveProperty('requisites');
    expect(createManyAndReturn.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ versionId: 'version', courseId: 'B' }),
    ]);
    expect(deleteRequisites).toHaveBeenCalledWith({
      where: { itemId: { in: ['keep-id', 'new-id'] } },
    });
    expect(createRequisites).toHaveBeenCalledWith({
      data: [
        {
          itemId: 'new-id',
          sourceCourseId: 'A',
          relationType: 'PRIOR',
          minScore: null,
        },
      ],
    });
  });
  it('does not issue empty deletes or inserts', async () => {
    await expect(
      writeCurriculum({} as Prisma.TransactionClient, 'v', {
        rows: [],
        removedItemIds: [],
      }),
    ).resolves.toBeUndefined();
  });
});
