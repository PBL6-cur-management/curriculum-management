import type { Prisma } from '../../generated/prisma/client.js';
import { SNAPSHOT_ENTITY } from '../../shared/change-requests/diff/snapshot-entry.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';

const GRADING_ENTITIES: string[] = [
  SNAPSHOT_ENTITY.FORMULA,
  SNAPSHOT_ENTITY.COMPONENT,
  SNAPSHOT_ENTITY.CLO_MAPPING,
];

// Judged on the items stored at submit, not on the request type: a content or outcome request that also touches
// grading data is a grading change for the semester rule.
export async function hasGradingChanges(
  db: PrismaService | Prisma.TransactionClient,
  requestId: string,
): Promise<boolean> {
  const count = await db.changeItem.count({
    where: { changeRequestId: requestId, entityType: { in: GRADING_ENTITIES } },
  });
  return count > 0;
}
