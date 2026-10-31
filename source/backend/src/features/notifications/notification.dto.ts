import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, Max } from 'class-validator';
import {
  EmailDeliveryStatus,
  NotificationReadStatus,
  NotificationType,
  type Notification,
} from '../../generated/prisma/client.js';
import { NOTIFICATION_PAGE_SIZE_MAX } from '../../shared/notifications/notification.constants.js';
import { PageQueryDto } from '../../shared/pagination/page-query.dto.js';

export class NotificationQueryDto extends PageQueryDto {
  @Max(NOTIFICATION_PAGE_SIZE_MAX)
  declare pageSize: number;

  @ApiPropertyOptional({ type: Boolean, description: 'Only unread ones' })
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsOptional()
  @IsBoolean()
  unread?: boolean;
}

export class NotificationDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: NotificationType, enumName: 'NotificationType' })
  notificationType!: NotificationType;
  @ApiProperty() content!: string;
  @ApiProperty({ nullable: true, type: String }) changeRequestId!:
    string | null;
  @ApiProperty({
    enum: NotificationReadStatus,
    enumName: 'NotificationReadStatus',
  })
  readStatus!: NotificationReadStatus;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ nullable: true, type: String }) readAt!: string | null;
  @ApiProperty({ description: 'F-25: true only when SMTP accepted the email' })
  emailSent!: boolean;
  @ApiProperty({
    enum: [...Object.values(EmailDeliveryStatus), 'NOT_REQUESTED'],
    enumName: 'NotificationEmailStatus',
    description: 'NOT_REQUESTED: email was off or the event is in-app only',
  })
  emailStatus!: NotificationEmailStatus;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Path in the web app this notification opens',
  })
  link!: string | null;
}

export type NotificationEmailStatus = EmailDeliveryStatus | 'NOT_REQUESTED';

export class NotificationPreferenceDto {
  @ApiProperty() emailEnabled!: boolean;
  @ApiProperty({
    description:
      'Email is switched on for the system and the account has an address; not an SMTP probe',
  })
  emailAvailable!: boolean;
}

export class UpdateNotificationPreferenceDto {
  @ApiProperty()
  @IsBoolean()
  emailEnabled!: boolean;
}

export const NOTIFICATION_DELIVERY_INCLUDE = {
  emailDelivery: { select: { status: true } },
} as const;

export class NotificationPageDto {
  @ApiProperty({ type: [NotificationDto] }) items!: NotificationDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class UnreadCountDto {
  @ApiProperty() count!: number;
}

export function notificationLink(row: Notification): string | null {
  if (row.notificationType === NotificationType.DELEGATION_RECEIVED)
    return '/approval-delegations';
  return row.changeRequestId
    ? `/change-requests/${encodeURIComponent(row.changeRequestId)}`
    : null;
}

export function toNotificationDto(
  row: Notification & {
    emailDelivery?: { status: EmailDeliveryStatus } | null;
  },
): NotificationDto {
  const emailStatus = row.emailDelivery?.status ?? 'NOT_REQUESTED';
  return {
    id: row.id,
    notificationType: row.notificationType,
    content: row.content,
    changeRequestId: row.changeRequestId,
    readStatus: row.readStatus,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
    emailSent: emailStatus === EmailDeliveryStatus.SENT,
    emailStatus,
    link: notificationLink(row),
  };
}
