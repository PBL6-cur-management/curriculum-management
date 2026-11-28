import { Alert, App, DatePicker, Form, Modal, Radio, Select } from 'antd';
import dayjs from 'dayjs';
import { ApiError } from '../../../shared/api/client';
import { OrgUnitSelect } from '../../../shared/org-units/OrgUnitSelect';
import { ISO_DAY_FORMAT } from '../../../shared/validity/validity';
import { useAssignRole, useRoles } from '../hooks/useRoleAssignments';

interface AssignRoleModalProps {
  userId: string;
  open: boolean;
  onClose: () => void;
}

export function AssignRoleModal({
  userId,
  open,
  onClose,
}: AssignRoleModalProps) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { data: roles = [] } = useRoles();
  const assign = useAssignRole(userId);
  const scopeType = Form.useWatch('scopeType', form);
  async function submit(values: {
    roleId: string;
    scopeType: 'SYSTEM' | 'UNIT';
    scopeUnitId?: string;
    validFrom: dayjs.Dayjs;
    validTo?: dayjs.Dayjs;
  }) {
    try {
      await assign.mutateAsync({
        roleId: values.roleId,
        scopeType: values.scopeType,
        ...(values.scopeUnitId ? { scopeUnitId: values.scopeUnitId } : {}),
        validFrom: values.validFrom.format(ISO_DAY_FORMAT),
        ...(values.validTo
          ? { validTo: values.validTo.format(ISO_DAY_FORMAT) }
          : {}),
      });
      form.resetFields();
      onClose();
    } catch (error) {
      if (error instanceof ApiError) message.error(error.message);
    }
  }
  return (
    <Modal
      open={open}
      title="Gán vai trò"
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={assign.isPending}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="Chỉ hiển thị vai trò gán trực tiếp (R1, R2 và vai trò tùy biến)"
        description="Các vai trò theo phân công (Giám đốc CTĐT R3, Điều phối R4, Giảng viên R5, Sinh viên R6) được cấp tự động tại màn hình Chương trình đào tạo, Nhóm chuyên môn hoặc Hồ sơ sinh viên."
      />
      <Form
        form={form}
        layout="vertical"
        onFinish={submit}
        initialValues={{ scopeType: 'SYSTEM', validFrom: dayjs() }}
      >
        <Form.Item
          name="roleId"
          label="Vai trò"
          rules={[{ required: true, message: 'Chọn vai trò' }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Chọn vai trò cần gán"
            options={roles
              .filter((role) => role.assignable)
              .map((role) => ({
                value: role.id,
                label: `${role.roleCode} — ${role.roleName}`,
              }))}
          />
        </Form.Item>
        <Form.Item name="scopeType" label="Phạm vi">
          <Radio.Group
            options={[
              { value: 'SYSTEM', label: 'Toàn hệ thống' },
              { value: 'UNIT', label: 'Đơn vị' },
            ]}
          />
        </Form.Item>
        {scopeType === 'UNIT' && (
          <Form.Item
            name="scopeUnitId"
            label="Đơn vị"
            rules={[{ required: true, message: 'Chọn đơn vị' }]}
          >
            <OrgUnitSelect />
          </Form.Item>
        )}
        <Form.Item
          name="validFrom"
          label="Có hiệu lực từ"
          rules={[{ required: true }]}
        >
          <DatePicker />
        </Form.Item>
        <Form.Item
          name="validTo"
          label="Có hiệu lực đến"
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                return !value ||
                  !getFieldValue('validFrom') ||
                  value.isSameOrAfter(getFieldValue('validFrom'), 'day')
                  ? Promise.resolve()
                  : Promise.reject(
                      new Error('Ngày kết thúc không trước ngày bắt đầu'),
                    );
              },
            }),
          ]}
        >
          <DatePicker />
        </Form.Item>
      </Form>
    </Modal>
  );
}
