import { useMemo, useState } from 'react';
import { EditOutlined } from '@ant-design/icons';
import {
  Button,
  Collapse,
  Flex,
  Input,
  Result,
  Skeleton,
  Switch,
  Table,
  Typography,
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCan } from '../../../shared/auth/useCan';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { PageHeader } from '../../../shared/design-system';
import { usePermissionMatrix } from '../hooks/usePermissionMatrix';
import { useMatrixIndex } from '../hooks/useMatrixIndex';
import type { PermissionMatrix } from '../api/permissionMatrix';
import {
  FUNCTION_GROUP_LABELS,
  cellKeyOf,
} from '../constants/matrixLabels';
import { MatrixCell, MatrixLegend } from '../components/MatrixCell';
import { RoleEditorDrawer } from '../components/RoleEditorDrawer';

type PermissionRow = PermissionMatrix['permissions'][number];

export function PermissionMatrixPage() {
  const { data, isPending, isError } = usePermissionMatrix();
  const editable = useCan(PERMISSIONS.permissionManage);
  const index = useMatrixIndex(data);
  const [search, setSearch] = useState('');
  const [onlyDifferent, setOnlyDifferent] = useState(false);
  const [editingRole, setEditingRole] = useState<string>();
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
          {editable && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              style={{ padding: 0, height: 'auto', alignSelf: 'flex-start' }}
              onClick={() => setEditingRole(role.roleCode)}
            >
              Sửa quyền
            </Button>
          )}
        </Flex>
      ),
      key: role.roleCode,
      width: 136,
      render: (_: unknown, permission: PermissionRow) => (
        <MatrixCell
          cellKey={cellKeyOf(index.cell(role.roleCode, permission.permissionCode))}
          locked={index.locked(role.roleCode, permission.permissionCode)}
        />
      ),
    })),
  ];

  return (
    <Flex vertical gap={20}>
      <PageHeader title="Ma trận quyền" />
      <Typography.Text type="secondary" style={{ marginTop: -12 }}>
        {roles.length} vai trò · {data?.permissions.length ?? 0} quyền.{' '}
        {editable
          ? 'Chọn “Sửa quyền” ở cột vai trò để thay đổi; mọi thay đổi được xác nhận một lần.'
          : 'Bạn chỉ có quyền xem.'}
      </Typography.Text>
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
            <Typography.Text>Chỉ hiện quyền khác nhau giữa các vai trò</Typography.Text>
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
          defaultActiveKey={search || onlyDifferent ? groups : groups.slice(0, 1)}
          items={groups.map((group) => {
            const rows = visible.filter((item) => item.functionGroup === group);
            return {
              key: group,
              label: (
                <Flex gap={8} align="baseline">
                  <Typography.Text strong>{FUNCTION_GROUP_LABELS[group]}</Typography.Text>
                  <Typography.Text type="secondary">{rows.length} quyền</Typography.Text>
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
    </Flex>
  );
}
