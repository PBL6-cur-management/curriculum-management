import {
  App,
  Button,
  DatePicker,
  Flex,
  Form,
  Input,
  Modal,
  Result,
  Typography,
} from 'antd';
import { useState } from 'react';
import { generatePath, Link, useNavigate, useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { ApiError } from '../../../shared/api/client';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import { CohortSelect } from '../../../shared/releases/CohortSelect';
import { SemesterSelect } from '../../../shared/releases/SemesterSelect';
import { ReleaseCheckPanel } from '../components/ReleaseCheckPanel';
import {
  DECISION_NUMBER_MAX,
  RELEASE_CONFIRM_BODY,
  RELEASE_CONFIRM_TITLE,
  VERSION_NUMBER_MESSAGE,
  VERSION_NUMBER_PATTERN,
} from '../constants/releaseLabels';
import { useReleaseCheck, useReleaseVersion } from '../hooks/useReleases';
import { API_DATE_FORMAT } from '../utils/format';
import type { Dayjs } from 'dayjs';
import {
  BackLink,
  PageHeader,
  PageSkeleton,
} from '../../../shared/design-system';

interface Values {
  versionNumber: string;
  decisionNumber: string;
  signedDate: Dayjs;
  effectiveSemesterId: string;
  cohortIds: string[];
}

const DEFAULT_VERSION_NUMBER = '1.0';

// MH-45 (US-071): the one plain Draft a program has never released becomes its first version. Irreversible, so the
// button asks again; the server repeats every check and a conflict refreshes the preflight.
export function InitialReleasePage() {
  const { programId = '', versionId = '' } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [confirming, setConfirming] = useState<Values | null>(null);
  const check = useReleaseCheck(programId, versionId);
  const release = useReleaseVersion(programId, versionId);

  if (check.isPending) return <PageSkeleton />;
  if (check.error && !check.data) {
    const refused =
      check.error instanceof ApiError && check.error.status === 403;
    return (
      <Result
        status={refused ? '403' : '404'}
        title={
          refused
            ? 'Chỉ Phòng Đào tạo ban hành được phiên bản.'
            : 'Không có bản nháp để ban hành (chương trình đã có phiên bản ban hành, hoặc không tìm thấy).'
        }
        extra={
          <Link to={generatePath(ROUTES.programDetail, { programId })}>
            Về chương trình
          </Link>
        }
      />
    );
  }

  async function submit(values: Values) {
    try {
      const released = await release.mutateAsync({
        versionNumber: values.versionNumber,
        decisionNumber: values.decisionNumber,
        signedDate: values.signedDate.format(API_DATE_FORMAT),
        effectiveSemesterId: values.effectiveSemesterId,
        cohortIds: values.cohortIds ?? [],
      });
      void message.success('Đã ban hành phiên bản.');
      void navigate(
        generatePath(ROUTES.versionDetail, {
          programId,
          versionId: released.id,
        }),
      );
    } catch (error) {
      // Something moved since the preflight (a syllabus, a frame error, another release): show the fresh state.
      void check.refetch();
      void message.error(errorMessage(error, 'Không ban hành được.'));
    } finally {
      setConfirming(null);
    }
  }

  return (
    <Flex vertical gap="middle">
      <BackLink to={generatePath(ROUTES.programDetail, { programId })}>
        Chương trình
      </BackLink>
      <PageHeader title="Ban hành phiên bản đầu tiên" />
      <ReleaseCheckPanel
        check={check.data}
        loading={check.isPending}
        refreshing={check.isFetching}
        onRerun={() => void check.refetch()}
        programId={programId}
        versionId={versionId}
      />
      <Form<Values>
        form={form}
        layout="vertical"
        style={{ maxWidth: 560 }}
        initialValues={{
          versionNumber: DEFAULT_VERSION_NUMBER,
          cohortIds: [],
        }}
        onFinish={setConfirming}
      >
        <Form.Item
          name="versionNumber"
          label="Số phiên bản"
          rules={[
            { required: true, message: VERSION_NUMBER_MESSAGE },
            {
              pattern: VERSION_NUMBER_PATTERN,
              message: VERSION_NUMBER_MESSAGE,
            },
          ]}
        >
          <Input />
        </Form.Item>
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
          extra="Học kỳ đã bắt đầu thì phiên bản Đang hiệu lực ngay; học kỳ sau thì Chờ hiệu lực đến ngày bắt đầu."
          rules={[{ required: true, message: 'Chọn học kỳ hiệu lực.' }]}
        >
          <SemesterSelect />
        </Form.Item>
        <Form.Item name="cohortIds" label="Khóa áp dụng">
          <CohortSelect />
        </Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          disabled={!check.data?.canRelease}
          loading={release.isPending}
        >
          Ban hành
        </Button>
      </Form>
      <Modal
        open={confirming !== null}
        title={RELEASE_CONFIRM_TITLE}
        okText="Ban hành"
        cancelText="Hủy"
        confirmLoading={release.isPending}
        onOk={() => confirming && void submit(confirming)}
        onCancel={() => setConfirming(null)}
      >
        <Typography.Paragraph>{RELEASE_CONFIRM_BODY}</Typography.Paragraph>
        {confirming && (
          <Typography.Paragraph>
            Phiên bản <strong>{confirming.versionNumber}</strong>, quyết định{' '}
            <strong>{confirming.decisionNumber}</strong>.
          </Typography.Paragraph>
        )}
      </Modal>
    </Flex>
  );
}
