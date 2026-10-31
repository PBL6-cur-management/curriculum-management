import { Alert, App, DatePicker, Form, Modal, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import {
  useCreateDelegation,
  useDelegationLevels,
  useDelegatorOptions,
  useRecipientOptions,
} from '../hooks/useDelegations';
import { UserOptionSelect } from './UserOptionSelect';

const ISO_DAY = 'YYYY-MM-DD';
const ALL_LEVELS = 'ALL';

interface FormValues {
  delegatorId?: string;
  delegateId: string;
  scopeLevel: 1 | 2 | typeof ALL_LEVELS;
  range: [Dayjs, Dayjs];
}

interface CreateDelegationModalProps {
  open: boolean;
  canManageOthers: boolean;
  onClose: () => void;
}

// MH-14: a grant covers whole days, both ends included; R1 may also grant on behalf of an approver (US-114 AC1).
export function CreateDelegationModal({
  open,
  canManageOthers,
  onClose,
}: CreateDelegationModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const delegatorId = Form.useWatch('delegatorId', form);
  const levelsEnabled = open && (!canManageOthers || Boolean(delegatorId));
  const { data: levels = [], isFetching: levelsLoading } = useDelegationLevels(
    canManageOthers ? delegatorId : undefined,
    levelsEnabled,
  );
  const create = useCreateDelegation();
  const noLevel = levelsEnabled && !levelsLoading && levels.length === 0;

  async function submit(values: FormValues) {
    try {
      await create.mutateAsync({
        delegateId: values.delegateId,
        ...(canManageOthers && { delegatorId: values.delegatorId }),
        scopeLevel: values.scopeLevel === ALL_LEVELS ? null : values.scopeLevel,
        validFrom: values.range[0].format(ISO_DAY),
        validTo: values.range[1].format(ISO_DAY),
      });
      message.success('Đã tạo ủy quyền. Người nhận đã được thông báo.');
      form.resetFields();
      onClose();
    } catch (error) {
      message.error(errorMessage(error, 'Không tạo được ủy quyền'));
    }
  }

  return (
    <Modal
      open={open}
      title="Ủy quyền duyệt"
      okText="Ủy quyền"
      cancelText="Hủy"
      onOk={() => form.submit()}
      onCancel={onClose}
      confirmLoading={create.isPending}
      okButtonProps={{ disabled: noLevel }}
      destroyOnHidden
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        initialValues={{ scopeLevel: ALL_LEVELS }}
        onFinish={(values) => void submit(values)}
      >
        {canManageOthers && (
          <Form.Item
            name="delegatorId"
            label="Người ủy quyền"
            rules={[{ required: true, message: 'Chọn người ủy quyền' }]}
          >
            <UserOptionSelect
              placeholder="Điều phối nhóm hoặc giám đốc CTĐT"
              useOptions={useDelegatorOptions}
            />
          </Form.Item>
        )}
        <Form.Item
          name="delegateId"
          label="Người được ủy quyền"
          rules={[{ required: true, message: 'Chọn người được ủy quyền' }]}
        >
          <UserOptionSelect
            placeholder="Tìm theo tên hoặc mã"
            useOptions={useRecipientOptions}
          />
        </Form.Item>
        <Form.Item name="scopeLevel" label="Cấp duyệt">
          <Select
            loading={levelsLoading}
            options={[
              { value: ALL_LEVELS, label: 'Mọi cấp người ủy quyền đang giữ' },
              ...levels.map((level) => ({
                value: level.approvalLevel,
                label: `Cấp ${level.approvalLevel} — ${level.levelName}`,
              })),
            ]}
          />
        </Form.Item>
        <Form.Item
          name="range"
          label="Thời gian (tính cả ngày đầu và ngày cuối)"
          rules={[{ required: true, message: 'Chọn thời gian ủy quyền' }]}
        >
          <DatePicker.RangePicker
            format="DD/MM/YYYY"
            style={{ width: '100%' }}
            disabledDate={(day) => day.isBefore(dayjs(), 'day')}
          />
        </Form.Item>
        {noLevel && (
          <Alert
            type="warning"
            showIcon
            title="Người ủy quyền hiện không giữ cấp duyệt nào (điều phối nhóm chuyên môn hoặc giám đốc CTĐT)."
          />
        )}
      </Form>
    </Modal>
  );
}
