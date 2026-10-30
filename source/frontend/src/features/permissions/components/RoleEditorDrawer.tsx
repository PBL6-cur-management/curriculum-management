import { useState } from 'react';
import { LockOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Drawer,
  Flex,
  Segmented,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type { PermissionCode } from '../../../shared/auth/permissions';
import type { PermissionMatrix } from '../api/permissionMatrix';
import {
  CELL_OPTIONS,
  FUNCTION_GROUP_LABELS,
  LOCKED_REASON,
  NO_CELL_LABEL,
  cellKeyOf,
  cellLabel,
} from '../constants/matrixLabels';
import type { CellKey } from '../constants/matrixLabels';
import type { MatrixIndex } from '../hooks/useMatrixIndex';
import { useMatrixMutations } from '../hooks/usePermissionMatrix';

type Role = PermissionMatrix['roles'][number];
type Permission = PermissionMatrix['permissions'][number];

interface RoleEditorDrawerProps {
  role: Role | undefined;
  permissions: Permission[];
  index: MatrixIndex;
  onClose: () => void;
}

const SEGMENT_OPTIONS = [
  ...CELL_OPTIONS.map((option) => ({
    value: option.key as CellKey,
    label: option.short,
    title: option.label,
  })),
  { value: 'none' as CellKey, label: 'Không', title: NO_CELL_LABEL },
];

export function RoleEditorDrawer({
  role,
  permissions,
  index,
  onClose,
}: RoleEditorDrawerProps) {
  const { modal, message } = App.useApp();
  const { token } = theme.useToken();
  const { set, clear } = useMatrixMutations();
  const [pending, setPending] = useState<Map<string, CellKey>>(new Map());
  const [saving, setSaving] = useState(false);

  const roleCode = role?.roleCode ?? '';
  const current = (permission: Permission) =>
    cellKeyOf(index.cell(roleCode, permission.permissionCode));
  const value = (permission: Permission) =>
    pending.get(permission.permissionCode) ?? current(permission);

  function change(permission: Permission, next: CellKey) {
    setPending((previous) => {
      const updated = new Map(previous);
      if (next === current(permission)) updated.delete(permission.permissionCode);
      else updated.set(permission.permissionCode, next);
      return updated;
    });
  }

  function close() {
    setPending(new Map());
    onClose();
  }

  async function apply() {
    const changes = [...pending.entries()];
    const name = (code: string) =>
      permissions.find((item) => item.permissionCode === code)?.permissionName ??
      code;
    modal.confirm({
      title: `Áp dụng ${changes.length} thay đổi cho ${roleCode}?`,
      width: 520,
      okText: 'Áp dụng',
      cancelText: 'Xem lại',
      content: (
        <Flex vertical gap={6} style={{ marginTop: 8 }}>
          {changes.map(([code, next]) => (
            <Typography.Text key={code}>
              {name(code)}:{' '}
              <Typography.Text type="secondary">
                {cellLabel(
                  cellKeyOf(index.cell(roleCode, code)),
                )}
              </Typography.Text>{' '}
              → <Typography.Text strong>{cellLabel(next)}</Typography.Text>
            </Typography.Text>
          ))}
          <Typography.Text type="secondary">
            Thay đổi có hiệu lực ngay với mọi tài khoản giữ vai trò này.
          </Typography.Text>
        </Flex>
      ),
      onOk: async () => {
        setSaving(true);
        try {
          for (const [code, next] of changes) {
            const option = CELL_OPTIONS.find((entry) => entry.key === next);
            const permissionCode = code as PermissionCode;
            if (option)
              await set.mutateAsync({
                roleCode,
                permissionCode,
                body: { mode: option.mode, scope: option.scope },
              });
            else await clear.mutateAsync({ roleCode, permissionCode });
          }
          message.success(`Đã áp dụng ${changes.length} thay đổi cho ${roleCode}`);
          close();
        } finally {
          setSaving(false);
        }
      },
    });
  }

  const groups = [...new Set(permissions.map((item) => item.functionGroup))];

  return (
    <Drawer
      open={Boolean(role)}
      onClose={close}
      size={720}
      title={role ? `Quyền của ${role.roleCode} · ${role.roleName}` : undefined}
      footer={
        <Flex justify="space-between" align="center">
          <Typography.Text type={pending.size ? undefined : 'secondary'}>
            {pending.size
              ? `${pending.size} thay đổi chưa áp dụng`
              : 'Chưa có thay đổi'}
          </Typography.Text>
          <Flex gap={8}>
            <Button onClick={close}>Hủy</Button>
            <Button
              type="primary"
              disabled={!pending.size}
              loading={saving}
              onClick={apply}
            >
              Áp dụng thay đổi
            </Button>
          </Flex>
        </Flex>
      }
    >
      <Flex vertical gap={28}>
        {groups.map((group) => (
          <section key={group}>
            <Typography.Title level={5} style={{ marginBottom: 8 }}>
              {FUNCTION_GROUP_LABELS[group]}
            </Typography.Title>
            {permissions
              .filter((item) => item.functionGroup === group)
              .map((permission) => {
                const locked = index.locked(roleCode, permission.permissionCode);
                const changed = pending.has(permission.permissionCode);
                return (
                  <Flex
                    key={permission.permissionCode}
                    justify="space-between"
                    align="center"
                    gap={16}
                    style={{
                      padding: '10px 12px',
                      borderBottom: `1px solid ${token.colorBorderSecondary}`,
                      background: changed ? token.colorPrimaryBg : undefined,
                      borderRadius: changed ? token.borderRadius : 0,
                    }}
                  >
                    <Flex vertical style={{ minWidth: 0 }}>
                      <Typography.Text>{permission.permissionName}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {permission.permissionCode}
                      </Typography.Text>
                    </Flex>
                    {locked ? (
                      <Tooltip title={LOCKED_REASON}>
                        <Flex align="center" gap={6}>
                          <LockOutlined />
                          <Typography.Text type="secondary">
                            {cellLabel(value(permission))} · đã khóa
                          </Typography.Text>
                        </Flex>
                      </Tooltip>
                    ) : (
                      <Segmented<CellKey>
                        size="small"
                        aria-label={`Quyền ${permission.permissionName}`}
                        options={SEGMENT_OPTIONS}
                        value={value(permission)}
                        onChange={(next) => change(permission, next)}
                      />
                    )}
                  </Flex>
                );
              })}
          </section>
        ))}
      </Flex>
    </Drawer>
  );
}
