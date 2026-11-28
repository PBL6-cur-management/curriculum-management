import { App, Button, Card, Descriptions, Space, Tag } from 'antd';
import { ApiError } from '../../../shared/api/client';
import { useOrgUnits } from '../../../shared/org-units/useOrgUnits';
import type { OrgUnit } from '../../../shared/org-units/orgUnits';
import {
  useActivateOrgUnit,
  useDeactivateOrgUnit,
} from '../hooks/useOrgUnitAdmin';
import {
  ALLOWED_PARENT_TYPES,
  EXTERNAL_UNIT_TAG_LABEL,
  UNIT_STATUS_LABELS,
  UNIT_TYPE_LABELS,
} from '../constants/orgUnitLabels';

interface OrgUnitDetailPanelProps {
  unit: OrgUnit;
  onEdit: (unit: OrgUnit) => void;
  onAddChild: (parent: OrgUnit) => void;
}
export function OrgUnitDetailPanel({
  unit,
  onEdit,
  onAddChild,
}: OrgUnitDetailPanelProps) {
  const { modal, message } = App.useApp();
  const { data = [] } = useOrgUnits();
  const deactivate = useDeactivateOrgUnit();
  const activate = useActivateOrgUnit();
  const parent = data.find((candidate) => candidate.id === unit.parentUnitId);
  async function changeStatus() {
    try {
      if (unit.status === 'ACTIVE') await deactivate.mutateAsync(unit.id);
      else await activate.mutateAsync(unit.id);
    } catch (error) {
      message.error(
        error instanceof ApiError ? error.message : 'Không thể cập nhật đơn vị',
      );
    }
  }
  function confirmDeactivate() {
    modal.confirm({
      title: 'Ngừng hoạt động đơn vị?',
      content: 'Đơn vị không bị xóa.',
      okText: 'Ngừng hoạt động',
      okButtonProps: { danger: true },
      onOk: changeStatus,
    });
  }
  return (
    <Card
      title={unit.unitName}
      extra={
        unit.isExternal ? (
          <Tag color="orange">{EXTERNAL_UNIT_TAG_LABEL}</Tag>
        ) : undefined
      }
    >
      <Descriptions
        column={1}
        items={[
          { key: 'code', label: 'Mã đơn vị', children: unit.unitCode },
          {
            key: 'type',
            label: 'Loại',
            children: UNIT_TYPE_LABELS[unit.unitType],
          },
          {
            key: 'scope',
            label: 'Phạm vi',
            children: unit.isExternal ? (
              <Tag color="orange">{EXTERNAL_UNIT_TAG_LABEL}</Tag>
            ) : (
              'Nội bộ trường'
            ),
          },
          {
            key: 'status',
            label: 'Trạng thái',
            children: <Tag>{UNIT_STATUS_LABELS[unit.status]}</Tag>,
          },
          {
            key: 'parent',
            label: 'Đơn vị cấp trên',
            children: parent?.unitName ?? '—',
          },
        ]}
      />
      <Space wrap>
        <Button onClick={() => onEdit(unit)}>Sửa</Button>
        {unit.status === 'ACTIVE' &&
          Object.values(ALLOWED_PARENT_TYPES).some((types) =>
            types.includes(unit.unitType),
          ) && (
            <Button onClick={() => onAddChild(unit)}>Thêm đơn vị con</Button>
          )}
        {unit.status === 'ACTIVE' && unit.unitType !== 'UNIVERSITY' && (
          <Button danger onClick={confirmDeactivate}>
            Ngừng hoạt động
          </Button>
        )}
        {unit.status === 'INACTIVE' && (
          <Button onClick={() => void changeStatus()}>Kích hoạt lại</Button>
        )}
      </Space>
    </Card>
  );
}
