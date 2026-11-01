import { Injectable } from '@nestjs/common';
import {
  ApprovalAction,
  type ApprovalStep,
  type ChangeRequest,
  type ChangeRequestStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import { AppException } from '../exception/app.exception.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { isAcademicOfficeHolder } from './academic-office.js';
import { levelOfStatus } from './approval-rules.js';
import {
  APPROVAL_LEVEL,
  PENDING_STATUS_BY_LEVEL,
  type ApprovalLevel,
} from './approval.constants.js';
import { APPROVAL_ERRORS } from './approval.errors.js';
import { grantFor, usableGrants } from './delegation-authority.js';
import { blocksSelfApproval } from './self-approval.js';

type Db = PrismaService | Prisma.TransactionClient;

export type DecisionSubject = Pick<
  ChangeRequest,
  'id' | 'status' | 'submissionRound' | 'createdById' | 'requestType'
>;

export type ClosingAction =
  typeof ApprovalAction.RETURN | typeof ApprovalAction.REJECT;
export type DecisionAction = typeof ApprovalAction.APPROVE | ClosingAction;

export interface Decision {
  action: DecisionAction;
  remark: string | null;
  performedById: string;
  isOverride: boolean;
}

// A row the user may decide, with the grant behind it when it is someone else's row (F-25 evidence).
export type ActionableRow = ApprovalStep & { viaDelegationId: string | null };

export type AdvanceResult =
  | { kind: 'WAITING' }
  | { kind: 'NEXT_LEVEL'; level: ApprovalLevel }
  | { kind: 'COMPLETE' };

// The one writer of decisions and level moves (D1): F-14's approve / return / reject / override and F-15's final approval share it.
@Injectable()
export class ApprovalRecorder {
  // Serialises decisions on one request: a second decider waits on this row and then sees the first one's rows.
  async claim(
    tx: Prisma.TransactionClient,
    request: DecisionSubject,
  ): Promise<void> {
    const { count } = await tx.changeRequest.updateMany({
      where: {
        id: request.id,
        status: request.status,
        submissionRound: request.submissionRound,
      },
      data: { updatedAt: new Date() },
    });
    if (count === 0) {
      throw new AppException(APPROVAL_ERRORS.REQUEST_STATE_CHANGED);
    }
  }

  // Rows the user may decide now. Level 3 has no named approver: any active academic-office holder acts (D11).
  // At levels 1-2 the user's own rows come with the rows of anyone who delegated that level to them today (F-25);
  // the actual creator is refused before either, so a grant never lets someone approve their own request.
  async actionableRows(
    db: Db,
    request: DecisionSubject,
    userId: string,
    today: Date,
  ): Promise<ActionableRow[]> {
    const level = levelOfStatus(request.status);
    if (level === null) return [];
    if (await blocksSelfApproval(db, request.createdById, userId)) return [];
    const isFinalLevel = level === APPROVAL_LEVEL.ACADEMIC_OFFICE;
    if (isFinalLevel && !(await isAcademicOfficeHolder(db, userId, today))) {
      return [];
    }
    const grants = isFinalLevel ? [] : await usableGrants(db, userId, today);
    const delegators = grants.map((grant) => grant.delegatorId);
    const rows = await db.approvalStep.findMany({
      where: {
        changeRequestId: request.id,
        submissionRound: request.submissionRound,
        approvalLevel: level,
        action: ApprovalAction.PENDING,
        ...(!isFinalLevel && {
          approverId: { in: [userId, ...delegators] },
        }),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.flatMap((row): ActionableRow[] => {
      if (isFinalLevel || row.approverId === userId) {
        return [{ ...row, viaDelegationId: null }];
      }
      const grant = grantFor(grants, row.approverId, level);
      return grant ? [{ ...row, viaDelegationId: grant.id }] : [];
    });
  }

  // Records one decision over the user's rows: own rows plain, delegated rows with their grant as evidence.
  async recordRows(
    tx: Prisma.TransactionClient,
    rows: readonly ActionableRow[],
    decision: Decision,
  ): Promise<void> {
    const byGrant = new Map<string | null, string[]>();
    for (const row of rows) {
      byGrant.set(row.viaDelegationId, [
        ...(byGrant.get(row.viaDelegationId) ?? []),
        row.id,
      ]);
    }
    for (const [delegationId, ids] of byGrant) {
      await this.record(tx, ids, { ...decision, delegationId });
    }
  }

  async record(
    tx: Prisma.TransactionClient,
    rowIds: readonly string[],
    decision: Decision & { delegationId?: string | null },
  ): Promise<void> {
    const { count } = await tx.approvalStep.updateMany({
      where: { id: { in: [...rowIds] }, action: ApprovalAction.PENDING },
      data: { ...decision, recordedAt: new Date() },
    });
    if (count !== rowIds.length) {
      throw new AppException(APPROVAL_ERRORS.STEP_ALREADY_DECIDED);
    }
  }

  // After an APPROVE: stay while the level still has PENDING rows, else move to the lowest higher level that has one.
  async advance(
    tx: Prisma.TransactionClient,
    request: DecisionSubject,
  ): Promise<AdvanceResult> {
    const level = levelOfStatus(request.status)!;
    const pending = await tx.approvalStep.findMany({
      where: {
        changeRequestId: request.id,
        submissionRound: request.submissionRound,
        action: ApprovalAction.PENDING,
        approvalLevel: { gte: level },
      },
      select: { approvalLevel: true },
      orderBy: { approvalLevel: 'asc' },
    });
    if (pending.some((row) => row.approvalLevel === level)) {
      return { kind: 'WAITING' };
    }
    if (pending.length === 0) return { kind: 'COMPLETE' };
    const next = pending[0].approvalLevel as ApprovalLevel;
    await tx.changeRequest.update({
      where: { id: request.id },
      data: {
        status: PENDING_STATUS_BY_LEVEL[next],
        levelEnteredAt: new Date(),
      },
    });
    return { kind: 'NEXT_LEVEL', level: next };
  }

  // Leaves PENDING_*: the time-at-level clock stops (D12).
  async close(
    tx: Prisma.TransactionClient,
    requestId: string,
    status: ChangeRequestStatus,
  ): Promise<void> {
    await tx.changeRequest.update({
      where: { id: requestId },
      data: { status, levelEnteredAt: null },
    });
  }
}
