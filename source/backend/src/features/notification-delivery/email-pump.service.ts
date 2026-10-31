import { Injectable, Logger } from '@nestjs/common';
import {
  EmailDeliveryStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import { notificationLink } from '../notifications/notification.dto.js';
import { NotificationService } from '../../shared/notifications/notification.service.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { EMAIL_BATCH, SENDING_STALE_MS } from './delivery.constants.js';
import { MailerService } from './mailer.service.js';

const SUBJECT_MAX = 120;

// US-115 / F25-02: each delivery is attempted at most once. PENDING -> SENDING is claimed atomically before the
// SMTP call; a failure is recorded, never retried, and a claim that never finished becomes UNKNOWN, not a resend.
@Injectable()
export class EmailPumpService {
  private readonly logger = new Logger(EmailPumpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly notifications: NotificationService,
  ) {}

  async pump(
    now: Date = new Date(),
  ): Promise<{ sent: number; failed: number }> {
    await this.markStale(now);
    if (!this.notifications.emailEnabled) return { sent: 0, failed: 0 };
    const batch = await this.prisma.notificationEmailDelivery.findMany({
      where: { status: EmailDeliveryStatus.PENDING },
      orderBy: [{ createdAt: 'asc' }, { notificationId: 'asc' }],
      take: EMAIL_BATCH,
      select: { notificationId: true },
    });
    let sent = 0;
    let failed = 0;
    for (const { notificationId } of batch) {
      const outcome = await this.deliver(notificationId);
      if (outcome === EmailDeliveryStatus.SENT) sent += 1;
      if (outcome === EmailDeliveryStatus.FAILED) failed += 1;
    }
    if (batch.length > 0) {
      this.logger.log(`Email pump: ${sent} sent, ${failed} failed`);
    }
    return { sent, failed };
  }

  private async deliver(
    notificationId: string,
  ): Promise<EmailDeliveryStatus | null> {
    const { count } = await this.prisma.notificationEmailDelivery.updateMany({
      where: { notificationId, status: EmailDeliveryStatus.PENDING },
      data: { status: EmailDeliveryStatus.SENDING, attemptedAt: new Date() },
    });
    if (count === 0) return null; // another worker claimed it
    const row = await this.prisma.notification.findUniqueOrThrow({
      where: { id: notificationId },
      include: { recipient: { select: { email: true, fullName: true } } },
    });
    const to = row.recipient.email?.trim();
    if (!to) {
      return this.finish(notificationId, EmailDeliveryStatus.SKIPPED, {
        failureCode: 'NO_ADDRESS',
      });
    }
    try {
      const link = notificationLink(row);
      await this.mailer.send({
        to,
        subject: subjectOf(row.content),
        text: [
          `Kính gửi ${row.recipient.fullName},`,
          '',
          row.content,
          ...(link
            ? ['', `Xem chi tiết: ${this.mailer.appBaseUrl}${link}`]
            : []),
          '',
          'Email tự động từ hệ thống quản lý CTĐT Khoa CNTT. Có thể tắt nhận email ở trang Thông báo.',
        ].join('\n'),
      });
      return this.finish(notificationId, EmailDeliveryStatus.SENT, {
        sentAt: new Date(),
      });
    } catch (error) {
      // The reason is kept short and generic: no SMTP transcript, host or address is stored.
      this.logger.warn(
        `Email for notification ${notificationId} failed: ${errorCode(error)}`,
      );
      return this.finish(notificationId, EmailDeliveryStatus.FAILED, {
        failureCode: errorCode(error),
      });
    }
  }

  private async finish(
    notificationId: string,
    status: EmailDeliveryStatus,
    data: Prisma.NotificationEmailDeliveryUpdateManyMutationInput,
  ): Promise<EmailDeliveryStatus> {
    await this.prisma.notificationEmailDelivery.updateMany({
      where: { notificationId, status: EmailDeliveryStatus.SENDING },
      data: { ...data, status, finishedAt: new Date() },
    });
    return status;
  }

  private async markStale(now: Date): Promise<void> {
    const { count } = await this.prisma.notificationEmailDelivery.updateMany({
      where: {
        status: EmailDeliveryStatus.SENDING,
        attemptedAt: { lt: new Date(now.getTime() - SENDING_STALE_MS) },
      },
      data: {
        status: EmailDeliveryStatus.UNKNOWN,
        finishedAt: now,
        failureCode: 'INTERRUPTED',
      },
    });
    if (count > 0) {
      this.logger.warn(`${count} interrupted email(s) marked UNKNOWN`);
    }
  }
}

export function subjectOf(content: string): string {
  const line = `[CTĐT] ${content.split('\n')[0]}`;
  return line.length > SUBJECT_MAX
    ? `${line.slice(0, SUBJECT_MAX - 1)}…`
    : line;
}

function errorCode(error: unknown): string {
  const code = (error as { code?: unknown })?.code;
  return typeof code === 'string' && /^[A-Z_]{2,40}$/.test(code)
    ? code
    : 'SMTP_ERROR';
}
