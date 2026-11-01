import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

type Db = PrismaService | Prisma.TransactionClient;

// FR-61, BR-27: nobody approves a request they created. The one exception is a demo account
// (User.canSelfApprove, set only by prisma/demo-account.ts) so a single visitor can walk the whole flow.
export async function maySelfApprove(db: Db, userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { canSelfApprove: true },
  });
  return user?.canSelfApprove === true;
}

// True when the creator rule forbids this user from deciding this request.
export async function blocksSelfApproval(
  db: Db,
  creatorId: string,
  userId: string,
): Promise<boolean> {
  if (creatorId !== userId) return false;
  return !(await maySelfApprove(db, userId));
}
