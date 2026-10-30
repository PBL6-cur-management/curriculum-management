import { Button, Flex, List, Result, Segmented } from 'antd';
import { useState } from 'react';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from '../../../shared/api/pagination';
import { NotificationItem } from '../../../shared/notifications/NotificationItem';
import type { NotificationQuery } from '../../../shared/notifications/types';
import {
  useMarkAllNotificationsRead,
  useNotifications,
} from '../../../shared/notifications/useNotifications';
import { PageHeader } from '../../../shared/design-system';

const INITIAL_QUERY: NotificationQuery = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};
const VIEW = { ALL: 'all', UNREAD: 'unread' } as const;

// MH-04: every notification of the signed-in user, newest first.
export function NotificationsPage() {
  const [query, setQuery] = useState<NotificationQuery>(INITIAL_QUERY);
  const { data, isFetching, isError } = useNotifications(query);
  const markAll = useMarkAllNotificationsRead();
  if (isError) return <Result status="error" title="Không thể tải thông báo" />;
  return (
    <Flex vertical gap="middle">
      <PageHeader
        title="Thông báo"
        subtitle={data ? `${data.total} thông báo${query.unread ? ' chưa đọc' : ''}` : undefined}
        actions={
          <>
            <Button
              onClick={() => markAll.mutate()}
              loading={markAll.isPending}
            >
              Đánh dấu tất cả đã đọc
            </Button>
          </>
        }
      />
      <Segmented
        options={[
          { label: 'Tất cả', value: VIEW.ALL },
          { label: 'Chưa đọc', value: VIEW.UNREAD },
        ]}
        value={query.unread ? VIEW.UNREAD : VIEW.ALL}
        onChange={(view) =>
          setQuery((current) => ({
            ...current,
            page: 1,
            unread: view === VIEW.UNREAD ? true : undefined,
          }))
        }
      />
      <List
        loading={isFetching}
        dataSource={data?.items ?? []}
        locale={{ emptyText: 'Không có thông báo.' }}
        renderItem={(notification) => (
          <NotificationItem notification={notification} />
        )}
        pagination={{
          current: query.page,
          pageSize: query.pageSize,
          total: data?.total ?? 0,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          showSizeChanger: true,
          onChange: (page, pageSize) =>
            setQuery((current) => ({ ...current, page, pageSize })),
        }}
      />
    </Flex>
  );
}
