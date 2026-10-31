import { Flex, List, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { generatePath, useNavigate } from 'react-router';
import { ROUTES } from '../../routes';
import { useMarkNotificationRead } from './useNotifications';
import type { Notification, NotificationEmailStatus } from './types';

// Only the outcomes worth a glance; NOT_REQUESTED (email off or in-app only) shows nothing.
const EMAIL_TAGS: Partial<
  Record<NotificationEmailStatus, { label: string; color: string }>
> = {
  PENDING: { label: 'Đang gửi email', color: 'processing' },
  SENDING: { label: 'Đang gửi email', color: 'processing' },
  SENT: { label: 'Đã gửi email', color: 'success' },
  FAILED: { label: 'Gửi email lỗi', color: 'error' },
  SKIPPED: { label: 'Không gửi email', color: 'default' },
  UNKNOWN: { label: 'Chưa rõ email', color: 'warning' },
};

const DATE_TIME_FORMAT = 'DD/MM/YYYY HH:mm';

interface NotificationItemProps {
  notification: Notification;
  onOpen?: () => void;
  showEmail?: boolean;
}

// Opening marks it read before navigating, so the badge has dropped by the time the detail renders (US-068 AC4).
export function NotificationItem({
  notification,
  onOpen,
  showEmail = false,
}: NotificationItemProps) {
  const navigate = useNavigate();
  const markRead = useMarkNotificationRead();
  const unread = notification.readStatus === 'UNREAD';
  const email = EMAIL_TAGS[notification.emailStatus];

  async function open() {
    if (unread)
      await markRead.mutateAsync(notification.id).catch(() => undefined);
    onOpen?.();
    if (notification.link) {
      void navigate(notification.link);
    } else if (notification.changeRequestId) {
      void navigate(
        generatePath(ROUTES.changeRequestDetail, {
          requestId: notification.changeRequestId,
        }),
      );
    }
  }

  return (
    <List.Item onClick={() => void open()} style={{ cursor: 'pointer' }}>
      <List.Item.Meta
        title={
          <Typography.Text strong={unread}>
            {notification.content}
          </Typography.Text>
        }
        description={
          <Flex gap="small" align="center" wrap>
            {dayjs(notification.createdAt).format(DATE_TIME_FORMAT)}
            {showEmail && email && <Tag color={email.color}>{email.label}</Tag>}
          </Flex>
        }
      />
    </List.Item>
  );
}
