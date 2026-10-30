import {
  Alert,
  Button,
  Select,
  Switch,
  Typography,
  type TableColumnsType,
} from 'antd';
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
} from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { ImportQuery, ImportSummary } from '../api/imports';
import { ImportStatusTag } from '../components/ImportStatusTag';
import {
  IMPORT_STATUS_LABELS,
  IMPORT_TYPE_LABELS,
} from '../constants/importLabels';
import { useImports, useImportTypes } from '../hooks/useImports';

const columns: TableColumnsType<ImportSummary> = [
  {
    title: 'Tệp',
    dataIndex: 'fileName',
    render: (name: string, batch) => (
      <Link to={generatePath(ROUTES.importDetail, { batchId: batch.id })}>
        {name}
      </Link>
    ),
  },
  {
    title: 'Loại dữ liệu',
    dataIndex: 'importType',
    render: (type: ImportSummary['importType']) => IMPORT_TYPE_LABELS[type],
  },
  {
    title: 'Chương trình',
    render: (_, batch) =>
      batch.program
        ? `${batch.program.programCode} — ${batch.program.programName}`
        : '—',
  },
  { title: 'Người nhập', render: (_, batch) => batch.performedBy.fullName },
  {
    title: 'Thời gian',
    dataIndex: 'recordedAt',
    render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm'),
  },
  { title: 'Tổng', dataIndex: 'totalRows' },
  { title: 'Hợp lệ', dataIndex: 'successRows' },
  { title: 'Lỗi', dataIndex: 'errorRows' },
  {
    title: 'Trạng thái',
    dataIndex: 'status',
    render: (status: ImportSummary['status']) => (
      <ImportStatusTag status={status} />
    ),
  },
];
export function ImportHistoryPage() {
  const types = useImportTypes();
  const [search, setSearch] = useSearchParams();
  const importType = (
    Object.keys(IMPORT_TYPE_LABELS) as ImportSummary['importType'][]
  ).find((value) => value === search.get('importType'));
  const status = (
    Object.keys(IMPORT_STATUS_LABELS) as ImportSummary['status'][]
  ).find((value) => value === search.get('status'));
  const rawPage = Number(search.get('page') ?? 1);
  const rawSize = Number(search.get('pageSize') ?? DEFAULT_PAGE_SIZE);
  const query: ImportQuery = {
    importType,
    status,
    mine: search.get('mine') === 'true',
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize: PAGE_SIZE_OPTIONS.includes(rawSize) ? rawSize : DEFAULT_PAGE_SIZE,
  };
  const batches = useImports(query);
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
          title="Lịch sử nhập liệu"
          actions={<Link to={ROUTES.imports}>Nhập liệu mới</Link>}
        />
      }
      filters={
        <>
          <Select
            aria-label="Lọc loại dữ liệu"
            placeholder="Loại dữ liệu"
            allowClear
            value={importType}
            style={{ minWidth: 200 }}
            options={types.data?.map((option) => ({
              value: option.importType,
              label: IMPORT_TYPE_LABELS[option.importType],
            }))}
            onChange={(value) => change({ importType: value })}
          />
          <Select
            aria-label="Lọc trạng thái"
            placeholder="Trạng thái"
            allowClear
            value={status}
            style={{ minWidth: 180 }}
            options={Object.entries(IMPORT_STATUS_LABELS).map(
              ([value, label]) => ({ value, label }),
            )}
            onChange={(value) => change({ status: value })}
          />
          <Typography.Text>
            Chỉ lần nhập của tôi{' '}
            <Switch
              aria-label="Chỉ lần nhập của tôi"
              checked={query.mine}
              onChange={(value) => change({ mine: value ? 'true' : undefined })}
            />
          </Typography.Text>
        </>
      }
      table={
        <>
          {batches.error && (
            <Alert
              type="error"
              showIcon
              title={errorMessage(
                batches.error,
                'Không tải được lịch sử nhập liệu.',
              )}
              action={
                <Button onClick={() => void batches.refetch()}>Thử lại</Button>
              }
            />
          )}
          <DataTable
            rowKey="id"
            columns={columns}
            dataSource={batches.isError ? [] : (batches.data?.items ?? [])}
            total={batches.isError ? 0 : (batches.data?.total ?? 0)}
            page={query.page!}
            pageSize={query.pageSize}
            loading={batches.isPending || batches.isFetching}
            onPageChange={(page, pageSize) =>
              change(
                {
                  page: String(pageSize !== query.pageSize ? 1 : page),
                  pageSize: String(pageSize),
                },
                false,
              )
            }
            emptyText="Chưa có lần nhập nào khớp bộ lọc trong phạm vi của bạn."
            scroll={{ x: 1100 }}
          />
        </>
      }
    />
  );
}
