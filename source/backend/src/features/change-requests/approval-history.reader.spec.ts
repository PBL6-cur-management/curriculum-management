import { ApprovalAction } from '../../generated/prisma/client.js';
import { AccessContext } from '../../shared/authz/access-context.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import { ApprovalHistoryReader } from './approval-history.reader.js';

const step = (patch: object) => ({
  id: 's',
  submissionRound: 1,
  approvalLevel: 1,
  approver: { id: 'a', fullName: 'A' },
  performedBy: null,
  forSubjectGroup: null,
  forProgram: null,
  action: ApprovalAction.PENDING,
  remark: null,
  recordedAt: null,
  isSkipped: false,
  isOverride: false,
  skipReason: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  ...patch,
});

describe('ApprovalHistoryReader', () => {
  const findMany = vi.fn();
  const prisma = {
    approvalDelegation: { findMany: vi.fn().mockResolvedValue([]) },
    changeRequest: { findFirst: vi.fn().mockResolvedValue({ id: 'r1' }) },
    approvalStep: { findMany },
  };
  const reader = new ApprovalHistoryReader(prisma as unknown as PrismaService);

  it("groups rows by round, newest round first, with the round's submit time", async () => {
    findMany.mockResolvedValue([
      step({
        id: 'b1',
        submissionRound: 2,
        createdAt: new Date('2026-10-05T00:00:00Z'),
      }),
      step({
        id: 'a1',
        submissionRound: 1,
        action: ApprovalAction.RETURN,
        recordedAt: new Date('2026-10-02T00:00:00Z'),
      }),
      step({ id: 'a2', submissionRound: 1, approvalLevel: 3, approver: null }),
    ]);
    const history = await reader.read('r1', new AccessContext('u', []));
    expect(history.rounds.map((round) => round.submissionRound)).toEqual([
      2, 1,
    ]);
    expect(history.rounds[0].submittedAt).toBe('2026-10-05T00:00:00.000Z');
    expect(history.rounds[1].steps.map((s) => s.id)).toEqual(['a1', 'a2']);
  });

  it('labels skipped and override rows and keeps both names on an override', async () => {
    findMany.mockResolvedValue([
      step({
        id: 'k',
        isSkipped: true,
        skipReason: 'x',
        action: ApprovalAction.APPROVE,
      }),
      step({
        id: 'o',
        isOverride: true,
        action: ApprovalAction.APPROVE,
        performedBy: { id: 'office', fullName: 'Phòng ĐT' },
      }),
    ]);
    const [round] = (await reader.read('r1', new AccessContext('u', [])))
      .rounds;
    expect(round.steps[0].kind).toBe('SKIPPED');
    expect(round.steps[1]).toMatchObject({
      kind: 'OVERRIDE',
      approver: { id: 'a' },
      performedBy: { id: 'office' },
    });
  });
});
