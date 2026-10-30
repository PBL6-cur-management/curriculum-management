import dayjs from 'dayjs';
import { Alert, DatePicker, Form, Modal } from 'antd';
import { useState } from 'react';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import { UserSelect } from '../../../shared/users/UserSelect';
import { ISO_DAY_FORMAT } from '../../../shared/validity/validity';
import type { ProgramDetail } from '../api/programs';
import { useAssignDirector } from '../hooks/usePrograms';

interface AssignDirectorModalProps {
  program: ProgramDetail;
  onClose: () => void;
}

interface AssignValues {
  directorId: string;
  validFrom: dayjs.Dayjs;
  validTo?: dayjs.Dayjs;
}

export function AssignDirectorModal({
  program,
  onClose,
}: AssignDirectorModalProps) {
  const [form] = Form.useForm<AssignValues>();
  const assign = useAssignDirector();
  const [error, setError] = useState<string | null>(null);
  const onFinish = (values: AssignValues) => {
    setError(null);
    assign.mutate(
      {
        programId: program.id,
        body: {
          directorId: values.directorId,
          validFrom: values.validFrom.format(ISO_DAY_FORMAT),
          ...(values.validTo
            ? { validTo: values.validTo.format(ISO_DAY_FORMAT) }
            : {}),
        },
      },
      {
        onSuccess: onClose,
        onError: (reason) =>
          setError(errorMessage(reason, 'Không phân công được Giám đốc CTĐT.')),
      },
    );
  };
  return (
    <Modal
      open
      title={`Phân công Giám đốc CTĐT — ${program.programCode}`}
      okText="Phân công"
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={assign.isPending}
    >
      <Form<AssignValues>
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ validFrom: dayjs() }}
      >
        <Form.Item
          name="directorId"
          label="Giám đốc CTĐT"
          rules={[{ required: true, message: 'Chọn người được phân công.' }]}
        >
          <UserSelect />
        </Form.Item>
        <Form.Item
          name="validFrom"
          label="Có hiệu lực từ"
          rules={[{ required: true, message: 'Chọn ngày bắt đầu.' }]}
        >
          <DatePicker format={ISO_DAY_FORMAT} />
        </Form.Item>
        <Form.Item
          name="validTo"
          label="Có hiệu lực đến"
          extra="Để trống nếu chưa biết ngày kết thúc."
          dependencies={['validFrom']}
          rules={[
            ({ getFieldValue }) => ({
              validator(_rule, value: dayjs.Dayjs | undefined) {
                const from = getFieldValue('validFrom') as
                  dayjs.Dayjs | undefined;
                return !value || !from || !value.isBefore(from, 'day')
                  ? Promise.resolve()
                  : Promise.reject(
                      new Error('Ngày kết thúc không được trước ngày bắt đầu.'),
                    );
              },
            }),
          ]}
        >
          <DatePicker format={ISO_DAY_FORMAT} />
        </Form.Item>
        {error && <Alert type="error" showIcon title={error} />}
      </Form>
    </Modal>
  );
}
