import {
  App,
  Button,
  Checkbox,
  DatePicker,
  Flex,
  Form,
  Input,
  Modal,
  Result,
  Typography,
} from 'antd';
import type { Dayjs } from 'dayjs';
import { useState } from 'react';
import { generatePath, Link, useNavigate, useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { ApiError } from '../../../shared/api/client';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import { CohortSelect } from '../../../shared/releases/CohortSelect';
import { SemesterSelect } from '../../../shared/releases/SemesterSelect';
import { FinalApprovalPreview } from '../components/FinalApprovalPreview';
import {
  FINAL_APPROVAL_BUTTON,
  FINAL_APPROVAL_TITLE,
  FINAL_APPROVE_CONFIRM_BODY,
  FINAL_APPROVE_CONFIRM_TITLE,
} from '../constants/approvalLabels';
import {
  useFinalApprovalPreview,
  useFinalApprove,
} from '../hooks/useApprovals';
import {
  BackLink,
  PageHeader,
  PageSkeleton,
} from '../../../shared/design-system';

interface Values {
  decisionNumber: string;
  signedDate: Dayjs;
  effectiveSemesterId: string;
  cohortIds?: string[];
  remark?: string;
  allowPastSemester?: boolean;
}

const API_DATE_FORMAT = 'YYYY-MM-DD';
const DECISION_NUMBER_MAX = 100;
const REMARK_MAX = 2000;

// MH-43 (US-072): the academic office's decision. The preview is not an authorisation; a 409 (someone else decided, the
// base moved, a check failed) refreshes it and nothing is shown as approved until the server says so.
export function FinalApprovalPage() {
  const { requestId = '' } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [confirming, setConfirming] = useState<Values | null>(null);
  const preview = useFinalApprovalPreview(requestId);
  const approve = useFinalApprove(requestId);
  const back = generatePath(ROUTES.changeRequestDetail, { requestId });

  if (preview.isPending) return <PageSkeleton />;
  if (!preview.data) {
    const refused =
      preview.error instanceof ApiError && preview.error.status === 403;
    return (
      <Result
        status={refused ? '403' : 'warning'}
        title={
          refused
            ? 'Bạn không có phần duyệt cuối của đề xuất này.'
            : errorMessage(
                preview.error,
                'Đề xuất không còn chờ phê duyệt cuối.',
              )
        }
        extra={<Link to={back}>Về đề xuất</Link>}
      />
    );
  }
  const data = preview.data;

  async function submit(values: Values) {
    try {
      await approve.mutateAsync({
        decisionNumber: values.decisionNumber,
        signedDate: values.signedDate.format(API_DATE_FORMAT),
        effectiveSemesterId: values.effectiveSemesterId,
        remark: values.remark,
        allowPastSemester: data.canAllowPastSemester
          ? Boolean(values.allowPastSemester)
          : undefined,
        cohortIds: data.canAssignCohorts ? (values.cohortIds ?? []) : undefined,
      });
      void message.success('Đã phê duyệt cuối.');
      void navigate(back);
    } catch (error) {
      void preview.refetch();
      const labels =
        error instanceof ApiError
          ? (error.details ?? []).map((detail) => detail.field).join('; ')
          : '';
      void message.error(
        [errorMessage(error, 'Không phê duyệt được.'), labels]
          .filter(Boolean)
          .join(' — '),
      );
    } finally {
      setConfirming(null);
    }
  }

  return (
    <Flex vertical gap="middle">
      <BackLink to={back}>Đề xuất {data.requestCode}</BackLink>
      <PageHeader title={FINAL_APPROVAL_TITLE} />
      <FinalApprovalPreview preview={data} />
      <Form<Values>
        form={form}
        layout="vertical"
        style={{ maxWidth: 560 }}
        initialValues={{ cohortIds: [] }}
        onFinish={setConfirming}
      >
        <Form.Item
          name="decisionNumber"
          label="Số quyết định"
          rules={[
            {
              required: true,
              whitespace: true,
              message: 'Nhập số quyết định.',
            },
            { max: DECISION_NUMBER_MAX },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="signedDate"
          label="Ngày ký"
          rules={[{ required: true, message: 'Chọn ngày ký.' }]}
        >
          <DatePicker format="DD/MM/YYYY" />
        </Form.Item>
        <Form.Item
          name="effectiveSemesterId"
          label="Học kỳ hiệu lực"
          rules={[{ required: true, message: 'Chọn học kỳ hiệu lực.' }]}
        >
          <SemesterSelect />
        </Form.Item>
        {data.canAssignCohorts && (
          <Form.Item name="cohortIds" label="Khóa áp dụng">
            <CohortSelect />
          </Form.Item>
        )}
        <Form.Item name="remark" label="Ghi chú" rules={[{ max: REMARK_MAX }]}>
          <Input.TextArea rows={2} maxLength={REMARK_MAX} />
        </Form.Item>
        {data.canAllowPastSemester && (
          <Form.Item name="allowPastSemester" valuePropName="checked">
            <Checkbox>Cho phép ban hành vào học kỳ đã bắt đầu</Checkbox>
          </Form.Item>
        )}
        <Button
          type="primary"
          htmlType="submit"
          disabled={data.stale}
          loading={approve.isPending}
        >
          {FINAL_APPROVAL_BUTTON}
        </Button>
      </Form>
      <Modal
        open={confirming !== null}
        title={FINAL_APPROVE_CONFIRM_TITLE}
        okText="Phê duyệt cuối"
        cancelText="Hủy"
        confirmLoading={approve.isPending}
        onOk={() => confirming && void submit(confirming)}
        onCancel={() => setConfirming(null)}
      >
        <Typography.Paragraph>
          {FINAL_APPROVE_CONFIRM_BODY}
        </Typography.Paragraph>
      </Modal>
    </Flex>
  );
}
