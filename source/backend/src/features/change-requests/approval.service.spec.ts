import {
  ApprovalAction,
  ChangeRequestStatus,
  ChangeRequestType,
} from '../../generated/prisma/client.js';
import { AccessContext } from '../../shared/authz/access-context.js';
import type { ApprovalRecorder } from '../../shared/change-requests/approval-recorder.js';
import type { RequestNotifier } from '../../shared/change-requests/request-notifier.js';
import type { StaleChecker } from '../../shared/change-requests/stale-checker.js';
import { AppException } from '../../shared/exception/app.exception.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import { ApprovalService } from './approval.service.js';
import type { ChangeRequestDetailReader } from './change-request-detail.reader.js';
import type { OrganizationalApplier } from './organizational-applier.js';
import type { WorkingCopyService } from './working-copy.service.js';

const ACCESS = new AccessContext('approver', []);
const REMARK = 'Cần bổ sung minh chứng cho thay đổi này.';

const base = {
  id: 'r1',
  requestCode: 'DX-2026-0001',
  title: 'Sửa',
  requestType: ChangeRequestType.SYLLABUS_CONTENT,
  targetType: 'COURSE',
  courseId: 'c1',
  programId: null,
  subjectGroupId: null,
  createdById: 'creator',
  status: ChangeRequestStatus.PENDING_COORDINATOR,
  submissionRound: 1,
};

