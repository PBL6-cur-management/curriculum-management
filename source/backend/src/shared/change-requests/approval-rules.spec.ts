import {
  ApprovalAction,
  ChangeRequestStatus,
} from '../../generated/prisma/client.js';
import { isActionable, levelOfStatus, stepKind } from './approval-rules.js';

describe('approval rules', () => {
  const request = {
    status: ChangeRequestStatus.PENDING_DIRECTOR,
    submissionRound: 2,
  };
  const live = {
    action: ApprovalAction.PENDING,
    submissionRound: 2,
    approvalLevel: 2,
  };

  it('maps a pending status to its level and others to null', () => {
    expect(levelOfStatus(ChangeRequestStatus.PENDING_COORDINATOR)).toBe(1);
    expect(levelOfStatus(ChangeRequestStatus.PENDING_DIRECTOR)).toBe(2);
    expect(levelOfStatus(ChangeRequestStatus.PENDING_FACULTY_LEADERSHIP)).toBe(
      3,
    );
    expect(levelOfStatus(ChangeRequestStatus.PENDING_ACADEMIC_OFFICE)).toBe(4);
    expect(levelOfStatus(ChangeRequestStatus.DRAFT)).toBeNull();
  });

  it('accepts only a PENDING row of this round at this level', () => {
    expect(isActionable(live, request)).toBe(true);
    expect(isActionable({ ...live, submissionRound: 1 }, request)).toBe(false);
    expect(isActionable({ ...live, approvalLevel: 1 }, request)).toBe(false);
    expect(isActionable({ ...live, approvalLevel: 3 }, request)).toBe(false);
    expect(
      isActionable({ ...live, action: ApprovalAction.APPROVE }, request),
    ).toBe(false);
    expect(
      isActionable(live, { ...request, status: ChangeRequestStatus.DRAFT }),
    ).toBe(false);
  });

  it('labels skipped and override rows', () => {
    expect(stepKind({ isSkipped: true, isOverride: false })).toBe('SKIPPED');
    expect(stepKind({ isSkipped: false, isOverride: true })).toBe('OVERRIDE');
    expect(stepKind({ isSkipped: false, isOverride: false })).toBe('NORMAL');
  });
});
