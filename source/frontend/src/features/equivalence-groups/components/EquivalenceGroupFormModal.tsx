import { Alert, Form, Input, Modal } from 'antd';
import { useState } from 'react';
import { CourseMultiSelect } from '../../../shared/courses/CourseSelect';
import {
  applyFieldErrors,
  errorMessage,
} from '../../../shared/forms/applyFieldErrors';
import type { EquivalenceGroup } from '../api/equivalenceGroups';
import {
  useCreateEquivalenceGroup,
  useUpdateEquivalenceGroup,
} from '../hooks/useEquivalenceGroups';
import { EQUIVALENCE_GROUP_RULES } from '../schema/equivalenceGroupRules';

interface EquivalenceGroupFormModalProps {
  // Undefined creates a group; a group edits its code and note (members change through their own actions).
  group?: EquivalenceGroup;
  onClose: () => void;
}

interface FormValues {
  groupCode: string;
  note?: string;
  courseIds?: string[];
}

export function EquivalenceGroupFormModal({
  group,
  onClose,
}: EquivalenceGroupFormModalProps) {
  const [form] = Form.useForm<FormValues>();
  const create = useCreateEquivalenceGroup();
  const update = useUpdateEquivalenceGroup();
  const [serverError, setServerError] = useState<string | null>(null);

  const fail = (error: unknown) => {
    if (!applyFieldErrors(form, error))
      setServerError(errorMessage(error, 'Không lưu được nhóm tương đương.'));
  };
  const onFinish = (values: FormValues) => {
    setServerError(null);
    if (group)
      update.mutate(
        {
          groupId: group.id,
          body: { groupCode: values.groupCode, note: values.note ?? null },
        },
        { onSuccess: onClose, onError: fail },
      );
    else
      create.mutate(
        {
          groupCode: values.groupCode,
          note: values.note ?? null,
          courseIds: values.courseIds ?? [],
        },
        { onSuccess: onClose, onError: fail },
      );
  };

  return (
    <Modal
      open
      title={group ? `Sửa nhóm ${group.groupCode}` : 'Tạo nhóm tương đương'}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={create.isPending || update.isPending}
      okText="Lưu"
      cancelText="Hủy"
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
        onFinish={onFinish}
        initialValues={{ groupCode: group?.groupCode, note: group?.note }}
      >
        <Form.Item
          name="groupCode"
          label="Mã nhóm"
          rules={EQUIVALENCE_GROUP_RULES.groupCode}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="note"
          label="Ghi chú"
          rules={EQUIVALENCE_GROUP_RULES.note}
        >
          <Input.TextArea rows={2} />
        </Form.Item>
        {!group && (
          <Form.Item
            name="courseIds"
            label="Học phần trong nhóm"
            rules={EQUIVALENCE_GROUP_RULES.courseIds}
          >
            <CourseMultiSelect />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
