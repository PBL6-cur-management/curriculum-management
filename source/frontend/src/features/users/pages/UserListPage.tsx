import { useState } from 'react';
import { Button, Input, Result, Select, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { Link, generatePath } from 'react-router';
import { DEFAULT_PAGE_SIZE } from '../../../shared/api/pagination';
import { ROUTES } from '../../../routes';
import { OrgUnitSelect } from '../../../shared/org-units/OrgUnitSelect';
import {
  DataTable,
  ListPageLayout,
  PageHeader,
  StatusTag,
} from '../../../shared/design-system/index';
import {
  USER_STATUS_COLORS,
  USER_STATUS_LABELS,
} from '../constants/userLabels';
import { useUserList } from '../hooks/useUsers';
import type { CreatedUser, UserListParams, UserSummary } from '../api/users';
import { UserFormModal } from '../components/UserFormModal';
import { TemporaryPasswordModal } from '../components/TemporaryPasswordModal';

export function UserListPage() {
  const [params, setParams] = useState<UserListParams>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const { data, isPending, isError } = useUserList(params);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedUser | null>(null);

  const columns: TableColumnsType<UserSummary> = [
    { title: 'Mã người dùng', dataIndex: 'userCode' },
    {
      title: 'Họ tên',
      dataIndex: 'fullName',
      render: (_, user) => (
        <Link to={generatePath(ROUTES.userDetail, { userId: user.id })}>
          {user.fullName}
        </Link>
      ),
    },
    { title: 'Tên đăng nhập', dataIndex: 'username' },
    { title: 'Đơn vị', render: (_, user) => user.orgUnit?.unitName ?? '—' },
    {
      title: 'Vai trò',
      dataIndex: 'activeRoleCodes',
      render: (roles: string[]) =>
        roles.map((role) => <Tag key={role}>{role}</Tag>),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (status: UserSummary['status']) => (
        <StatusTag
          status={status}
          colorMap={USER_STATUS_COLORS}
          labelMap={USER_STATUS_LABELS}
        />
      ),
    },
  ];

  if (isError)
    return <Result status="error" title="Không thể tải danh sách tài khoản" />;

  return (
    <>
      <ListPageLayout
        header={
          <PageHeader
            title="Tài khoản"
            actions={
              <Button type="primary" onClick={() => setCreating(true)}>
                Thêm tài khoản
              </Button>
            }
          />
        }
        filters={
          <>
            <Input.Search
              placeholder="Tìm tài khoản"
              allowClear
              onSearch={(q) =>
                setParams((current) => ({
                  ...current,
                  page: 1,
                  q: q || undefined,
                }))
              }
              onChange={(event) => {
                if (!event.target.value)
                  setParams((current) => ({
                    ...current,
                    page: 1,
                    q: undefined,
                  }));
              }}
            />
            <OrgUnitSelect
              onChange={(orgUnitId) =>
                setParams((current) => ({
                  ...current,
                  page: 1,
                  orgUnitId: orgUnitId ?? undefined,
                }))
              }
            />
            <Select
              allowClear
              placeholder="Trạng thái"
              options={[
                { value: 'ACTIVE', label: 'Hoạt động' },
                { value: 'DISABLED', label: 'Vô hiệu hóa' },
              ]}
              onChange={(status) =>
                setParams((current) => ({ ...current, page: 1, status }))
              }
            />
          </>
        }
        table={
          <DataTable<UserSummary>
            rowKey="id"
            columns={columns}
            dataSource={data?.items ?? []}
            loading={isPending}
            total={data?.total ?? 0}
            page={params.page}
            pageSize={params.pageSize}
            emptyText="Chưa có tài khoản"
            onPageChange={(page, pageSize) =>
              setParams((current) => ({ ...current, page, pageSize }))
            }
          />
        }
      />
      <UserFormModal
        open={creating}
        mode="create"
        onClose={() => setCreating(false)}
        onSaved={(result) => {
          setCreating(false);
          setCreated(result as CreatedUser);
        }}
      />
      <TemporaryPasswordModal
        username={created?.user.username ?? ''}
        temporaryPassword={created?.temporaryPassword ?? null}
        onClose={() => setCreated(null)}
      />
    </>
  );
}
