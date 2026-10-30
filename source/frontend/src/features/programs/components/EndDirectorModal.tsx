import dayjs from 'dayjs';
import { Alert, DatePicker, Form, Modal } from 'antd';
import { useState } from 'react';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import { ISO_DAY_FORMAT } from '../../../shared/validity/validity';
import type { ProgramDirector } from '../api/programs';
import { useEndDirector } from '../hooks/usePrograms';

interface EndDirectorModalProps {
  programId: string;
  row: ProgramDirector;
  onClose: () => void;
}

interface EndValues {
  validTo: dayjs.Dayjs;
}

// Ending only shortens the period; extending means a new assignment (US-020).
export function EndDirectorModal({
  programId,
  row,
  onClose,
}: EndDirectorModalProps) {
  const [form] = Form.useForm<EndValues>();
  const end = useEndDirector();
  const [error, setError] = useState<string | null>(null);
  const onFinish = (values: EndValues) => {
    setError(null);
    end.mutate(
      {
        programId,
        assignmentId: row.id,
        validTo: values.validTo.format(ISO_DAY_FORMAT),
      },
      {
        onSuccess: onClose,
        onError: (reason) =>
          setError(errorMessage(reason, 'Không kết thúc được phân công.')),
      },
    );
  };
  return (
    <Modal
      open
      title={`Kết thúc phân công — ${row.director.fullName}`}
      okText="Kết thúc"
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={end.isPending}
    >
      <Form<EndValues>
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ validTo: dayjs() }}
      >
        <Form.Item
          name="validTo"
          label="Ngày kết thúc"
          rules={[{ required: true, message: 'Chọn ngày kết thúc.' }]}
        >
          <DatePicker
            format={ISO_DAY_FORMAT}
            disabledDate={(date) =>
              date.isBefore(dayjs(row.validFrom), 'day') ||
              (row.validTo !== null &&
                !date.isBefore(dayjs(row.validTo), 'day'))
            }
          />
        </Form.Item>
        {error && <Alert type="error" showIcon title={error} />}
      </Form>
    </Modal>
  );
}
