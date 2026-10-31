import {
  NotificationReadStatus,
  NotificationType,
} from '../../generated/prisma/client.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import type { NotificationQueryDto } from './notification.dto.js';
import { NotificationService } from '../../shared/notifications/notification.service.js';
import { NotificationsService } from './notifications.service.js';

const row = (patch: object = {}) => ({
  id: 'n1',
  recipientId: 'u1',
  notificationType: NotificationType.REQUEST_AWAITING_YOU,
  content: 'x',
  changeRequestId: 'r1',
  readStatus: NotificationReadStatus.UNREAD,
  readAt: null,
  createdAt: new Date('2026-10-19T00:00:00Z'),
  ...patch,
});

describe('NotificationsService', () => {
  const findMany = vi.fn();
  const count = vi.fn();
  const findFirst = vi.fn();
  const update = vi.fn();
  const updateMany = vi.fn();
  const prisma = {
    notification: { findMany, count, findFirst, update, updateMany },
    $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
  };
  const service = new NotificationsService(
    prisma as unknown as PrismaService,
    new NotificationService(),
  );

  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([row()]);
    count.mockResolvedValue(1);
    update.mockImplementation(({ data }) => Promise.resolve(row(data)));
  });

  it("lists only the caller's rows and applies the unread filter", async () => {
    const query = {
      page: 1,
      pageSize: 20,
      unread: true,
    } as NotificationQueryDto;
    const page = await service.list('u1', query);
    expect(page.total).toBe(1);
    expect(findMany.mock.calls[0][0].where).toEqual({
      recipientId: 'u1',
      readStatus: NotificationReadStatus.UNREAD,
    });
    await service.list('u1', { page: 1, pageSize: 20 } as NotificationQueryDto);
    expect(findMany.mock.calls[1][0].where).toEqual({ recipientId: 'u1' });
  });

  it('counts unread rows of the caller', async () => {
    count.mockResolvedValue(3);
    await expect(service.unreadCount('u1')).resolves.toEqual({ count: 3 });
  });

  it("answers 404 for another user's notification", async () => {
    findFirst.mockResolvedValue(null);
    await expect(service.markRead('u1', 'n1')).rejects.toMatchObject({
      code: 'NOTIFICATION_NOT_FOUND',
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'n1', recipientId: 'u1' },
      include: { emailDelivery: { select: { status: true } } },
    });
  });

  it('marks read once and is idempotent afterwards', async () => {
    findFirst.mockResolvedValueOnce(row());
    const first = await service.markRead('u1', 'n1');
    expect(first.readStatus).toBe(NotificationReadStatus.READ);
    findFirst.mockResolvedValueOnce(
      row({ readStatus: NotificationReadStatus.READ, readAt: new Date() }),
    );
    await service.markRead('u1', 'n1');
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('marks every unread row read and reports zero', async () => {
    await expect(service.markAllRead('u1')).resolves.toEqual({ count: 0 });
    expect(updateMany.mock.calls[0][0].where).toEqual({
      recipientId: 'u1',
      readStatus: NotificationReadStatus.UNREAD,
    });
  });
});
