import {
  ApprovalAction,
  ApprovalDelegationStatus,
  ChangeRequestStatus,
  UserStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

type Db = PrismaService | Prisma.TransactionClient;

export interface UsableGrant {
  id: string;
  delegatorId: string;
  scopeLevel: number | null;
}

// F-25 (US-114): a grant counts only while ACTIVE, inside its inclusive Viet Nam days and with both accounts
// active. Checked on every read and again under the decision lock, so a late expiry job never extends authority.
export function usableGrantWhere(
  delegateId: string,
  today: Date,
): Prisma.ApprovalDelegationWhereInput {
  return {
    delegateId,
    status: ApprovalDelegationStatus.ACTIVE,
    validFrom: { lte: today },
    validTo: { gte: today },
    delegator: { status: UserStatus.ACTIVE },
    delegate: { status: UserStatus.ACTIVE },
  };
}

// Oldest grant first, so overlapping grants for one delegator always leave the same evidence (D3).
export function usableGrants(
  db: Db,
  delegateId: string,
  today: Date,
): Promise<UsableGrant[]> {
  return db.approvalDelegation.findMany({
    where: usableGrantWhere(delegateId, today),
    select: { id: true, delegatorId: true, scopeLevel: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

export const grantCovers = (grant: UsableGrant, level: number): boolean =>
  grant.scopeLevel === null || grant.scopeLevel === level;

// The grant that stands behind deciding one row of `approverId` at `level`, or null.
export function grantFor(
  grants: readonly UsableGrant[],
  approverId: string | null,
  level: number,
): UsableGrant | null {
  if (approverId === null) return null;
  return (
    grants.find(
      (grant) => grant.delegatorId === approverId && grantCovers(grant, level),
    ) ?? null
  );
}

// What a delegate may read: requests waiting on a delegator's named row now, and requests the delegate already
// decided through a grant (so the answer to their own click stays readable). Never the delegator's whole scope.
export async function delegatedVisibleWhere(
  db: Db,
  userId: string,
  today: Date,
): Promise<Prisma.ChangeRequestWhereInput[]> {
  const grants = await usableGrants(db, userId, today);
  const decided: Prisma.ChangeRequestWhereInput = {
    steps: { some: { delegation: { delegateId: userId } } },
  };
  if (grants.length === 0) return [decided];
  return [
    decided,
    {
      status: {
        in: [
          ChangeRequestStatus.PENDING_COORDINATOR,
          ChangeRequestStatus.PENDING_DIRECTOR,
        ],
      },
      createdById: { not: userId },
      steps: {
        some: {
          action: ApprovalAction.PENDING,
          OR: grants.map((grant) => ({
            approverId: grant.delegatorId,
            ...(grant.scopeLevel !== null && {
              approvalLevel: grant.scopeLevel,
            }),
          })),
        },
      },
    },
  ];
}
