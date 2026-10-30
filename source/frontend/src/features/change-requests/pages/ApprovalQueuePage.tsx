import { Flex, Result, Select, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import { useState } from 'react';
import { generatePath, Link } from 'react-router';
import { ROUTES } from '../../../routes';
import { RequestStatusTag } from '../../../shared/change-requests/RequestStatusTag';
import type {
  ApprovalQueueItem,
  ApprovalQueueQuery,
} from '../api/changeRequests';
import { NO_QUEUE } from '../constants/approvalLabels';
import { REQUEST_TYPE_LABELS } from '../constants/changeRequestLabels';
import { useApprovalQueue } from '../hooks/useApprovals';
import { formatDateTime } from '../utils/format';
import {
  FilterBar,
  formatEmpty,
  PageHeader,
  SummaryStrip,
  type SummaryItem,
} from '../../../shared/design-system';
import { REQUEST_STATUS_LABELS } from '../../../shared/change-requests/requestStatus';

const COLUMNS: TableColumnsType<ApprovalQueueItem> = [
  {
    title: 'Mã',
    dataIndex: 'requestCode',
    render: (code: string, item) => (
      <Link
        to={generatePath(ROUTES.changeRequestDetail, {
          requestId: item.requestId,
        })}
      >
        {code}
      </Link>
    ),
  },
  { title: 'Tiêu đề', dataIndex: 'title' },
  {
    title: 'Loại',
    dataIndex: 'requestType',
    render: (type: ApprovalQueueItem['requestType']) =>
      REQUEST_TYPE_LABELS[type],
  },
  {
    title: 'Cấp',
    dataIndex: 'status',
    render: (status: ApprovalQueueItem['status']) => (
      <RequestStatusTag status={status} />
    ),
  },
  {
    title: 'Thay mặt',
    dataIndex: 'standsFor',
    render: (standsFor: string | null) => formatEmpty(standsFor, SELF_LABEL),
  },
  { title: 'Người tạo', dataIndex: ['createdBy', 'fullName'] },
  {
    title: 'Ngày gửi',
    dataIndex: 'submittedAt',
    render: (iso: string) => formatDateTime(iso),
  },
  {
    title: 'Số ngày chờ',
    dataIndex: 'daysWaiting',
    defaultSortOrder: 'descend',
    sorter: (a, b) => a.daysWaiting - b.daysWaiting,
  },
];

// Approving in one's own name: there is nobody being stood in for.
const SELF_LABEL = 'Chính mình';

const TYPE_OPTIONS = Object.entries(REQUEST_TYPE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

// How much waits, and at which level, before reading the rows.
function QueueSummary({ items }: { items: ApprovalQueueItem[] }) {
  const byLevel = new Map<ApprovalQueueItem['status'], number>();
  for (const item of items)
    byLevel.set(item.status, (byLevel.get(item.status) ?? 0) + 1);
  const longest = Math.max(...items.map((item) => item.daysWaiting));
  const summary: SummaryItem[] = [
    { label: 'Đang chờ', value: items.length },
    ...[...byLevel].map(([status, count]) => ({
      label: REQUEST_STATUS_LABELS[status],
      value: count,
    })),
    { label: 'Chờ lâu nhất', value: `${longest} ngày` },
  ];
  return <SummaryStrip label="Tóm tắt hàng chờ" items={summary} />;
}

// MH-42: what waits for the caller, longest first (US-061).
export function ApprovalQueuePage() {
  const [query, setQuery] = useState<ApprovalQueueQuery>({});
  const { data, isLoading, isError } = useApprovalQueue(query);
  if (isError)
    return <Result status="error" title="Không thể tải hàng chờ duyệt" />;
  return (
    <Flex vertical gap="middle">
      <PageHeader title="Chờ tôi duyệt" />
      {data && data.length > 0 && <QueueSummary items={data} />}
      <FilterBar>
        <Select
          allowClear
          aria-label="Loại đề xuất"
          placeholder="Loại đề xuất"
          style={{ width: 280 }}
          value={query.requestType}
          options={TYPE_OPTIONS}
          onChange={(requestType) =>
            setQuery((current) => ({
              ...current,
              requestType: requestType as ApprovalQueueQuery['requestType'],
            }))
          }
        />
      </FilterBar>
      <Table<ApprovalQueueItem>
        rowKey="requestId"
        loading={isLoading}
        columns={COLUMNS}
        dataSource={data ?? []}
        pagination={false}
        locale={{ emptyText: NO_QUEUE }}
      />
    </Flex>
  );
}
