import { App, Form, Input, InputNumber, Modal, Select } from 'antd';
import {
  CREDITS_MESSAGE,
  CREDITS_PATTERN,
} from '../../../shared/forms/credits';
import {
  applyFieldErrors,
  errorMessage,
} from '../../../shared/forms/applyFieldErrors';
import type { ElectiveGroup, ProgramTrack } from '../api/curriculum';
import { MINIMUM_REQUIRED_MESSAGE } from '../constants/curriculumLabels';
import { useCreateGroup, useUpdateGroup } from '../hooks/useCurriculum';
import { CURRICULUM_FORM_LIMITS } from '../schema/curriculumRules';

interface ElectiveGroupFormModalProps {
  versionId: string;
  tracks?: ProgramTrack[];
  // null = a new group.
  group: ElectiveGroup | null;
  onClose: () => void;
}

interface GroupFormValues {
  groupCode: string;
  groupName: string;
  trackId?: string | null;
  minCredits?: string | null;
  minCourses?: number | null;
}

// A group needs at least one minimum; the rule sits on the credits field and watches the courses field.
const atLeastOneMinimum = ({
  getFieldValue,
}: {
  getFieldValue: (name: keyof GroupFormValues) => unknown;
}) => ({
  validator() {
    const credits = getFieldValue('minCredits');
    const courses = getFieldValue('minCourses');
    const hasCredits = typeof credits === 'string' && credits.trim() !== '';
    const hasCourses = typeof courses === 'number';
    return hasCredits || hasCourses
      ? Promise.resolve()
      : Promise.reject(new Error(MINIMUM_REQUIRED_MESSAGE));
  },
});

export function ElectiveGroupFormModal({
  versionId,
  tracks = [],
  group,
  onClose,
}: ElectiveGroupFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<GroupFormValues>();
  const create = useCreateGroup(versionId);
  const update = useUpdateGroup(versionId);
  const trackOptions = tracks.map((track) => ({
    value: track.id,
    label: `${track.trackCode} — ${track.trackName}`,
  }));

  const submit = (values: GroupFormValues) => {
    const body = {
      groupCode: values.groupCode.trim(),
      groupName: values.groupName.trim(),
      trackId: values.trackId ?? null,
      minCredits: values.minCredits?.trim() ? values.minCredits.trim() : null,
      minCourses: values.minCourses ?? null,
    };
    const options = {
      onSuccess: onClose,
      onError: (reason: unknown) => {
        if (!applyFieldErrors(form, reason))
          void message.error(errorMessage(reason, 'Không lưu được nhóm.'));
      },
    };
    if (group) update.mutate({ groupId: group.id, body }, options);
    else create.mutate(body, options);
  };

  return (
    <Modal
      open
      title={group ? `Sửa nhóm ${group.groupCode}` : 'Thêm nhóm tự chọn'}
      okText="Lưu"
      cancelText="Hủy"
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={create.isPending || update.isPending}
      destroyOnHidden
    >
      <Form<GroupFormValues>
        form={form}
        layout="vertical"
        initialValues={{
          groupCode: group?.groupCode,
          groupName: group?.groupName,
          trackId: group?.trackId ?? undefined,
          minCredits: group?.minCredits,
          minCourses: group?.minCourses,
        }}
        onFinish={submit}
      >
        <Form.Item
          name="groupCode"
          label="Mã nhóm"
          rules={[
            { required: true, whitespace: true, message: 'Nhập mã nhóm.' },
            {
              max: CURRICULUM_FORM_LIMITS.GROUP_CODE_MAX,
              message: `Mã nhóm tối đa ${CURRICULUM_FORM_LIMITS.GROUP_CODE_MAX} ký tự.`,
            },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="groupName"
          label="Tên nhóm"
          rules={[
            { required: true, whitespace: true, message: 'Nhập tên nhóm.' },
            {
              max: CURRICULUM_FORM_LIMITS.GROUP_NAME_MAX,
              message: `Tên nhóm tối đa ${CURRICULUM_FORM_LIMITS.GROUP_NAME_MAX} ký tự.`,
            },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="trackId" label="Định hướng / Chuyên ngành">
          <Select
            allowClear
            placeholder="Khung chung (tất cả định hướng)"
            options={trackOptions}
          />
        </Form.Item>
        <Form.Item
          name="minCredits"
          label="Số tín chỉ tối thiểu"
          dependencies={['minCourses']}
          rules={[
            {
              pattern: CREDITS_PATTERN,
              message: CREDITS_MESSAGE,
            },
            atLeastOneMinimum,
          ]}
        >
          <Input inputMode="decimal" />
        </Form.Item>
        <Form.Item
          name="minCourses"
          label="Số học phần tối thiểu"
          extra="Nhập cả hai thì sinh viên phải đạt cả hai."
          dependencies={['minCredits']}
        >
          <InputNumber min={1} precision={0} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
