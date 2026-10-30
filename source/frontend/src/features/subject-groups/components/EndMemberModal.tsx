import dayjs from 'dayjs';
import { Alert, App, DatePicker, Form, Modal } from 'antd';
import { useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import { ISO_DAY_FORMAT } from '../../../shared/validity/validity';
import type { SubjectGroupMember } from '../api/subjectGroupAdmin';
import { useEndMember } from '../hooks/useSubjectGroupAdmin';

interface EndMemberModalProps {
  groupId: string;
  row: SubjectGroupMember | null;
  onClose: () => void;
}
export function EndMemberModal({ groupId, row, onClose }: EndMemberModalProps) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const end = useEndMember();
  const [error, setError] = useState('');
  async function submit(values: { validTo: dayjs.Dayjs }) {
    if (!row) return;
    try {
      const changed = await end.mutateAsync({
        groupId,
        memberId: row.id,
        body: { validTo: values.validTo.format(ISO_DAY_FORMAT) },
      });
      message.success(`Đã cập nhật ${changed.length} dòng`);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : 'Không thể kết thúc dòng thành viên',
      );
    }
  }
  return (
    <Modal
      open={row !== null}
      title="Kết thúc thời hạn"
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={end.isPending}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={submit}
        initialValues={{ validTo: dayjs() }}
      >
        <Form.Item
          name="validTo"
          label="Ngày kết thúc"
          rules={[{ required: true, message: 'Chọn ngày kết thúc' }]}
        >
          <DatePicker
            format={ISO_DAY_FORMAT}
            disabledDate={(date) =>
              Boolean(
                row &&
                (date.isBefore(dayjs(row.validFrom), 'day') ||
                  (row.validTo !== null &&
                    !date.isBefore(dayjs(row.validTo), 'day'))),
              )
            }
          />
        </Form.Item>
        {row?.memberRole === 'MEMBER' && (
          <Alert
            type="info"
            title="Các dòng Điều phối của người này trong nhóm cũng kết thúc theo."
          />
        )}
        {error && <Alert type="error" title={error} />}
      </Form>
    </Modal>
  );
}
