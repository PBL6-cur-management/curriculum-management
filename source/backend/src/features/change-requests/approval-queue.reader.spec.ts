import {
  ApprovalAction,
  ChangeRequestStatus,
  ChangeRequestType,
} from '../../generated/prisma/client.js';
import { AccessContext } from '../../shared/authz/access-context.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import { ApprovalQueueReader } from './approval-queue.reader.js';

const request = (patch: object = {}) => ({
  id: 'r1',
  requestCode: 'DX-2026-0001',
  title: 'Sửa',
  requestType: ChangeRequestType.SYLLABUS_CONTENT,
  status: ChangeRequestStatus.PENDING_COORDINATOR,
  submissionRound: 1,
  levelEnteredAt: new Date(Date.now() - 3 * 86_400_000),
  createdBy: { id: 'creator', fullName: 'C' },
  ...patch,
});
const step = (patch: object = {}, req: object = {}) => ({
  approverId: 'me',
  submissionRound: 1,
  approvalLevel: 1,
  action: ApprovalAction.PENDING,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  forSubjectGroup: { groupCode: 'GA' },
  forProgram: null,
  changeRequest: request(req),
  ...patch,
});

describe('ApprovalQueueReader', () => {
  const stepsFindMany = vi.fn();
  const requestsFindMany = vi.fn();
  const roleFindFirst = vi.fn();
  const userFindUnique = vi.fn();
  const prisma = {
    approvalDelegation: { findMany: vi.fn().mockResolvedValue([]) },
    approvalStep: { findMany: stepsFindMany },
    changeRequest: { findMany: requestsFindMany },
    roleAssignment: { findFirst: roleFindFirst },
    user: { findUnique: userFindUnique },
  };
  const reader = new ApprovalQueueReader(prisma as unknown as PrismaService);
  const access = new AccessContext('me', []);

  beforeEach(() => {
    vi.clearAllMocks();
    stepsFindMany.mockResolvedValue([]);
    requestsFindMany.mockResolvedValue([]);
    roleFindFirst.mockResolvedValue(null);
    userFindUnique.mockResolvedValue({ canSelfApprove: false });
  });

  it("leaves out the caller's own requests", async () => {
    await reader.read({}, access);
    expect(stepsFindMany.mock.calls[0][0].where.changeRequest).toMatchObject({
      createdById: { not: 'me' },
    });
  });

  it("keeps the demo account's own requests, since it may approve them", async () => {
    userFindUnique.mockResolvedValue({ canSelfApprove: true });
    roleFindFirst.mockResolvedValue({ id: 'ra' });
    await reader.read({}, access);
    expect(
      stepsFindMany.mock.calls[0][0].where.changeRequest,
    ).not.toHaveProperty('createdById');
    expect(requestsFindMany.mock.calls[0][0].where).not.toHaveProperty(
      'createdById',
    );
  });

  it('drops a dead row of an earlier round and a row of another level', async () => {
    stepsFindMany.mockResolvedValue([
      step({ submissionRound: 1 }, { submissionRound: 2 }),
      step({ approvalLevel: 2 }),
    ]);
    await expect(reader.read({}, access)).resolves.toEqual([]);
  });

  it('folds two rows of one request into one item with both group codes', async () => {
    stepsFindMany.mockResolvedValue([
      step(),
      step({ forSubjectGroup: { groupCode: 'GB' } }),
    ]);
    const items = await reader.read({}, access);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      standsFor: 'GA, GB',
      approvalLevel: 1,
      daysWaiting: 3,
    });
  });

  it('adds the level-3 requests for an academic-office holder, longest waiting first', async () => {
    roleFindFirst.mockResolvedValue({ id: 'ra' });
    stepsFindMany.mockResolvedValue([
      step({}, { id: 'r1', requestCode: 'DX-1' }),
    ]);
    requestsFindMany.mockResolvedValue([
      {
        ...request({
          id: 'r2',
          requestCode: 'DX-2',
          status: ChangeRequestStatus.PENDING_ACADEMIC_OFFICE,
          levelEnteredAt: new Date(Date.now() - 9 * 86_400_000),
        }),
        steps: [
          { submissionRound: 1, createdAt: new Date('2026-09-01T00:00:00Z') },
        ],
      },
    ]);
    const items = await reader.read({}, access);
    expect(items.map((item) => item.requestCode)).toEqual(['DX-2', 'DX-1']);
    expect(items[0]).toMatchObject({ approvalLevel: 3, standsFor: null });
  });

  it('gives a non-holder no level-3 query and passes the type filter to both queries', async () => {
    await reader.read({ requestType: ChangeRequestType.CURRICULUM }, access);
    expect(requestsFindMany).not.toHaveBeenCalled();
    expect(stepsFindMany.mock.calls[0][0].where.changeRequest).toMatchObject({
      requestType: ChangeRequestType.CURRICULUM,
    });
    roleFindFirst.mockResolvedValue({ id: 'ra' });
    await reader.read({ requestType: ChangeRequestType.CURRICULUM }, access);
    expect(requestsFindMany.mock.calls[0][0].where).toMatchObject({
      requestType: ChangeRequestType.CURRICULUM,
    });
  });
});
