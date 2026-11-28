import { useMemo, useState } from 'react';
import { EditOutlined } from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Collapse,
  Flex,
  Input,
  Popconfirm,
  Result,
  Skeleton,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCan } from '../../../shared/auth/useCan';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { PageHeader } from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import {
  useDeleteRole,
  usePermissionMatrix,
} from '../hooks/usePermissionMatrix';
import { useMatrixIndex } from '../hooks/useMatrixIndex';
import type { PermissionMatrix, Role } from '../api/permissionMatrix';
import { FUNCTION_GROUP_LABELS, cellKeyOf } from '../constants/matrixLabels';
import { MatrixCell, MatrixLegend } from '../components/MatrixCell';
import { RoleEditorDrawer } from '../components/RoleEditorDrawer';
import { RoleFormModal } from '../components/RoleFormModal';

type PermissionRow = PermissionMatrix['permissions'][number];

export function PermissionMatrixPage() {
  const { data, isPending, isError } = usePermissionMatrix();
  const deleteRole = useDeleteRole();
  const { message } = App.useApp();
  const editable = useCan(PERMISSIONS.permissionManage);
  const index = useMatrixIndex(data);
  const [search, setSearch] = useState('');
  const [onlyDifferent, setOnlyDifferent] = useState(false);
  const [editingRole, setEditingRole] = useState<string>();
  const [roleModal, setRoleModal] = useState<{
    open: boolean;
    role: Role | null;
  }>({ open: false, role: null });
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const roles = useMemo(() => data?.roles ?? [], [data]);

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('vi');
    return (data?.permissions ?? []).filter((permission) => {
      if (
        term &&
        !permission.permissionName.toLocaleLowerCase('vi').includes(term) &&
        !permission.permissionCode.toLowerCase().includes(term)
      )
        return false;
      if (!onlyDifferent) return true;
      const keys = new Set(
        roles.map((role) =>
          cellKeyOf(index.cell(role.roleCode, permission.permissionCode)),
        ),
      );
      return keys.size > 1;
    });
  }, [data, search, onlyDifferent, roles, index]);

  const groups = useMemo(
    () => [...new Set(visible.map((permission) => permission.functionGroup))],
    [visible],
  );

  if (isError)
    return (
      <Result
        status="error"
        title="Không tải được ma trận quyền"
        subTitle="Kiểm tra kết nối rồi tải lại trang."
      />
    );

  const columns: TableColumnsType<PermissionRow> = [
    {
      title: 'Quyền',
      key: 'permission',
      fixed: 'left',
      width: 280,
      render: (_, item) => (
        <Flex vertical title={item.source ?? undefined}>
          <Typography.Text>{item.permissionName}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {item.permissionCode}
          </Typography.Text>
        </Flex>
      ),
    },
    ...roles.map((role) => ({
      title: (
        <Flex vertical gap={2}>
          <span>
            {role.roleCode} {role.roleName}
          </span>
          {role.isSystemRole && (
            <Tag style={{ alignSelf: 'flex-start', marginInlineEnd: 0 }}>
              Hệ thống
            </Tag>
          )}
          {editable && (
            <Flex vertical gap={2} align="flex-start">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                style={{ padding: 0, height: 'auto' }}
                onClick={() => setEditingRole(role.roleCode)}
              >
                Sửa quyền
              </Button>
              {!role.isSystemRole && (
                <Flex gap={8} wrap>
                  <Button
                    type="link"
                    size="small"
                    aria-label={`Sửa thông tin ${role.roleCode}`}
                    style={{ padding: 0, height: 'auto' }}
                    onClick={() => setRoleModal({ open: true, role })}
                  >
                    Sửa thông tin
                  </Button>
                  <Popconfirm
                    title={`Xóa vai trò ${role.roleCode}?`}
                    description="Chỉ xóa được khi không còn người dùng đang giữ vai trò này."
                    okText="Xóa vai trò"
                    cancelText="Hủy"
                    okButtonProps={{
                      danger: true,
                      loading: deleteRole.isPending,
                    }}
                    onConfirm={async () => {
                      setDeleteError(null);
                      try {
                        await deleteRole.mutateAsync(role.roleCode);
                        void message.success(`Đã xóa vai trò ${role.roleCode}`);
                      } catch (error) {
                        const friendly = errorMessage(
                          error,
                          'Không thể xóa vai trò đang có người dùng hoạt động.',
                        );
                        setDeleteError(friendly);
                        void message.error(friendly);
                      }
                    }}
                  >
                    <Button
                      type="link"
                      size="small"
                      danger
                      aria-label={`Xóa ${role.roleCode}`}
                      style={{ padding: 0, height: 'auto' }}
                    >
                      Xóa
                    </Button>
                  </Popconfirm>
                </Flex>
              )}
            </Flex>
          )}
        </Flex>
      ),
      key: role.roleCode,
      width: 156,
      render: (_: unknown, permission: PermissionRow) => (
        <MatrixCell
          cellKey={cellKeyOf(
            index.cell(role.roleCode, permission.permissionCode),
          )}
          locked={index.locked(role.roleCode, permission.permissionCode)}
        />
      ),
    })),
  ];

  return (
    <Flex vertical gap={20}>
      <PageHeader
        title="Ma trận quyền"
        actions={
          editable ? (
            <Button
              type="primary"
              onClick={() => setRoleModal({ open: true, role: null })}
            >
              Tạo vai trò mới
            </Button>
          ) : undefined
        }
      />
      <Typography.Text type="secondary" style={{ marginTop: -12 }}>
        {roles.length} vai trò · {data?.permissions.length ?? 0} quyền.{' '}
        {editable
          ? 'Chọn “Sửa quyền” ở cột vai trò để thay đổi; mọi thay đổi được xác nhận một lần.'
          : 'Bạn chỉ có quyền xem.'}
      </Typography.Text>
      {deleteError && (
        <Alert
          type="error"
          showIcon
          closable
          title={deleteError}
          onClose={() => setDeleteError(null)}
        />
      )}
      <Flex wrap gap={16} align="center" justify="space-between">
        <Flex wrap gap={16} align="center">
          <Input.Search
            allowClear
            placeholder="Tìm theo tên hoặc mã quyền"
            style={{ width: 300 }}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Flex align="center" gap={8}>
            <Switch
              size="small"
              checked={onlyDifferent}
              onChange={setOnlyDifferent}
              aria-label="Chỉ hiện quyền khác nhau giữa các vai trò"
            />
            <Typography.Text>
              Chỉ hiện quyền khác nhau giữa các vai trò
            </Typography.Text>
          </Flex>
        </Flex>
        <MatrixLegend />
      </Flex>
      {isPending ? (
        <Skeleton active paragraph={{ rows: 10 }} title={false} />
      ) : groups.length === 0 ? (
        <Result
          status="info"
          title="Không có quyền nào khớp bộ lọc"
          extra={
            <Button
              onClick={() => {
                setSearch('');
                setOnlyDifferent(false);
              }}
            >
              Xóa bộ lọc
            </Button>
          }
        />
      ) : (
        <Collapse
          key={`${search}|${onlyDifferent}`}
          defaultActiveKey={
            search || onlyDifferent ? groups : groups.slice(0, 1)
          }
          items={groups.map((group) => {
            const rows = visible.filter((item) => item.functionGroup === group);
            return {
              key: group,
              label: (
                <Flex gap={8} align="baseline">
                  <Typography.Text strong>
                    {FUNCTION_GROUP_LABELS[group]}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {rows.length} quyền
                  </Typography.Text>
                </Flex>
              ),
              styles: { body: { padding: 0 } },
              children: (
                <Table<PermissionRow>
                  rowKey="permissionCode"
                  size="middle"
                  columns={columns}
                  dataSource={rows}
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                />
              ),
            };
          })}
        />
      )}
      <RoleEditorDrawer
        role={roles.find((role) => role.roleCode === editingRole)}
        permissions={data?.permissions ?? []}
        index={index}
        onClose={() => setEditingRole(undefined)}
      />
      {roleModal.open && (
        <RoleFormModal
          key={roleModal.role?.roleCode ?? 'create'}
          open
          role={roleModal.role}
          onClose={() => setRoleModal({ open: false, role: null })}
        />
      )}
    </Flex>
  );
}
