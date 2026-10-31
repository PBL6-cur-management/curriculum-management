import {
  ApprovalAction,
  type ChangeRequestStatus,
} from '../../generated/prisma/client.js';
import {
  APPROVAL_STEP_KIND,
  PENDING_STATUS_BY_LEVEL,
  type ApprovalLevel,
  type ApprovalStepKind,
} from './approval.constants.js';

export function levelOfStatus(
  status: ChangeRequestStatus,
): ApprovalLevel | null {
  const entry = Object.entries(PENDING_STATUS_BY_LEVEL).find(
    ([, pending]) => pending === status,
  );
  return entry ? (Number(entry[0]) as ApprovalLevel) : null;
}

// A row is live only in the request's current round and at the request's current level (S-4: a Return leaves the others dead).
export function isActionable(
  step: {
    action: ApprovalAction;
    submissionRound: number;
    approvalLevel: number;
  },
  request: { status: ChangeRequestStatus; submissionRound: number },
): boolean {
  return (
    step.action === ApprovalAction.PENDING &&
    step.submissionRound === request.submissionRound &&
    levelOfStatus(request.status) === step.approvalLevel
  );
}

export function stepKind(step: {
  isSkipped: boolean;
  isOverride: boolean;
  delegationId?: string | null;
}): ApprovalStepKind {
  if (step.isSkipped) return APPROVAL_STEP_KIND.SKIPPED;
  if (step.isOverride) return APPROVAL_STEP_KIND.OVERRIDE;
  return step.delegationId
    ? APPROVAL_STEP_KIND.DELEGATED
    : APPROVAL_STEP_KIND.NORMAL;
}
