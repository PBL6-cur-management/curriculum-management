import type { Prisma } from '../../../generated/prisma/client.js';
import type {
  CurriculumPlan,
  CurriculumPlanRow,
} from '../validation/curriculum-validator.js';

function itemData(
  row: CurriculumPlanRow,
): Omit<Prisma.CurriculumItemCreateManyInput, 'versionId'> {
  return {
    courseId: row.courseId,
    plannedSemester: row.plannedSemester,
    sortOrder: row.sortOrder,
    blockSymbol: row.blockSymbol,
    isElective: row.isElective,
    electiveGroupId: row.electiveGroupId,
    htDa: row.htDa,
    tqDa: row.tqDa,
    minStudiedScore: row.minStudiedScore,
    minTransferScore: row.minTransferScore,
    note: row.note,
  };
}
export async function writeCurriculum(
  tx: Prisma.TransactionClient,
  versionId: string,
  plan: CurriculumPlan,
): Promise<void> {
  if (plan.removedItemIds.length)
    await tx.curriculumItem.deleteMany({
      where: { versionId, id: { in: plan.removedItemIds } },
    });
  const ids = new Map<string, string>();
  for (const row of plan.rows)
    if (row.existingItemId) {
      await tx.curriculumItem.update({
        where: { id: row.existingItemId, versionId },
        data: itemData(row),
      });
      ids.set(row.courseId, row.existingItemId);
    }
  const newRows = plan.rows.filter((row) => !row.existingItemId);
  if (newRows.length) {
    const created = await tx.curriculumItem.createManyAndReturn({
      data: newRows.map((row) => ({ ...itemData(row), versionId })),
      select: { id: true, courseId: true },
    });
    for (const row of created) ids.set(row.courseId, row.id);
  }
  if (!ids.size) return;
  await tx.curriculumRequisite.deleteMany({
    where: { itemId: { in: [...ids.values()] } },
  });
  const requisites = plan.rows.flatMap((row) =>
    row.requisites.map((requisite) => ({
      ...requisite,
      itemId: ids.get(row.courseId)!,
    })),
  );
  if (requisites.length)
    await tx.curriculumRequisite.createMany({ data: requisites });
}
