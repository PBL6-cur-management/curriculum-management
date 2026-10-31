import { App, Button, Flex, Popconfirm, Result, Segmented, Select } from 'antd';
import type { TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { DEFAULT_PAGE_SIZE } from '../../../shared/api/pagination';
import {
  DataTable,
  FilterBar,
  PageHeader,
  PageSkeleton,
  StatusTag,
} from '../../../shared/design-system';
import { SectionNav } from '../../../shared/layout/SectionNav';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type {
  Delegation,
  DelegationQuery,
  DelegationStatus,
} from '../api/delegations';
import { CreateDelegationModal } from '../components/CreateDelegationModal';
import {
  useDelegationAccess,
  useDelegations,
  useRevokeDelegation,
} from '../hooks/useDelegations';

const STATUS_LABELS: Record<DelegationStatus, string> = {
  ACTIVE: 'Đang hiệu lực',
  EXPIRED: 'Hết hạn',
  REVOKED: 'Đã thu hồi',
};
const STATUS_COLORS: Record<DelegationStatus, string> = {
  ACTIVE: 'success',
  EXPIRED: 'default',
  REVOKED: 'error',
};
const ALL_DIRECTIONS = 'ALL';
const day = (iso: string) => dayjs(iso).format('DD/MM/YYYY');

// MH-14 (US-114): who may decide for whom, for which days. Revoking takes effect on the very next request.
export function ApprovalDelegationsPage() {
  const { message } = App.useApp();
  const [query, setQuery] = useState<DelegationQuery>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [creating, setCreating] = useState(false);
  const access = useDelegationAccess();
  const list = useDelegations(query);
  const revoke = useRevokeDelegation();

  if (access.isError || list.isError)
    return <Result status="error" title="Không thể tải danh sách ủy quyền" />;
  if (!access.data || !list.data) return <PageSkeleton />;

  async function revokeOne(row: Delegation) {
    try {
      await revoke.mutateAsync(row.id);
      message.success('Đã thu hồi ủy quyền');
    } catch (error) {
      message.error(errorMessage(error, 'Không thu hồi được ủy quyền'));
    }
  }

  const columns: TableColumnsType<Delegation> = [
    {
      title: 'Người ủy quyền',
      key: 'delegator',
      render: (_, row) => row.delegator.fullName,
    },
    {
      title: 'Người được ủy quyền',
      key: 'delegate',
      render: (_, row) => row.delegate.fullName,
    },
    {
      title: 'Cấp duyệt',
      key: 'scope',
      render: (_, row) => row.scope?.levelName ?? 'Mọi cấp đang giữ',
    },
    {
      title: 'Thời gian',
      key: 'range',
      render: (_, row) => `${day(row.validFrom)} – ${day(row.validTo)}`,
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_, row) => (
        <StatusTag
          status={row.status}
          colorMap={STATUS_COLORS}
          labelMap={STATUS_LABELS}
        />
      ),
    },
    {
      title: 'Người tạo',
      key: 'createdBy',
      render: (_, row) => row.createdBy?.fullName ?? '',
    },
    {
      title: '',
      key: 'actions',
      render: (_, row) =>
        row.canRevoke && (
          <Popconfirm
            title="Thu hồi ủy quyền này?"
            description="Người được ủy quyền mất quyền duyệt thay ngay lập tức."
            okText="Thu hồi"
            cancelText="Hủy"
            onConfirm={() => revokeOne(row)}
          >
            <Button size="small" danger>
              Thu hồi
            </Button>
          </Popconfirm>
        ),
    },
  ];

  return (
    <Flex vertical gap="middle">
      <PageHeader
        title="Ủy quyền duyệt"
        subtitle="Người được ủy quyền duyệt thay ở cấp của người ủy quyền trong khoảng ngày đã chọn; lịch sử ghi rõ ai duyệt thay ai."
        actions={
          access.data.canManage && (
            <Button type="primary" onClick={() => setCreating(true)}>
              Tạo ủy quyền
            </Button>
          )
        }
      />
      <SectionNav section="approvals" />
      <FilterBar>
        <Segmented
          options={[
            { label: 'Tất cả', value: ALL_DIRECTIONS },
            { label: 'Tôi ủy quyền', value: 'OUTGOING' },
            { label: 'Được ủy quyền cho tôi', value: 'INCOMING' },
          ]}
          value={query.direction ?? ALL_DIRECTIONS}
          onChange={(direction) =>
            setQuery((current) => ({
              ...current,
              page: 1,
              direction:
                direction === ALL_DIRECTIONS
                  ? undefined
                  : (direction as DelegationQuery['direction']),
            }))
          }
        />
        <Select
          aria-label="Trạng thái"
          allowClear
          placeholder="Mọi trạng thái"
          style={{ minWidth: 180 }}
          value={query.status}
          onChange={(status: DelegationStatus | undefined) =>
            setQuery((current) => ({ ...current, page: 1, status }))
          }
          options={Object.entries(STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </FilterBar>
      <DataTable<Delegation>
        rowKey="id"
        columns={columns}
        dataSource={list.data.items}
        total={list.data.total}
        page={query.page ?? 1}
        pageSize={query.pageSize}
        loading={list.isFetching}
        emptyText="Chưa có ủy quyền nào"
        onPageChange={(page, pageSize) =>
          setQuery((current) => ({ ...current, page, pageSize }))
        }
      />
      <CreateDelegationModal
        open={creating}
        canManageOthers={access.data.canManageOthers}
        onClose={() => setCreating(false)}
      />
    </Flex>
  );
}
