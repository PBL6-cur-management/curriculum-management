import { useState } from 'react';
import { Alert, App, Form, Input, Modal } from 'antd';
import {
  applyFieldErrors,
  errorMessage,
} from '../../../shared/forms/applyFieldErrors';
import type { Role } from '../api/permissionMatrix';
import {
  useCreateRole,
  useUpdateRole,
} from '../hooks/usePermissionMatrix';
import {
  ROLE_CODE_RULES,
  ROLE_DESCRIPTION_RULES,
  ROLE_NAME_RULES,
} from '../schema/roleRules';

interface RoleFormModalProps {
  open: boolean;
  role: Role | null;
  onClose: () => void;
}

interface RoleFormValues {
  roleCode: string;
  roleName: string;
  description?: string;
}

export function RoleFormModal({ open, role, onClose }: RoleFormModalProps) {
  const [form] = Form.useForm<RoleFormValues>();
  const { message } = App.useApp();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = role !== null;
  const pending = createRole.isPending || updateRole.isPending;

  return (
    <Modal
      open={open}
      title={isEdit ? `Sửa thông tin vai trò ${role.roleCode}` : 'Tạo vai trò mới'}
      okText={isEdit ? 'Lưu thay đổi' : 'Tạo vai trò'}
      cancelText="Hủy"
      confirmLoading={pending}
      onCancel={() => {
        if (!pending) onClose();
      }}
      onOk={() => form.submit()}
    >
      {serverError && (
        <Alert
          type="error"
          showIcon
          title={serverError}
          style={{ marginBottom: 16 }}
        />
      )}
      <Form
        form={form}
        layout="vertical"
        disabled={pending}
        initialValues={{
          roleCode: role?.roleCode ?? '',
          roleName: role?.roleName ?? '',
          description: role?.description ?? '',
        }}
        onValuesChange={() => setServerError(null)}
        onFinish={async (values) => {
          const roleName = values.roleName.trim();
          const description = values.description?.trim() || null;
          try {
            if (isEdit) {
              const updated = await updateRole.mutateAsync({
                roleCode: role.roleCode,
                body: { roleName, description },
              });
              void message.success(`Đã cập nhật vai trò ${updated.roleCode}`);
            } else {
              const created = await createRole.mutateAsync({
                roleCode: values.roleCode.trim().toUpperCase(),
                roleName,
                description,
              });
              void message.success(`Đã tạo vai trò ${created.roleCode}`);
            }
            onClose();
          } catch (error) {
            if (!applyFieldErrors(form, error)) {
              setServerError(
                errorMessage(
                  error,
                  isEdit
                    ? 'Không cập nhật được thông tin vai trò.'
                    : 'Không tạo được vai trò mới.',
                ),
              );
            }
          }
        }}
      >
        <Form.Item
          name="roleCode"
          label="Mã vai trò"
          normalize={(value: unknown) =>
            typeof value === 'string' ? value.toUpperCase() : value
          }
          rules={isEdit ? undefined : ROLE_CODE_RULES}
          extra={
            isEdit
              ? 'Mã vai trò không thể thay đổi sau khi tạo.'
              : 'Ví dụ: CVHT, TRO_LY_KHOA (chữ in hoa, chữ số, dấu gạch dưới).'
          }
        >
          <Input disabled={isEdit} placeholder="VD: CVHT" />
        </Form.Item>
        <Form.Item
          name="roleName"
          label="Tên vai trò"
          rules={ROLE_NAME_RULES}
        >
          <Input placeholder="VD: Cố vấn học tập" />
        </Form.Item>
        <Form.Item
          name="description"
          label="Mô tả"
          rules={ROLE_DESCRIPTION_RULES}
        >
          <Input.TextArea
            rows={3}
            placeholder="Mô tả chức năng hoặc đối tượng gán vai trò này"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
