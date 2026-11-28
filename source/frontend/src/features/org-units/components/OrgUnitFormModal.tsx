import { App, Checkbox, Form, Input, Modal, Radio } from 'antd';
import { useEffect } from 'react';
import { ApiError } from '../../../shared/api/client';
import { OrgUnitSelect } from '../../../shared/org-units/OrgUnitSelect';
import type { OrgUnit } from '../../../shared/org-units/orgUnits';
import { useCreateOrgUnit, useUpdateOrgUnit } from '../hooks/useOrgUnitAdmin';
import {
  ALLOWED_PARENT_TYPES,
  CREATABLE_UNIT_TYPES,
  EXTERNAL_UNIT_CHECKBOX_LABEL,
  UNIT_TYPE_LABELS,
} from '../constants/orgUnitLabels';
import { UNIT_CODE_RULES, UNIT_NAME_RULES } from '../schema/orgUnitRules';

interface OrgUnitFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  parent?: OrgUnit;
  unit?: OrgUnit;
  onClose: () => void;
}
export function OrgUnitFormModal({
  open,
  mode,
  parent,
  unit,
  onClose,
}: OrgUnitFormModalProps) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const create = useCreateOrgUnit();
  const update = useUpdateOrgUnit();
  const unitType = Form.useWatch('unitType', form) as
    | OrgUnit['unitType']
    | undefined;
  useEffect(() => {
    if (open)
      form.setFieldsValue({
        unitCode: unit?.unitCode,
        unitName: unit?.unitName,
        unitType: unit?.unitType ?? 'FACULTY',
        isExternal: Boolean(unit?.isExternal),
        parentUnitId: parent?.id ?? unit?.parentUnitId,
      });
    else form.resetFields();
  }, [form, open, parent, unit]);
  async function submit(values: {
    unitCode?: string;
    unitName: string;
    unitType?: 'FACULTY' | 'OFFICE';
    isExternal?: boolean;
    parentUnitId?: string;
  }) {
    try {
      if (mode === 'create')
        await create.mutateAsync({
          unitCode: values.unitCode ?? '',
          unitName: values.unitName,
          unitType: values.unitType ?? 'FACULTY',
          isExternal: Boolean(values.isExternal),
          parentUnitId: values.parentUnitId ?? parent?.id ?? '',
        });
      else
        await update.mutateAsync({
          unitId: unit?.id ?? '',
          body: {
            unitName: values.unitName,
            ...(unit?.unitType !== 'UNIVERSITY'
              ? { isExternal: Boolean(values.isExternal) }
              : {}),
            ...(values.parentUnitId
              ? { parentUnitId: values.parentUnitId }
              : {}),
          },
        });
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'UNIT_CODE_TAKEN')
        form.setFields([{ name: 'unitCode', errors: [error.message] }]);
      else
        message.error(
          error instanceof Error ? error.message : 'Không thể lưu đơn vị',
        );
    }
  }
  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Thêm đơn vị' : 'Sửa đơn vị'}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={create.isPending || update.isPending}
    >
      <Form form={form} layout="vertical" onFinish={submit}>
        {mode === 'create' ? (
          <Form.Item name="unitCode" label="Mã đơn vị" rules={UNIT_CODE_RULES}>
            <Input />
          </Form.Item>
        ) : (
          <Form.Item label="Mã đơn vị">
            <Input value={unit?.unitCode} disabled />
          </Form.Item>
        )}
        <Form.Item name="unitName" label="Tên đơn vị" rules={UNIT_NAME_RULES}>
          <Input />
        </Form.Item>
        {mode === 'create' ? (
          <Form.Item name="unitType" label="Loại đơn vị">
            <Radio.Group
              options={CREATABLE_UNIT_TYPES.map((value) => ({
                value,
                label: UNIT_TYPE_LABELS[value],
              }))}
            />
          </Form.Item>
        ) : (
          <Form.Item label="Loại đơn vị">
            <Input
              value={UNIT_TYPE_LABELS[unit?.unitType ?? 'UNIVERSITY']}
              disabled
            />
          </Form.Item>
        )}
        {(mode === 'create' || unit?.unitType !== 'UNIVERSITY') && (
          <Form.Item name="isExternal" valuePropName="checked">
            <Checkbox>{EXTERNAL_UNIT_CHECKBOX_LABEL}</Checkbox>
          </Form.Item>
        )}
        {(mode === 'create' || Boolean(unit?.parentUnitId)) && (
          <Form.Item
            name="parentUnitId"
            label="Đơn vị cấp trên"
            rules={[{ required: true, message: 'Chọn đơn vị cấp trên' }]}
          >
            <OrgUnitSelect
              types={
                ALLOWED_PARENT_TYPES[unit?.unitType ?? unitType ?? 'FACULTY']
              }
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
