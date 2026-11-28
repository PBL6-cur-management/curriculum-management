import {
  ApprovalAction,
  ChangeRequestStatus,
  NotificationType,
  type Prisma,
} from '../../generated/prisma/client.js';
import type { NotificationService } from '../notifications/notification.service.js';
import { RequestNotifier } from './request-notifier.js';

const request = {
  id: 'r1',
  requestCode: 'DX-2026-0001',
  title: 'Sửa đề cương',
  createdById: 'creator',
  submissionRound: 2,
  status: ChangeRequestStatus.PENDING_DIRECTOR,
};

function setup() {
  const notify = vi.fn().mockResolvedValue(1);
  const db = {
    approvalStep: { findMany: vi.fn().mockResolvedValue([]) },
    roleAssignment: { findMany: vi.fn().mockResolvedValue([]) },
    user: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ fullName: 'Nguyễn A' }),
    },
    semester: {
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ semesterCode: '2026-2027-2' }),
    },
  };
  const notifier = new RequestNotifier({
    notify,
  } as unknown as NotificationService);
  const tx = db as unknown as Prisma.TransactionClient;
  const sent = () =>
    notify.mock.calls[0][1] as {
      recipientIds: string[];
      type: string;
      content: string;
    };
  return { notifier, tx, db, notify, sent };
}

describe('RequestNotifier', () => {
  it('tells the PENDING approvers of levels 1 and 2 that a request awaits them', async () => {
    const { notifier, tx, db, sent } = setup();
    db.approvalStep.findMany.mockResolvedValue([
      { approverId: 'a' },
      { approverId: 'b' },
    ]);
    await notifier.arrived(tx, request, 2, 'creator');
    expect(sent()).toMatchObject({
      recipientIds: ['a', 'b'],
      type: NotificationType.REQUEST_AWAITING_YOU,
    });
    expect(sent().content).toContain('Giám đốc CTĐT');
  });

  it('tells every academic-office holder but the creator at level 4', async () => {
    const { notifier, tx, db, sent } = setup();
    db.roleAssignment.findMany.mockResolvedValue([
      { userId: 'o1' },
      { userId: 'o2' },
      { userId: 'o1' },
    ]);
    await notifier.arrived(tx, request, 4, 'creator');
    expect(sent().recipientIds).toEqual(['o1', 'o2']);
    expect(db.roleAssignment.findMany.mock.calls[0][0].where.userId).toEqual({
      not: 'creator',
    });
  });

  it('tells the creator and the non-skipped approvers of the round, minus the exceptions', async () => {
    const { notifier, tx, db, sent } = setup();
    db.approvalStep.findMany.mockResolvedValue([
      { approverId: 'a' },
      { approverId: 'b' },
    ]);
    await notifier.decided(
      tx,
      request,
      ApprovalAction.RETURN,
      'Cần bổ sung minh chứng.',
      'actor',
      ['b'],
    );
    expect(db.approvalStep.findMany.mock.calls[0][0].where).toMatchObject({
      isSkipped: false,
      submissionRound: 2,
    });
    expect(sent()).toMatchObject({
      recipientIds: ['creator', 'a'],
      type: NotificationType.REQUEST_RETURNED,
    });
    expect(sent().content).toContain('Cần bổ sung minh chứng.');
  });

  it('uses the rejected type for a rejection', async () => {
    const { notifier, tx, sent } = setup();
    await notifier.decided(
      tx,
      request,
      ApprovalAction.REJECT,
      'Không phù hợp quy định.',
      'actor',
    );
    expect(sent().type).toBe(NotificationType.REQUEST_REJECTED);
  });

  it('tells only the creator of a comment on a closed request', async () => {
    const { notifier, tx, sent } = setup();
    await notifier.commented(
      tx,
      { ...request, status: ChangeRequestStatus.REJECTED },
      'author',
    );
    expect(sent().recipientIds).toEqual(['creator']);
  });

  it('adds the current approvers to a comment on a pending request', async () => {
    const { notifier, tx, db, sent } = setup();
    db.approvalStep.findMany.mockResolvedValue([{ approverId: 'dir' }]);
    await notifier.commented(tx, request, 'author');
    expect(sent().recipientIds).toEqual(['creator', 'dir']);
  });

  it('tells the bypassed approvers they were overridden', async () => {
    const { notifier, tx, sent } = setup();
    await notifier.overridden(
      tx,
      request,
      ['coord'],
      ApprovalAction.APPROVE,
      'Quá hạn duyệt.',
      'office',
    );
    expect(sent()).toMatchObject({
      recipientIds: ['coord'],
      type: NotificationType.REQUEST_OVERRIDDEN,
    });
  });

  it('tells only the creator, once, that the request is now in force', async () => {
    const { notifier, tx, sent, notify } = setup();
    await notifier.effective(tx, request, 'sem1', 'office');
    expect(notify).toHaveBeenCalledTimes(1);
    expect(sent()).toMatchObject({
      recipientIds: ['creator'],
      type: NotificationType.REQUEST_EFFECTIVE,
    });
    expect(sent().content).toContain('2026-2027-2');
  });
});
