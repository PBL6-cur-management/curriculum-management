import { App, Form, Input, Modal, Select } from 'antd';
import { useEffect } from 'react';
import {
  applyFieldErrors,
  errorMessage,
} from '../../../shared/forms/applyFieldErrors';
import { OrgUnitSelect } from '../../../shared/org-units/OrgUnitSelect';
import type { CreateMajorRequest, MajorItem } from '../api/majors';
import {
  DEGREE_GROUP_OPTIONS,
  FACULTY_UNIT_TYPES,
} from '../constants/majorLabels';
import { useCreateMajor, useUpdateMajor } from '../hooks/useMajors';
import { MAJOR_CODE_RULES, MAJOR_NAME_RULES } from '../schema/majorRules';

interface MajorFormModalProps {
  open: boolean;
  editing: MajorItem | null;
  onClose: () => void;
}

export function MajorFormModal({
  open,
  editing,
  onClose,
}: MajorFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<CreateMajorRequest>();
  const createMutation = useCreateMajor();
  const updateMutation = useUpdateMajor();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.setFieldsValue({
        majorCode: editing.majorCode,
        majorName: editing.majorName,
        englishName: editing.englishName ?? '',
        degreeGroup: editing.degreeGroup ?? undefined,
        facultyId: editing.faculty?.id ?? undefined,
      });
    } else {
      form.resetFields();
    }
  }, [open, editing, form]);

  const handleSave = (values: CreateMajorRequest) => {
    const onSuccess = () => {
      void message.success(
        editing ? 'Đã cập nhật ngành đào tạo.' : 'Đã thêm ngành đào tạo mới.',
      );
      form.resetFields();
      onClose();
    };
    const onError = (err: unknown) => {
      if (!applyFieldErrors(form, err)) {
        void message.error(errorMessage(err, 'Không lưu được ngành đào tạo.'));
      }
    };

    if (editing) {
      updateMutation.mutate(
        {
          majorId: editing.id,
          body: {
            majorName: values.majorName,
            englishName: values.englishName || null,
            degreeGroup: values.degreeGroup ?? null,
            facultyId: values.facultyId ?? null,
          },
        },
        { onSuccess, onError },
      );
      return;
    }

    createMutation.mutate(
      {
        ...values,
        englishName: values.englishName || null,
        degreeGroup: values.degreeGroup ?? null,
        facultyId: values.facultyId ?? null,
      },
      { onSuccess, onError },
    );
  };

  return (
    <Modal
      open={open}
      title={
        editing
          ? `Cập nhật ngành ${editing.majorCode}`
          : 'Thêm ngành đào tạo mới'
      }
      okText={editing ? 'Lưu thay đổi' : 'Tạo ngành'}
      cancelText="Hủy"
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={isSaving}
    >
      <Form<CreateMajorRequest>
        form={form}
        layout="vertical"
        onFinish={handleSave}
      >
        <Form.Item
          name="majorCode"
          label="Mã ngành quốc gia"
          rules={MAJOR_CODE_RULES}
        >
          <Input disabled={Boolean(editing)} placeholder="Ví dụ: 7480201" />
        </Form.Item>
        <Form.Item
          name="majorName"
          label="Tên ngành (tiếng Việt)"
          rules={MAJOR_NAME_RULES}
        >
          <Input placeholder="Ví dụ: Công nghệ Thông tin" />
        </Form.Item>
        <Form.Item name="englishName" label="Tên ngành (tiếng Anh)">
          <Input placeholder="Ví dụ: Information Technology" />
        </Form.Item>
        <Form.Item name="degreeGroup" label="Bậc đào tạo">
          <Select allowClear options={DEGREE_GROUP_OPTIONS} />
        </Form.Item>
        <Form.Item name="facultyId" label="Khoa phụ trách">
          <OrgUnitSelect
            types={FACULTY_UNIT_TYPES}
            placeholder="Chọn khoa phụ trách"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
