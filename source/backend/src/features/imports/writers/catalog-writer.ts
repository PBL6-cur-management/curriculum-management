import type { Prisma } from '../../../generated/prisma/client.js';
import type { CatalogPlan } from '../validation/catalog-validator.js';

export async function writeCatalog(
  tx: Prisma.TransactionClient,
  plan: CatalogPlan,
): Promise<void> {
  if (plan.creates.length) await tx.course.createMany({ data: plan.creates });
  for (const update of plan.updates)
    await tx.course.update({ where: { id: update.id }, data: update.data });
}
