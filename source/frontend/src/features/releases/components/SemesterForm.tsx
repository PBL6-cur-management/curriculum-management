import { App, DatePicker, Form, Input, InputNumber, Modal } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '../../../shared/api/client';
import {
  applyFieldErrors,
  errorMessage,
} from '../../../shared/forms/applyFieldErrors';
import type { Semester } from '../../../shared/releases/semesters';
import { useCreateSemester, useUpdateSemester } from '../hooks/useReleases';
import { API_DATE_FORMAT } from '../utils/format';

interface SemesterFormProps {
  // Absent = a new semester.
  semester?: Semester;
  onClose: () => void;
}

interface Values {
  semesterCode: string;
  academicYear: string;
  termInYear: number;
  startDate: Dayjs | null;
}

const TERM_MIN = 1;
const TERM_MAX = 4;
const CODE_MAX = 30;
const YEAR_MAX = 20;

// MH-10: a semester has a code, an academic year, a term and (optionally) the day it starts. The start date can wait.
export function SemesterForm({ semester, onClose }: SemesterFormProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const create = useCreateSemester();
  const update = useUpdateSemester();

  async function submit(values: Values) {
    const body = {
      semesterCode: values.semesterCode,
      academicYear: values.academicYear,
      termInYear: values.termInYear,
      startDate: values.startDate?.format(API_DATE_FORMAT) ?? null,
    };
    try {
      if (semester) await update.mutateAsync({ id: semester.id, body });
      else await create.mutateAsync(body);
      void message.success(semester ? 'Đã lưu học kỳ.' : 'Đã thêm học kỳ.');
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SEMESTER_EXISTS') {
        form.setFields([{ name: 'semesterCode', errors: [error.message] }]);
      } else if (
        error instanceof ApiError &&
        error.code === 'SEMESTER_IN_USE'
      ) {
        form.setFields([{ name: 'startDate', errors: [error.message] }]);
      } else if (!applyFieldErrors(form, error)) {
        void message.error(errorMessage(error, 'Không lưu được học kỳ.'));
      }
    }
  }

  return (
    <Modal
      open
      title={semester ? 'Sửa học kỳ' : 'Thêm học kỳ'}
      okText="Lưu"
      cancelText="Hủy"
      confirmLoading={create.isPending || update.isPending}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form<Values>
        form={form}
        layout="vertical"
        onFinish={submit}
        initialValues={{
          semesterCode: semester?.semesterCode,
          academicYear: semester?.academicYear,
          termInYear: semester?.termInYear ?? TERM_MIN,
          startDate: semester?.startDate
            ? dayjs(semester.startDate, API_DATE_FORMAT)
            : null,
        }}
      >
        <Form.Item
          name="semesterCode"
          label="Mã học kỳ"
          rules={[
            { required: true, whitespace: true, message: 'Nhập mã học kỳ.' },
            { max: CODE_MAX },
          ]}
        >
          <Input placeholder="2026-2027-1" />
        </Form.Item>
        <Form.Item
          name="academicYear"
          label="Năm học"
          rules={[
            { required: true, whitespace: true, message: 'Nhập năm học.' },
            { max: YEAR_MAX },
          ]}
        >
          <Input placeholder="2026-2027" />
        </Form.Item>
        <Form.Item
          name="termInYear"
          label="Học kỳ trong năm"
          rules={[{ required: true, message: 'Nhập học kỳ trong năm.' }]}
        >
          <InputNumber min={TERM_MIN} max={TERM_MAX} precision={0} />
        </Form.Item>
        <Form.Item
          name="startDate"
          label="Ngày bắt đầu"
          extra={
            semester?.startDateEstimated
              ? 'Ngày hiện tại là ngày ước lượng vì lịch của Trường không có ngày cho học kỳ này. Lưu sẽ ghi nhận ngày trong ô là ngày chính thức.'
              : 'Có thể để trống; chưa có ngày thì chưa chọn được để ban hành.'
          }
        >
          <DatePicker format="DD/MM/YYYY" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
