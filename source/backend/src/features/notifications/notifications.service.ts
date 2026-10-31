import { Injectable } from '@nestjs/common';
import {
  NotificationReadStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { toPage, toSkipTake, type Page } from '../../shared/pagination/page.js';
import { NotificationService } from '../../shared/notifications/notification.service.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import {
  NOTIFICATION_DELIVERY_INCLUDE,
  toNotificationDto,
  type NotificationPreferenceDto,
  type NotificationDto,
  type NotificationQueryDto,
  type UnreadCountDto,
} from './notification.dto.js';
import { NOTIFICATION_ERRORS } from './notifications.errors.js';

// Own rows only: another user's id answers 404, so existence is not revealed.
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: NotificationService,
  ) {}

  async list(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<Page<NotificationDto>> {
    const where: Prisma.NotificationWhereInput = {
      recipientId: userId,
      ...(query.unread && { readStatus: NotificationReadStatus.UNREAD }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: NOTIFICATION_DELIVERY_INCLUDE,
        ...toSkipTake(query),
      }),
      this.prisma.notification.count({ where }),
    ]);
    return toPage(rows.map(toNotificationDto), total, query);
  }

  async unreadCount(userId: string): Promise<UnreadCountDto> {
    return {
      count: await this.prisma.notification.count({
        where: {
          recipientId: userId,
          readStatus: NotificationReadStatus.UNREAD,
        },
      }),
    };
  }

  // Idempotent: reading a read notification returns it unchanged.
  async markRead(userId: string, id: string): Promise<NotificationDto> {
    const row = await this.prisma.notification.findFirst({
      where: { id, recipientId: userId },
      include: NOTIFICATION_DELIVERY_INCLUDE,
    });
    if (!row) {
      throw new AppException(NOTIFICATION_ERRORS.NOTIFICATION_NOT_FOUND);
    }
    if (row.readStatus === NotificationReadStatus.READ) {
      return toNotificationDto(row);
    }
    return toNotificationDto(
      await this.prisma.notification.update({
        where: { id },
        data: { readStatus: NotificationReadStatus.READ, readAt: new Date() },
        include: NOTIFICATION_DELIVERY_INCLUDE,
      }),
    );
  }

  async preferences(userId: string): Promise<NotificationPreferenceDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        email: true,
        notificationPreference: { select: { emailEnabled: true } },
      },
    });
    return {
      emailEnabled: user.notificationPreference?.emailEnabled ?? true,
      emailAvailable: this.notifier.emailEnabled && Boolean(user.email?.trim()),
    };
  }

  // US-115 AC3: a personal switch; in-app notifications never stop.
  async updatePreferences(
    userId: string,
    emailEnabled: boolean,
  ): Promise<NotificationPreferenceDto> {
    await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, emailEnabled },
      update: { emailEnabled },
    });
    return this.preferences(userId);
  }

  async markAllRead(userId: string): Promise<UnreadCountDto> {
    await this.prisma.notification.updateMany({
      where: { recipientId: userId, readStatus: NotificationReadStatus.UNREAD },
      data: { readStatus: NotificationReadStatus.READ, readAt: new Date() },
    });
    return { count: 0 };
  }
}
