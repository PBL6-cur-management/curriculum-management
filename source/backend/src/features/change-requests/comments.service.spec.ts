import { ChangeRequestStatus } from '../../generated/prisma/client.js';
import { AccessContext } from '../../shared/authz/access-context.js';
import type { RequestNotifier } from '../../shared/change-requests/request-notifier.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import { CommentsService } from './comments.service.js';

const ACCESS = new AccessContext('author', []);

describe('CommentsService', () => {
  const tx = { comment: { create: vi.fn() } };
  const prisma = {
    approvalDelegation: { findMany: vi.fn().mockResolvedValue([]) },
    changeRequest: { findFirst: vi.fn() },
    comment: { findMany: vi.fn() },
    $transaction: vi.fn((run: (client: unknown) => unknown) => run(tx)),
  };
  const notifier = { commented: vi.fn() };
  const service = new CommentsService(
    prisma as unknown as PrismaService,
    notifier as unknown as RequestNotifier,
  );
  const created = {
    id: 'c1',
    content: 'Nội dung',
    createdAt: new Date('2026-10-19T01:00:00Z'),
    author: { id: 'author', fullName: 'A' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tx.comment.create.mockResolvedValue(created);
    prisma.changeRequest.findFirst.mockResolvedValue({
      id: 'r1',
      status: ChangeRequestStatus.REJECTED,
      createdById: 'creator',
    });
  });

  it('answers 404 for a request the caller cannot see, on read and write', async () => {
    prisma.changeRequest.findFirst.mockResolvedValue(null);
    await expect(service.list('r1', ACCESS)).rejects.toMatchObject({
      code: 'REQUEST_NOT_FOUND',
    });
    await expect(
      service.create('r1', { content: 'x' }, ACCESS),
    ).rejects.toMatchObject({ code: 'REQUEST_NOT_FOUND' });
    expect(tx.comment.create).not.toHaveBeenCalled();
  });

  it('accepts a comment on a closed request, notifies with the author as actor and leaves the status alone', async () => {
    const dto = await service.create('r1', { content: 'Nội dung' }, ACCESS);
    expect(dto).toMatchObject({
      id: 'c1',
      createdAt: '2026-10-19T01:00:00.000Z',
    });
    expect(notifier.commented).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ status: ChangeRequestStatus.REJECTED }),
      'author',
    );
  });

  it('lists oldest first', async () => {
    prisma.comment.findMany.mockResolvedValue([created]);
    await service.list('r1', ACCESS);
    expect(prisma.comment.findMany.mock.calls[0][0].orderBy).toEqual([
      { createdAt: 'asc' },
      { id: 'asc' },
    ]);
  });
});
