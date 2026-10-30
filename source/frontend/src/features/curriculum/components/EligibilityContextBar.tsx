import { Button, Form, Space, Typography } from 'antd';
import { SemesterSelect } from '../../../shared/releases/SemesterSelect';
import { ELIGIBILITY_HELP } from '../../../shared/registration-eligibility/eligibilityLabels';
import { EligibilityStudentSelect } from './EligibilityStudentSelect';

export function EligibilityContextBar({
  programId,
  semesterId,
  studentId,
  onSemesterChange,
  onStudentChange,
  onRecompute,
  computing,
}: {
  programId: string;
  semesterId: string;
  studentId?: string;
  onSemesterChange: (id: string) => void;
  onStudentChange: (id: string | undefined) => void;
  onRecompute?: () => void;
  computing?: boolean;
}) {
  return (
    <section aria-label="Ngữ cảnh xét điều kiện đăng ký">
      <Form layout="inline">
        <Form.Item label="Học kỳ xét điều kiện" htmlFor="eligibility-semester">
          <SemesterSelect
            id="eligibility-semester"
            value={semesterId || undefined}
            onChange={onSemesterChange}
          />
        </Form.Item>
        <Form.Item label="Xem theo sinh viên" htmlFor="eligibility-student">
          <EligibilityStudentSelect
            key={`${programId}:${semesterId}`}
            id="eligibility-student"
            programId={programId}
            semesterId={semesterId}
            value={studentId}
            onChange={onStudentChange}
          />
        </Form.Item>
      </Form>
      <Space wrap>
        {studentId && (
          <Button onClick={() => onStudentChange(undefined)}>
            Bỏ chọn sinh viên
          </Button>
        )}
        {studentId && onRecompute && (
          <Button loading={computing} onClick={onRecompute}>
            Tính lại
          </Button>
        )}
        <Typography.Text type="secondary">{ELIGIBILITY_HELP}</Typography.Text>
      </Space>
    </section>
  );
}
