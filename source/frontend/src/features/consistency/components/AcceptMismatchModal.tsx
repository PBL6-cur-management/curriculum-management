import { Alert, App, Form, Input, Modal } from 'antd';
import { useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import {
  applyFieldErrors,
  errorMessage,
} from '../../../shared/forms/applyFieldErrors';
import type { CreditBreakdown } from '../api/consistency';
import {
  ACCEPT_LABEL,
  REASON_MAX,
  REASON_REQUIRED_MESSAGE,
} from '../constants/consistencyLabels';
import { useAcceptCreditMismatch } from '../hooks/useConsistency';
import { formatGap } from '../utils/issueTarget';

interface AcceptMismatchModalProps {
  versionId: string;
  // The gaps of the report the user is looking at; sent back so the server can refuse a stale acceptance.
  gap: CreditBreakdown;
  onClose: () => void;
  // Called when the server says the gaps moved, so the page can recompute.
  onStale: () => void;
}

interface Values {
  reason: string;
}

export function AcceptMismatchModal({
  versionId,
  gap,
  onClose,
  onStale,
}: AcceptMismatchModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [staleNote, setStaleNote] = useState<string | null>(null);
  const accept = useAcceptCreditMismatch(versionId);

  async function submit({ reason }: Values) {
    try {
      await accept.mutateAsync({
        reason,
        compulsoryGap: gap.compulsory,
        electiveGap: gap.elective,
      });
      void message.success('Đã chấp nhận chênh lệch.');
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CREDIT_GAP_CHANGED') {
        setStaleNote(error.message);
        onStale();
      } else if (!applyFieldErrors(form, error)) {
        void message.error(errorMessage(error, 'Không chấp nhận được.'));
      }
    }
  }

  return (
    <Modal
      open
      title={ACCEPT_LABEL}
      okText="Chấp nhận"
      cancelText="Hủy"
      confirmLoading={accept.isPending}
      okButtonProps={{ disabled: staleNote !== null }}
      onOk={() => form.submit()}
      onCancel={onClose}
    >
      <Alert
        type="warning"
        showIcon
        title={`Chênh lệch: bắt buộc ${formatGap(gap.compulsory)}, tự chọn ${formatGap(gap.elective)}, tổng ${formatGap(gap.total)} tín chỉ.`}
      />
      {staleNote && <Alert type="error" showIcon title={staleNote} />}
      <Form<Values> form={form} layout="vertical" onFinish={submit}>
        <Form.Item
          name="reason"
          label="Lý do"
          rules={[
            {
              required: true,
              whitespace: true,
              message: REASON_REQUIRED_MESSAGE,
            },
            { max: REASON_MAX },
          ]}
        >
          <Input.TextArea rows={3} maxLength={REASON_MAX} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}
