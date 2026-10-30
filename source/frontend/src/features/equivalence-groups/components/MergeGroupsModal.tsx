import { Alert, Form, Modal, Radio, Select, Typography } from 'antd';
import { useState } from 'react';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { EquivalenceGroup } from '../api/equivalenceGroups';
import {
  useEquivalenceGroupList,
  useMergeEquivalenceGroups,
} from '../hooks/useEquivalenceGroups';
import type { OtherGroupRef } from './AddMemberModal';

export const MERGE_CONFIRM_TEXT =
  'Nhóm còn lại sẽ bị xóa; các học phần của nó chuyển sang nhóm được giữ.';
const GROUP_OPTIONS_PAGE_SIZE = 100;

interface MergeGroupsModalProps {
  group: EquivalenceGroup;
  // Preselected when the merge was offered from a failed "add course".
  otherGroup?: OtherGroupRef;
  onClose: () => void;
}

interface MergeValues {
  otherGroupId: string;
  keptId: string;
}

export function MergeGroupsModal({
  group,
  otherGroup,
  onClose,
}: MergeGroupsModalProps) {
  const [form] = Form.useForm<MergeValues>();
  const otherGroupId = Form.useWatch('otherGroupId', form);
  const merge = useMergeEquivalenceGroups();
  const [error, setError] = useState<string | null>(null);
  const { data } = useEquivalenceGroupList({
    page: 1,
    pageSize: GROUP_OPTIONS_PAGE_SIZE,
  });
  const choices = [...(otherGroup ? [otherGroup] : []), ...(data?.items ?? [])]
    .filter(
      (item, index, all) =>
        item.id !== group.id &&
        all.findIndex((other) => other.id === item.id) === index,
    )
    .map((item) => ({ id: item.id, groupCode: item.groupCode }));
  const other = choices.find((item) => item.id === otherGroupId);

  const onFinish = (values: MergeValues) => {
    // A kept id left over from a previously chosen group falls back to this group.
    const keptId =
      values.keptId === values.otherGroupId ? values.otherGroupId : group.id;
    const removedId = keptId === group.id ? values.otherGroupId : group.id;
    merge.mutate(
      { keptId, otherGroupId: removedId },
      {
        onSuccess: onClose,
        onError: (reason) =>
          setError(errorMessage(reason, 'Không gộp được hai nhóm.')),
      },
    );
  };

  return (
    <Modal
      open
      title={`Gộp nhóm ${group.groupCode}`}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={merge.isPending}
      okText="Gộp nhóm"
      cancelText="Hủy"
    >
      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          style={{ marginBottom: 16 }}
        />
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        onValuesChange={() => setError(null)}
        initialValues={{ otherGroupId: otherGroup?.id, keptId: group.id }}
      >
        <Form.Item
          name="otherGroupId"
          label="Gộp với nhóm"
          rules={[{ required: true, message: 'Chọn nhóm cần gộp.' }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Chọn nhóm"
            options={choices.map((item) => ({
              value: item.id,
              label: item.groupCode,
            }))}
          />
        </Form.Item>
        {other && (
          <Form.Item name="keptId" label="Giữ mã nhóm">
            <Radio.Group
              options={[
                { value: group.id, label: group.groupCode },
                { value: other.id, label: other.groupCode },
              ]}
            />
          </Form.Item>
        )}
        <Typography.Paragraph type="secondary">
          {MERGE_CONFIRM_TEXT}
        </Typography.Paragraph>
      </Form>
    </Modal>
  );
}
