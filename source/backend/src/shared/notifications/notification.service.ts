import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailDeliveryStatus,
  NotificationType,
  UserStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import type { Env } from '../config/env.validation.js';

export interface NotifyInput {
  recipientIds: readonly string[];
  type: NotificationType;
  content: string;
  changeRequestId: string | null;
  // Null for a system event (a deadline reminder): nobody clicked.
  actorId: string | null;
}

// F-25 D11: important events also go by email; comments, graduation and sync notices stay in the app.
export const EMAIL_NOTIFICATION_TYPES: ReadonlySet<NotificationType> = new Set([
  NotificationType.REQUEST_AWAITING_YOU,
  NotificationType.REQUEST_RETURNED,
  NotificationType.REQUEST_REJECTED,
  NotificationType.REQUEST_APPROVED,
  NotificationType.REQUEST_OVERRIDDEN,
  NotificationType.REQUEST_EFFECTIVE,
  NotificationType.DELEGATION_RECEIVED,
  NotificationType.REQUEST_DEADLINE_REMINDER,
]);

@Injectable()
export class NotificationService {
  constructor(@Optional() private readonly config?: ConfigService<Env, true>) {}

  get emailEnabled(): boolean {
    return this.config?.get('EMAIL_ENABLED', { infer: true }) === 'true';
  }

  // Written on the caller's transaction: an event that rolls back leaves no notification behind (D14).
  // Recipients are deduplicated and the actor is never told about their own click.
  // With email on, the delivery row commits with the notification (F-25 outbox); the pump sends it later.
  async notify(
    tx: Prisma.TransactionClient,
    input: NotifyInput,
  ): Promise<number> {
    const recipients = [...new Set(input.recipientIds)].filter(
      (id) => id !== input.actorId,
    );
    if (recipients.length === 0) return 0;
    const data = recipients.map((recipientId) => ({
      recipientId,
      notificationType: input.type,
      content: input.content,
      changeRequestId: input.changeRequestId,
    }));
    if (!this.emailEnabled || !EMAIL_NOTIFICATION_TYPES.has(input.type)) {
      const { count } = await tx.notification.createMany({ data });
      return count;
    }
    const created = await tx.notification.createManyAndReturn({
      data,
      select: { id: true, recipientId: true },
    });
    const users = await tx.user.findMany({
      where: { id: { in: recipients } },
      select: {
        id: true,
        email: true,
        status: true,
        notificationPreference: { select: { emailEnabled: true } },
      },
    });
    const reachable = new Set(
      users
        .filter(
          (user) =>
            user.status === UserStatus.ACTIVE &&
            Boolean(user.email?.trim()) &&
            user.notificationPreference?.emailEnabled !== false,
        )
        .map((user) => user.id),
    );
    // An opted-out or address-less recipient still gets a row, so the app can say why no email went.
    await tx.notificationEmailDelivery.createMany({
      data: created.map((row) => ({
        notificationId: row.id,
        status: reachable.has(row.recipientId)
          ? EmailDeliveryStatus.PENDING
          : EmailDeliveryStatus.SKIPPED,
        ...(!reachable.has(row.recipientId) && {
          finishedAt: new Date(),
          failureCode: 'NO_ADDRESS_OR_OPTED_OUT',
        }),
      })),
    });
    return created.length;
  }
}
