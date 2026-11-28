import { useEffect, useMemo, useState } from 'react';
import {
  CopyOutlined,
  LockOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Checkbox,
  Divider,
  Drawer,
  Empty,
  Flex,
  Input,
  Segmented,
  Select,
  Space,
  Tag,
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
type StatusFilter = 'all' | 'granted' | 'ungranted' | 'changed';

interface RoleEditorDrawerProps {
  role: Role | undefined;
  roles?: Role[];
  permissions: Permission[];
  index: MatrixIndex;
  initialTemplateRoleCode?: string;
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

const BULK_ACTIONS: readonly { key: CellKey; label: string }[] = [
  { key: 'X', label: 'Toàn bộ' },
  { key: 'P', label: 'Phạm vi' },
  { key: 'D', label: 'Đề xuất' },
  { key: 'DP', label: 'ĐX · phạm vi' },
  { key: 'none', label: 'Bỏ quyền' },
];

export function RoleEditorDrawer({
  role,
  roles = [],
  permissions,
  index,
  initialTemplateRoleCode,
  onClose,
}: RoleEditorDrawerProps) {
  const { modal, message } = App.useApp();
  const { token } = theme.useToken();
  const { set, clear } = useMatrixMutations();
  const [pending, setPending] = useState<Map<string, CellKey>>(new Map());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  const roleCode = role?.roleCode ?? '';
  const current = (permission: Permission) =>
    cellKeyOf(index.cell(roleCode, permission.permissionCode));
  const value = (permission: Permission) =>
    pending.get(permission.permissionCode) ?? current(permission);

  // Pre-fill from template role when opening immediately after role creation.
  useEffect(() => {
    if (!role || !initialTemplateRoleCode) return;
    const nextMap = new Map<string, CellKey>();
    for (const permission of permissions) {
      if (index.locked(role.roleCode, permission.permissionCode)) continue;
      const tplKey = cellKeyOf(
        index.cell(initialTemplateRoleCode, permission.permissionCode),
      );
      const curKey = cellKeyOf(
        index.cell(role.roleCode, permission.permissionCode),
      );
      if (tplKey !== curKey) {
        nextMap.set(permission.permissionCode, tplKey);
      }
    }
    setPending(nextMap);
  }, [role, initialTemplateRoleCode, permissions, index]);

  function change(permission: Permission, next: CellKey) {
    if (index.locked(roleCode, permission.permissionCode)) return;
    setPending((previous) => {
      const updated = new Map(previous);
      if (next === current(permission))
        updated.delete(permission.permissionCode);
      else updated.set(permission.permissionCode, next);
      return updated;
    });
  }

  function applyBulkTo(targets: Permission[], next: CellKey) {
    const editableTargets = targets.filter(
      (p) => !index.locked(roleCode, p.permissionCode),
    );
    if (!editableTargets.length) return;
    setPending((previous) => {
      const updated = new Map(previous);
      for (const permission of editableTargets) {
        if (next === current(permission)) {
          updated.delete(permission.permissionCode);
        } else {
          updated.set(permission.permissionCode, next);
        }
      }
      return updated;
    });
  }

  function copyFromRole(sourceRoleCode: string) {
    let changedCount = 0;
    setPending((previous) => {
      const updated = new Map(previous);
      for (const permission of permissions) {
        if (index.locked(roleCode, permission.permissionCode)) continue;
        const sourceKey = cellKeyOf(
          index.cell(sourceRoleCode, permission.permissionCode),
        );
        if (sourceKey === current(permission)) {
          updated.delete(permission.permissionCode);
        } else {
          updated.set(permission.permissionCode, sourceKey);
          changedCount++;
        }
      }
      return updated;
    });
    void message.info(
      changedCount > 0
        ? `Đã nạp bộ quyền mẫu từ ${sourceRoleCode} (${changedCount} quyền thay đổi — bấm Áp dụng để lưu).`
        : `Vai trò này đã có bộ quyền giống ${sourceRoleCode}.`,
    );
  }

  function close() {
    setPending(new Map());
    setSelectedCodes(new Set());
    setSearch('');
    setGroupFilter(undefined);
    setStatusFilter('all');
    onClose();
  }

  const allGroups = useMemo(
    () => [...new Set(permissions.map((item) => item.functionGroup))],
    [permissions],
  );

  const visiblePermissions = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('vi');
    return permissions.filter((permission) => {
      if (groupFilter && permission.functionGroup !== groupFilter) return false;
      if (
        term &&
        !permission.permissionName.toLocaleLowerCase('vi').includes(term) &&
        !permission.permissionCode.toLowerCase().includes(term)
      ) {
        return false;
      }
      const val = pending.get(permission.permissionCode) ??
        cellKeyOf(index.cell(roleCode, permission.permissionCode));
      if (statusFilter === 'granted' && val === 'none') return false;
      if (statusFilter === 'ungranted' && val !== 'none') return false;
      if (statusFilter === 'changed' && !pending.has(permission.permissionCode))
        return false;
      return true;
    });
  }, [permissions, groupFilter, search, statusFilter, pending, index, roleCode]);

  const visibleGroups = useMemo(
    () => [...new Set(visiblePermissions.map((item) => item.functionGroup))],
    [visiblePermissions],
  );

  const editableVisible = useMemo(
    () =>
      visiblePermissions.filter(
        (p) => !index.locked(roleCode, p.permissionCode),
      ),
    [visiblePermissions, index, roleCode],
  );

  const selectedVisibleCount = editableVisible.filter((p) =>
    selectedCodes.has(p.permissionCode),
  ).length;
  const allVisibleSelected =
    editableVisible.length > 0 &&
    selectedVisibleCount === editableVisible.length;
  const someVisibleSelected =
    selectedVisibleCount > 0 && selectedVisibleCount < editableVisible.length;

  const grantedTotal = useMemo(
    () =>
      permissions.filter((p) => {
        const v =
          pending.get(p.permissionCode) ??
          cellKeyOf(index.cell(roleCode, p.permissionCode));
        return v !== 'none';
      }).length,
    [permissions, pending, index, roleCode],
  );

  function toggleSelectAllVisible(checked: boolean) {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      for (const p of editableVisible) {
        if (checked) next.add(p.permissionCode);
        else next.delete(p.permissionCode);
      }
      return next;
    });
  }

  function toggleSelectGroup(groupItems: Permission[], checked: boolean) {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      for (const p of groupItems) {
        if (index.locked(roleCode, p.permissionCode)) continue;
        if (checked) next.add(p.permissionCode);
        else next.delete(p.permissionCode);
      }
      return next;
    });
  }

  function toggleSelectOne(code: string, checked: boolean) {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
  }

  const bulkTargets = useMemo(() => {
    if (selectedCodes.size > 0) {
      return permissions.filter((p) => selectedCodes.has(p.permissionCode));
    }
    return editableVisible;
  }, [selectedCodes, permissions, editableVisible]);

  async function apply() {
    const changes = [...pending.entries()];
    const name = (code: string) =>
      permissions.find((item) => item.permissionCode === code)
        ?.permissionName ?? code;
    modal.confirm({
      title: `Áp dụng ${changes.length} thay đổi cho ${roleCode}?`,
      width: 560,
      okText: 'Áp dụng',
      cancelText: 'Xem lại',
      content: (
        <Flex vertical gap={8} style={{ marginTop: 8 }}>
          <Flex
            vertical
            gap={6}
            style={{ maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}
          >
            {changes.map(([code, next]) => (
              <Typography.Text key={code}>
                {name(code)}:{' '}
                <Typography.Text type="secondary">
                  {cellLabel(cellKeyOf(index.cell(roleCode, code)))}
                </Typography.Text>{' '}
                → <Typography.Text strong>{cellLabel(next)}</Typography.Text>
              </Typography.Text>
            ))}
          </Flex>
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
          message.success(
            `Đã áp dụng ${changes.length} thay đổi cho ${roleCode}`,
          );
          close();
        } finally {
          setSaving(false);
        }
      },
    });
  }

  const otherRoles = roles.filter((r) => r.roleCode !== roleCode);

  return (
    <Drawer
      open={Boolean(role)}
      onClose={close}
      size={860}
      title={
        role ? (
          <Flex align="center" gap={10} wrap>
            <span>
              Quyền của {role.roleCode} · {role.roleName}
            </span>
            <Tag color="blue">
              Đang cấp {grantedTotal}/{permissions.length}
            </Tag>
          </Flex>
        ) : undefined
      }
      footer={
        <Flex justify="space-between" align="center" wrap gap={8}>
          <Space size="middle">
            <Typography.Text type={pending.size ? undefined : 'secondary'}>
              {pending.size
                ? `${pending.size} thay đổi chưa áp dụng`
                : 'Chưa có thay đổi'}
            </Typography.Text>
            {pending.size > 0 && (
              <Button
                size="small"
                icon={<UndoOutlined />}
                onClick={() => setPending(new Map())}
              >
                Hoàn tác
              </Button>
            )}
          </Space>
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
      <Flex vertical gap={16}>
        {/* Sticky filter & bulk toolbar */}
        <Flex
          vertical
          gap={10}
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            background: token.colorBgElevated,
            padding: '12px 14px',
            borderRadius: token.borderRadiusLG,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Flex gap={8} wrap align="center">
            <Input.Search
              allowClear
              placeholder="Tìm nhanh theo tên hoặc mã quyền..."
              aria-label="Tìm quyền trong ngăn chỉnh sửa"
              style={{ flex: '1 1 240px', minWidth: 200 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              allowClear
              placeholder="Tất cả nhóm chức năng"
              aria-label="Lọc theo nhóm chức năng"
              style={{ width: 200 }}
              value={groupFilter}
              onChange={setGroupFilter}
              options={allGroups.map((g) => ({
                value: g,
                label: FUNCTION_GROUP_LABELS[g],
              }))}
            />
            <Select<StatusFilter>
              aria-label="Lọc theo trạng thái quyền"
              style={{ width: 155 }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'Tất cả quyền' },
                { value: 'granted', label: 'Đang cấp' },
                { value: 'ungranted', label: 'Chưa cấp' },
                { value: 'changed', label: `Đã sửa (${pending.size})` },
              ]}
            />
          </Flex>

          <Flex justify="space-between" align="center" wrap gap={8}>
            <Space size="small" wrap>
              <Checkbox
                checked={allVisibleSelected}
                indeterminate={someVisibleSelected}
                disabled={editableVisible.length === 0}
                onChange={(e) => toggleSelectAllVisible(e.target.checked)}
              >
                {selectedCodes.size > 0
                  ? `Đã chọn ${selectedCodes.size} quyền`
                  : `Chọn tất cả (${editableVisible.length})`}
              </Checkbox>
              {selectedCodes.size > 0 && (
                <Button
                  type="link"
                  size="small"
                  style={{ paddingInline: 4 }}
                  onClick={() => setSelectedCodes(new Set())}
                >
                  Bỏ chọn
                </Button>
              )}
              <Divider orientation="vertical" style={{ marginInline: 2 }} />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {selectedCodes.size > 0
                  ? `Áp cho ${selectedCodes.size} quyền đã chọn:`
                  : `Áp cho ${editableVisible.length} quyền đang hiện:`}
              </Typography.Text>
              {BULK_ACTIONS.map((action) => (
                <Button
                  key={action.key}
                  size="small"
                  danger={action.key === 'none'}
                  disabled={bulkTargets.length === 0}
                  onClick={() => applyBulkTo(bulkTargets, action.key)}
                >
                  {action.label}
                </Button>
              ))}
            </Space>

            {otherRoles.length > 0 && (
              <Select
                size="small"
                style={{ width: 210 }}
                placeholder={
                  <Space size={4}>
                    <CopyOutlined />
                    <span>Sao chép quyền từ...</span>
                  </Space>
                }
                aria-label="Sao chép quyền từ vai trò khác"
                value={null}
                onChange={(sourceCode) => {
                  if (sourceCode) copyFromRole(sourceCode);
                }}
                options={otherRoles.map((r) => ({
                  value: r.roleCode,
                  label: `${r.roleCode} — ${r.roleName}`,
                }))}
              />
            )}
          </Flex>
        </Flex>

        {visibleGroups.length === 0 ? (
          <Empty
            description="Không có quyền nào khớp bộ lọc hiện tại"
            style={{ paddingBlock: 32 }}
          >
            <Button
              onClick={() => {
                setSearch('');
                setGroupFilter(undefined);
                setStatusFilter('all');
              }}
            >
              Xóa bộ lọc
            </Button>
          </Empty>
        ) : (
          <Flex vertical gap={22}>
            {visibleGroups.map((group) => {
              const groupItems = visiblePermissions.filter(
                (item) => item.functionGroup === group,
              );
              const editableGroupItems = groupItems.filter(
                (item) => !index.locked(roleCode, item.permissionCode),
              );
              const selectedInGroup = editableGroupItems.filter((item) =>
                selectedCodes.has(item.permissionCode),
              ).length;
              const grantedInGroup = groupItems.filter(
                (item) => value(item) !== 'none',
              ).length;

              return (
                <section key={group}>
                  <Flex
                    justify="space-between"
                    align="center"
                    wrap
                    gap={8}
                    style={{
                      marginBottom: 6,
                      paddingBottom: 6,
                      borderBottom: `1px solid ${token.colorBorder}`,
                    }}
                  >
                    <Space size={8}>
                      <Checkbox
                        aria-label={`Chọn nhóm ${FUNCTION_GROUP_LABELS[group]}`}
                        disabled={editableGroupItems.length === 0}
                        checked={
                          editableGroupItems.length > 0 &&
                          selectedInGroup === editableGroupItems.length
                        }
                        indeterminate={
                          selectedInGroup > 0 &&
                          selectedInGroup < editableGroupItems.length
                        }
                        onChange={(e) =>
                          toggleSelectGroup(groupItems, e.target.checked)
                        }
                      />
                      <Typography.Title level={5} style={{ margin: 0 }}>
                        {FUNCTION_GROUP_LABELS[group]}
                      </Typography.Title>
                      <Tag style={{ marginInlineEnd: 0 }}>
                        {grantedInGroup}/{groupItems.length}
                      </Tag>
                    </Space>
                    {editableGroupItems.length > 0 && (
                      <Space size={4}>
                        <Typography.Text
                          type="secondary"
                          style={{ fontSize: 12 }}
                        >
                          Cả nhóm:
                        </Typography.Text>
                        <Button
                          type="link"
                          size="small"
                          style={{ paddingInline: 4 }}
                          onClick={() => applyBulkTo(editableGroupItems, 'X')}
                        >
                          Toàn bộ
                        </Button>
                        <Button
                          type="link"
                          size="small"
                          style={{ paddingInline: 4 }}
                          onClick={() => applyBulkTo(editableGroupItems, 'P')}
                        >
                          Phạm vi
                        </Button>
                        <Button
                          type="link"
                          size="small"
                          danger
                          style={{ paddingInline: 4 }}
                          onClick={() =>
                            applyBulkTo(editableGroupItems, 'none')
                          }
                        >
                          Bỏ hết
                        </Button>
                      </Space>
                    )}
                  </Flex>

                  {groupItems.map((permission) => {
                    const locked = index.locked(
                      roleCode,
                      permission.permissionCode,
                    );
                    const changed = pending.has(permission.permissionCode);
                    const checked = selectedCodes.has(
                      permission.permissionCode,
                    );
                    return (
                      <Flex
                        key={permission.permissionCode}
                        justify="space-between"
                        align="center"
                        gap={12}
                        style={{
                          padding: '9px 10px',
                          borderBottom: `1px solid ${token.colorBorderSecondary}`,
                          background: changed
                            ? token.colorPrimaryBg
                            : checked
                              ? token.colorFillAlter
                              : undefined,
                          borderRadius: changed ? token.borderRadius : 0,
                        }}
                      >
                        <Flex align="center" gap={10} style={{ minWidth: 0 }}>
                          <Checkbox
                            aria-label={`Chọn quyền ${permission.permissionName}`}
                            disabled={locked}
                            checked={checked}
                            onChange={(e) =>
                              toggleSelectOne(
                                permission.permissionCode,
                                e.target.checked,
                              )
                            }
                          />
                          <Flex vertical style={{ minWidth: 0 }}>
                            <Typography.Text strong={changed}>
                              {permission.permissionName}
                            </Typography.Text>
                            <Typography.Text
                              type="secondary"
                              style={{ fontSize: 12 }}
                            >
                              {permission.permissionCode}
                            </Typography.Text>
                          </Flex>
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
              );
            })}
          </Flex>
        )}
      </Flex>
    </Drawer>
  );
}
