import {
  ApprovalAction,
  ChangeRequestStatus,
  ChangeRequestType,
  type Prisma,
} from '../../generated/prisma/client.js';
import { fromIsoDay } from '../time/today.js';
import { ApprovalRecorder, type DecisionSubject } from './approval-recorder.js';

const TODAY = fromIsoDay('2026-10-20');
const request: DecisionSubject = {
  id: 'r1',
  status: ChangeRequestStatus.PENDING_COORDINATOR,
  submissionRound: 1,
  createdById: 'creator',
  requestType: ChangeRequestType.SYLLABUS_CONTENT,
};

function client() {
  return {
    changeRequest: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    approvalStep: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    roleAssignment: { findFirst: vi.fn().mockResolvedValue(null) },
    approvalDelegation: { findMany: vi.fn().mockResolvedValue([]) },
  };
}
const asTx = (db: ReturnType<typeof client>) =>
  db as unknown as Prisma.TransactionClient;

describe('ApprovalRecorder', () => {
  const recorder = new ApprovalRecorder();

  it('refuses a claim when the status or round moved', async () => {
    const db = client();
    db.changeRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(recorder.claim(asTx(db), request)).rejects.toMatchObject({
      code: 'REQUEST_STATE_CHANGED',
    });
  });

  it('refuses to record a row that is no longer PENDING', async () => {
    const db = client();
    db.approvalStep.updateMany.mockResolvedValue({ count: 1 });
    await expect(
      recorder.record(asTx(db), ['a', 'b'], {
        action: ApprovalAction.APPROVE,
        remark: null,
        performedById: 'u',
        isOverride: false,
      }),
    ).rejects.toMatchObject({ code: 'STEP_ALREADY_DECIDED' });
  });

  describe('advance', () => {
    it('waits while the level still has a PENDING row', async () => {
      const db = client();
      db.approvalStep.findMany.mockResolvedValue([
        { approvalLevel: 1 },
        { approvalLevel: 3 },
      ]);
      await expect(recorder.advance(asTx(db), request)).resolves.toEqual({
        kind: 'WAITING',
      });
      expect(db.changeRequest.update).not.toHaveBeenCalled();
    });

    it('moves to the lowest higher level with a PENDING row', async () => {
      const db = client();
      db.approvalStep.findMany.mockResolvedValue([{ approvalLevel: 3 }]);
      await expect(recorder.advance(asTx(db), request)).resolves.toEqual({
        kind: 'NEXT_LEVEL',
        level: 3,
      });
      expect(db.changeRequest.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: {
          status: ChangeRequestStatus.PENDING_ACADEMIC_OFFICE,
          levelEnteredAt: expect.any(Date),
        },
      });
    });

    it('is complete when nothing is left', async () => {
      const db = client();
      await expect(recorder.advance(asTx(db), request)).resolves.toEqual({
        kind: 'COMPLETE',
      });
    });
  });

  describe('actionableRows', () => {
    it('returns nothing to the creator', async () => {
      const db = client();
      await expect(
        recorder.actionableRows(asTx(db), request, 'creator', TODAY),
      ).resolves.toEqual([]);
      expect(db.approvalStep.findMany).not.toHaveBeenCalled();
    });

    it('returns nothing outside a pending status', async () => {
      const db = client();
      await expect(
        recorder.actionableRows(
          asTx(db),
          { ...request, status: ChangeRequestStatus.DRAFT },
          'u',
          TODAY,
        ),
      ).resolves.toEqual([]);
    });

    it('matches the approver on levels 1 and 2', async () => {
      const db = client();
      await recorder.actionableRows(asTx(db), request, 'coordinator', TODAY);
      expect(db.approvalStep.findMany.mock.calls[0][0].where).toMatchObject({
        approverId: { in: ['coordinator'] },
        approvalLevel: 1,
        submissionRound: 1,
      });
    });

    it('adds the rows of a usable grant, marked with that grant (F-25)', async () => {
      const db = client();
      db.approvalDelegation.findMany.mockResolvedValue([
        { id: 'g-level2', delegatorId: 'boss', scopeLevel: 2 },
        { id: 'g-any', delegatorId: 'boss', scopeLevel: null },
      ]);
      db.approvalStep.findMany.mockResolvedValue([
        { id: 'own', approverId: 'deputy' },
        { id: 'theirs', approverId: 'boss' },
        { id: 'stranger', approverId: 'other' },
      ]);
      const rows = await recorder.actionableRows(
        asTx(db),
        request,
        'deputy',
        TODAY,
      );
      expect(rows.map((row) => [row.id, row.viaDelegationId])).toEqual([
        ['own', null],
        ['theirs', 'g-any'],
      ]);
    });

    it('records delegated rows with their grant and own rows without', async () => {
      const db = client();
      await recorder.recordRows(
        asTx(db),
        [
          { id: 'own', viaDelegationId: null },
          { id: 'theirs', viaDelegationId: 'g1' },
        ] as never,
        {
          action: ApprovalAction.APPROVE,
          remark: null,
          performedById: 'deputy',
          isOverride: false,
        },
      );
      const calls = db.approvalStep.updateMany.mock.calls.map((call) => [
        call[0].where.id.in,
        call[0].data.delegationId,
      ]);
      expect(calls).toEqual([
        [['own'], null],
        [['theirs'], 'g1'],
      ]);
    });

    it('lets only an academic-office holder act at level 3, on any row', async () => {
      const db = client();
      const final = {
        ...request,
        status: ChangeRequestStatus.PENDING_ACADEMIC_OFFICE,
      };
      await expect(
        recorder.actionableRows(asTx(db), final, 'outsider', TODAY),
      ).resolves.toEqual([]);
      db.roleAssignment.findFirst.mockResolvedValue({ id: 'ra' });
      await recorder.actionableRows(asTx(db), final, 'office', TODAY);
      expect(
        db.approvalStep.findMany.mock.calls[0][0].where,
      ).not.toHaveProperty('approverId');
    });
  });
});