describe('ApprovalService', () => {
  const tx = { approvalStep: { findMany: vi.fn() } };
  const prisma = {
    approvalDelegation: { findMany: vi.fn().mockResolvedValue([]) },
    changeRequest: { findFirst: vi.fn() },
    user: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn((run: (client: unknown) => unknown) => run(tx)),
  };
  const recorder = {
    claim: vi.fn(),
    actionableRows: vi.fn(),
    record: vi.fn(),
    // The grouping by grant is covered in the recorder's spec; here own rows go straight to record.
    recordRows: vi.fn(
      (client: unknown, rows: { id: string }[], decision: unknown) =>
        recorder.record(
          client,
          rows.map((row) => row.id),
          decision,
        ),
    ),
    advance: vi.fn(),
    close: vi.fn(),
  };
  const stale = { isStale: vi.fn() };
  const applier = { apply: vi.fn() };
  const notifier = {
    arrived: vi.fn(),
    decided: vi.fn(),
    approved: vi.fn(),
    overridden: vi.fn(),
  };
  const copies = { discard: vi.fn() };
  const details = { read: vi.fn().mockResolvedValue({ id: 'r1' }) };
  const service = new ApprovalService(
    prisma as unknown as PrismaService,
    recorder as unknown as ApprovalRecorder,
    stale as unknown as StaleChecker,
    applier as unknown as OrganizationalApplier,
    notifier as unknown as RequestNotifier,
    copies as unknown as WorkingCopyService,
    details as unknown as ChangeRequestDetailReader,
  );

  const mine = [{ id: 's1' }, { id: 's2' }];

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.changeRequest.findFirst.mockResolvedValue(base);
    recorder.actionableRows.mockResolvedValue(mine);
    recorder.advance.mockResolvedValue({ kind: 'WAITING' });
    stale.isStale.mockResolvedValue(false);
  });

  const atLevel3 = (patch: object = {}) =>
    prisma.changeRequest.findFirst.mockResolvedValue({
      ...base,
      status: ChangeRequestStatus.PENDING_ACADEMIC_OFFICE,
      ...patch,
    });

  it('refuses the creator before reading any row', async () => {
    prisma.changeRequest.findFirst.mockResolvedValue({
      ...base,
      createdById: 'approver',
    });
    await expect(service.approve('r1', {}, ACCESS)).rejects.toMatchObject({
      code: 'SELF_APPROVAL',
    });
    expect(recorder.actionableRows).not.toHaveBeenCalled();
  });

  it('lets a demo account (canSelfApprove) decide its own request', async () => {
    prisma.changeRequest.findFirst.mockResolvedValue({
      ...base,
      createdById: 'approver',
    });
    prisma.user.findUnique.mockResolvedValueOnce({ canSelfApprove: true });
    await service.approve('r1', {}, ACCESS);
    expect(recorder.actionableRows).toHaveBeenCalled();
  });

  it('refuses a caller with no row to decide', async () => {
    recorder.actionableRows.mockResolvedValue([]);
    await expect(service.approve('r1', {}, ACCESS)).rejects.toMatchObject({
      code: 'NOT_YOUR_STEP',
    });
    expect(recorder.record).not.toHaveBeenCalled();
  });

  it('claims first, then records every own row with the remark, and notifies the next level', async () => {
    const order: string[] = [];
    recorder.claim.mockImplementation(() => order.push('claim'));
    recorder.actionableRows.mockImplementation(() => {
      order.push('rows');
      return mine;
    });
    recorder.record.mockImplementation(() => order.push('record'));
    recorder.advance.mockResolvedValue({ kind: 'NEXT_LEVEL', level: 2 });
    await service.approve('r1', { remark: 'Đồng ý' }, ACCESS);
    expect(order).toEqual(['claim', 'rows', 'record']);
    expect(recorder.record).toHaveBeenCalledWith(tx, ['s1', 's2'], {
      action: ApprovalAction.APPROVE,
      remark: 'Đồng ý',
      performedById: 'approver',
      isOverride: false,
    });
    expect(notifier.arrived).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ id: 'r1' }),
      2,
      'approver',
    );
  });

  it('stays at the level and notifies nobody while another approver is pending', async () => {
    await service.approve('r1', {}, ACCESS);
    expect(notifier.arrived).not.toHaveBeenCalled();
    expect(recorder.close).not.toHaveBeenCalled();
  });

  it('sends a data request at level 3 to the final approval', async () => {
    atLevel3();
    await expect(service.approve('r1', {}, ACCESS)).rejects.toMatchObject({
      code: 'FINAL_APPROVAL_REQUIRED',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('applies an organisational request before recording and closes it EFFECTIVE', async () => {
    atLevel3({ requestType: ChangeRequestType.ORGANIZATION });
    recorder.advance.mockResolvedValue({ kind: 'COMPLETE' });
    const order: string[] = [];
    applier.apply.mockImplementation(() => order.push('apply'));
    recorder.record.mockImplementation(() => order.push('record'));
    await service.approve('r1', {}, ACCESS);
    expect(order).toEqual(['apply', 'record']);
    expect(recorder.close).toHaveBeenCalledWith(
      tx,
      'r1',
      ChangeRequestStatus.EFFECTIVE,
    );
    expect(notifier.approved).toHaveBeenCalled();
  });

  it('refuses a stale organisational request and an apply failure without recording', async () => {
    atLevel3({ requestType: ChangeRequestType.ORGANIZATION });
    stale.isStale.mockResolvedValue(true);
    await expect(service.approve('r1', {}, ACCESS)).rejects.toMatchObject({
      code: 'STALE_BASE',
    });
    stale.isStale.mockResolvedValue(false);
    applier.apply.mockRejectedValue(
      new AppException({
        status: 409,
        code: 'ORGANIZATION_APPLY_FAILED',
        message: 'm',
      }),
    );
    await expect(service.approve('r1', {}, ACCESS)).rejects.toMatchObject({
      code: 'ORGANIZATION_APPLY_FAILED',
    });
    expect(recorder.record).not.toHaveBeenCalled();
  });

  it('returns to Draft with the round unchanged and keeps the working copy', async () => {
    await service.returnToDraft('r1', { remark: REMARK }, ACCESS);
    expect(recorder.record).toHaveBeenCalledWith(
      tx,
      ['s1', 's2'],
      expect.objectContaining({
        action: ApprovalAction.RETURN,
        remark: REMARK,
      }),
    );
    expect(recorder.close).toHaveBeenCalledWith(
      tx,
      'r1',
      ChangeRequestStatus.DRAFT,
    );
    expect(copies.discard).not.toHaveBeenCalled();
    expect(notifier.decided).toHaveBeenCalledWith(
      tx,
      expect.anything(),
      ApprovalAction.RETURN,
      REMARK,
      'approver',
      [],
    );
  });

  it('rejects for good and discards the working copy', async () => {
    await service.reject('r1', { remark: REMARK }, ACCESS);
    expect(recorder.close).toHaveBeenCalledWith(
      tx,
      'r1',
      ChangeRequestStatus.REJECTED,
    );
    expect(copies.discard).toHaveBeenCalledWith(tx, 'r1');
  });

  describe('override', () => {
    const bypassed = [
      { id: 'a', approverId: 'coord1' },
      { id: 'b', approverId: 'coord2' },
    ];
    beforeEach(() => tx.approvalStep.findMany.mockResolvedValue(bypassed));

    it('decides every pending row of the level as an override and moves on', async () => {
      recorder.advance.mockResolvedValue({ kind: 'NEXT_LEVEL', level: 2 });
      await service.override(
        'r1',
        { action: ApprovalAction.APPROVE, reason: REMARK },
        ACCESS,
      );
      expect(recorder.record).toHaveBeenCalledWith(tx, ['a', 'b'], {
        action: ApprovalAction.APPROVE,
        remark: REMARK,
        performedById: 'approver',
        isOverride: true,
      });
      expect(notifier.overridden).toHaveBeenCalledWith(
        tx,
        expect.anything(),
        ['coord1', 'coord2'],
        ApprovalAction.APPROVE,
        REMARK,
        'approver',
      );
      expect(notifier.arrived).toHaveBeenCalled();
    });

    it('returns to Draft and does not tell the bypassed approvers twice', async () => {
      await service.override(
        'r1',
        { action: ApprovalAction.RETURN, reason: REMARK },
        ACCESS,
      );
      expect(recorder.close).toHaveBeenCalledWith(
        tx,
        'r1',
        ChangeRequestStatus.DRAFT,
      );
      expect(notifier.decided).toHaveBeenCalledWith(
        tx,
        expect.anything(),
        ApprovalAction.RETURN,
        REMARK,
        'approver',
        ['coord1', 'coord2'],
      );
    });

    it("refuses level 3 and the caller's own request", async () => {
      atLevel3();
      await expect(
        service.override(
          'r1',
          { action: ApprovalAction.APPROVE, reason: REMARK },
          ACCESS,
        ),
      ).rejects.toMatchObject({ code: 'OVERRIDE_LEVEL' });
      prisma.changeRequest.findFirst.mockResolvedValue({
        ...base,
        createdById: 'approver',
      });
      await expect(
        service.override(
          'r1',
          { action: ApprovalAction.APPROVE, reason: REMARK },
          ACCESS,
        ),
      ).rejects.toMatchObject({ code: 'SELF_APPROVAL' });
    });
  });
});
