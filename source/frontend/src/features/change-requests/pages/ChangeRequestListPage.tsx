import { Button, Flex, Result } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback } from 'react';
import { useUrlQuery } from '../../../shared/hooks/useUrlQuery';
import { generatePath, Link } from 'react-router';
import { ROUTES } from '../../../routes';
import { DEFAULT_PAGE_SIZE } from '../../../shared/api/pagination';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { useCan } from '../../../shared/auth/useCan';
import { RequestStatusTag } from '../../../shared/change-requests/RequestStatusTag';
import type {
  ChangeRequestQuery,
  ChangeRequestSummary,
} from '../api/changeRequests';
import { ChangeRequestFilters } from '../components/ChangeRequestFilters';
import { TargetCell } from '../components/TargetCell';
import {
  NO_REQUESTS,
  ORIGIN_LABELS,
  REQUEST_TYPE_LABELS,
} from '../constants/changeRequestLabels';
import { useChangeRequests } from '../hooks/useChangeRequests';
import { formatDateTime } from '../utils/format';
import {
  DataTable,
  formatEmpty,
  PageHeader,
} from '../../../shared/design-system';

const INITIAL_QUERY: ChangeRequestQuery = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};
const QUERY_KINDS = {
  page: 'number',
  pageSize: 'number',
  mine: 'boolean',
  minDaysWaiting: 'number',
} as const;

const NOT_WAITING = 'Không chờ';

const COLUMNS: TableColumnsType<ChangeRequestSummary> = [
  {
    title: 'Mã',
    dataIndex: 'requestCode',
    render: (code: string, request) => (
      <Link
        to={generatePath(ROUTES.changeRequestDetail, { requestId: request.id })}
      >
        {code}
      </Link>
    ),
  },
  {
    title: 'Loại',
    dataIndex: 'requestType',
    render: (type: ChangeRequestSummary['requestType']) =>
      REQUEST_TYPE_LABELS[type],
  },
  {
    title: 'Đối tượng',
    dataIndex: 'target',
    render: (target: ChangeRequestSummary['target']) => (
      <TargetCell target={target} />
    ),
  },
  { title: 'Tiêu đề', dataIndex: 'title' },
  {
    title: 'Nguồn',
    dataIndex: 'origin',
    render: (origin: ChangeRequestSummary['origin']) => ORIGIN_LABELS[origin],
  },
  { title: 'Người tạo', dataIndex: ['createdBy', 'fullName'] },
  {
    title: 'Trạng thái',
    render: (_value, request) => (
      <>
        <RequestStatusTag status={request.status} />
        {request.submissionRound > 1 && ` lần ${request.submissionRound}`}
      </>
    ),
  },
  {
    title: 'Số ngày chờ',
    dataIndex: 'daysWaiting',
    // Null while the request is not waiting on any approver (draft, closed).
    render: (days: number | null) => formatEmpty(days, NOT_WAITING),
  },
  {
    title: 'Cập nhật',
    dataIndex: 'updatedAt',
    render: (iso: string) => formatDateTime(iso),
  },
];

// MH-38: the requests of the caller and the submitted ones inside their scope (D9).
export function ChangeRequestListPage() {
  const [query, setQuery] = useUrlQuery<ChangeRequestQuery>(
    INITIAL_QUERY,
    QUERY_KINDS,
  );
  const { data, isFetching, isError } = useChangeRequests(query);
  const canCreate = useCan(PERMISSIONS.changeRequestCreate);
  const canCreateOrganizational = useCan(
    PERMISSIONS.changeRequestCreateOrganizational,
  );
  const applyFilters = useCallback(
    (filters: Partial<ChangeRequestQuery>) =>
      setQuery((current) => ({ ...current, ...filters, page: 1 })),
    [setQuery],
  );
  if (isError)
    return <Result status="error" title="Không thể tải danh sách đề xuất" />;
  return (
    <Flex vertical gap="middle">
      <PageHeader
        title="Đề xuất thay đổi"
        actions={
          <>
            {canCreateOrganizational && (
              <Link to={ROUTES.changeRequestOrganizationalNew}>
                <Button>Đề xuất tổ chức</Button>
              </Link>
            )}
            {canCreate && (
              <Link to={ROUTES.changeRequestNew}>
                <Button type="primary">Tạo đề xuất</Button>
              </Link>
            )}
          </>
        }
      />
      <ChangeRequestFilters value={query} onChange={applyFilters} />
      <DataTable<ChangeRequestSummary>
        rowKey="id"
        columns={COLUMNS}
        dataSource={data?.items ?? []}
        total={data?.total ?? 0}
        page={query.page ?? 1}
        pageSize={query.pageSize}
        loading={isFetching}
        emptyText={NO_REQUESTS}
        onPageChange={(page, pageSize) =>
          setQuery((current) => ({ ...current, page, pageSize }))
        }
      />
    </Flex>
  );
}
