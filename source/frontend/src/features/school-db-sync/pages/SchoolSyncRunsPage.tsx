import { Alert, Button, Select, type TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { generatePath, Link, useSearchParams } from 'react-router';
import { ROUTES } from '../../../routes';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from '../../../shared/api/pagination';
import {
  DataTable,
  ListPageLayout,
  PageHeader,
  StatusTag,
  formatEmpty,
} from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { SyncRun, SyncRunQuery, SyncRunStatus } from '../api/schoolSync';
import {
  RUN_STATUS_COLORS,
  RUN_STATUS_LABELS,
  TRIGGER_LABELS,
} from '../constants/syncLabels';
import { useSyncRuns } from '../hooks/useSchoolSync';

const formatTime = (iso: string) => dayjs(iso).format('DD/MM/YYYY HH:mm');

const columns: TableColumnsType<SyncRun> = [
  {
    title: 'Bắt đầu',
    dataIndex: 'startedAt',
    render: (value: string, run) => (
      <Link to={generatePath(ROUTES.schoolSyncRunDetail, { runId: run.id })}>
        {formatTime(value)}
      </Link>
    ),
  },
  {
    title: 'Cách chạy',
    dataIndex: 'trigger',
    render: (trigger: SyncRun['trigger']) => TRIGGER_LABELS[trigger],
  },
  {
    title: 'Trạng thái',
    dataIndex: 'status',
    render: (status: SyncRunStatus) => (
      <StatusTag
        status={status}
        colorMap={RUN_STATUS_COLORS}
        labelMap={RUN_STATUS_LABELS}
      />
    ),
  },
  { title: 'Bản ghi', dataIndex: 'recordCount', align: 'right' },
  { title: 'Thay đổi', dataIndex: 'changedCount', align: 'right' },
  { title: 'Xung đột', dataIndex: 'conflictCount', align: 'right' },
  {
    title: 'Kết thúc',
    dataIndex: 'finishedAt',
    render: (value: string | null) =>
      value ? formatTime(value) : formatEmpty(value, 'Đang chạy'),
  },
];

// MH-13. Newest first; failed runs keep their reason and can be run again from their detail page.
export function SchoolSyncRunsPage() {
  const [search, setSearch] = useSearchParams();
  const status = (Object.keys(RUN_STATUS_LABELS) as SyncRunStatus[]).find(
    (value) => value === search.get('status'),
  );
  const rawPage = Number(search.get('page') ?? 1);
  const rawSize = Number(search.get('pageSize') ?? DEFAULT_PAGE_SIZE);
  const query: SyncRunQuery = {
    status,
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize: PAGE_SIZE_OPTIONS.includes(rawSize) ? rawSize : DEFAULT_PAGE_SIZE,
  };
  const runs = useSyncRuns(query);

  function change(
    values: Record<string, string | undefined>,
    resetPage = true,
  ) {
    const next = new URLSearchParams(search);
    if (resetPage) next.delete('page');
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearch(next);
  }

  return (
    <ListPageLayout
      header={
        <PageHeader
          title="Lịch sử đồng bộ"
          subtitle="Mỗi lần đồng bộ ghi tất cả hoặc không ghi gì."
          actions={<Link to={ROUTES.schoolSync}>Cấu hình đồng bộ</Link>}
        />
      }
      filters={
        <Select
          aria-label="Lọc trạng thái"
          placeholder="Trạng thái"
          allowClear
          value={status}
          style={{ minWidth: 180 }}
          options={Object.entries(RUN_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          onChange={(value) => change({ status: value })}
        />
      }
      table={
        <>
          {runs.error && (
            <Alert
              type="error"
              showIcon
              title={errorMessage(
                runs.error,
                'Không tải được lịch sử đồng bộ.',
              )}
              action={
                <Button onClick={() => void runs.refetch()}>Thử lại</Button>
              }
            />
          )}
          <DataTable
            rowKey="id"
            columns={columns}
            dataSource={runs.isError ? [] : (runs.data?.items ?? [])}
            total={runs.isError ? 0 : (runs.data?.total ?? 0)}
            page={query.page!}
            pageSize={query.pageSize}
            loading={runs.isPending}
            onPageChange={(page, pageSize) =>
              change(
                {
                  page: String(pageSize !== query.pageSize ? 1 : page),
                  pageSize: String(pageSize),
                },
                false,
              )
            }
            emptyText="Chưa có lần đồng bộ nào khớp bộ lọc."
            scroll={{ x: 900 }}
          />
        </>
      }
    />
  );
}
