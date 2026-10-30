import { useEffect } from 'react';
import {
  App,
  Button,
  Descriptions,
  Flex,
  Form,
  Input,
  InputNumber,
  Result,
  Skeleton,
  Space,
  Typography,
  Col,
  Row,
} from 'antd';
import { generatePath, Link, useNavigate, useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { RequestDraftBanner } from '../../../shared/change-requests/RequestDraftBanner';
import {
  applyFieldErrors,
  errorMessage,
} from '../../../shared/forms/applyFieldErrors';
import type { UpdateVersionInfoRequest } from '../api/programs';
import { CreditsGapHint } from '../components/CreditsGapHint';
import { useUpdateVersionInfo, useVersionInfo } from '../hooks/usePrograms';
import {
  PROGRAM_RULES,
  SEMESTERS_MAX,
  SEMESTERS_MIN,
} from '../schema/programRules';

type Values = UpdateVersionInfoRequest;

// The info of one version by id, for the working copy of a PROGRAM_INFO request (US-054). The program's code,
// faculty and degree level live on the program, not on a version, so they are not here (D15).
export function VersionInfoEditPage() {
  const { programId = '', versionId = '' } = useParams();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm<Values>();
  const { data: info, isPending } = useVersionInfo(versionId);
  const update = useUpdateVersionInfo(versionId);
  const total = Form.useWatch('totalCredits', form);
  const compulsory = Form.useWatch('compulsoryCredits', form);
  const elective = Form.useWatch('electiveCredits', form);
  useEffect(() => {
    if (info)
      form.setFieldsValue({
        programName: info.programName,
        majorCode: info.majorCode,
        majorName: info.majorName,
        semesterCount: info.semesterCount,
        totalCredits: info.totalCredits,
        compulsoryCredits: info.compulsoryCredits,
        electiveCredits: info.electiveCredits,
      });
  }, [info, form]);
  if (isPending) return <Skeleton active />;
  if (!info) return <Result status="404" title="Không tìm thấy phiên bản" />;
  const back = info.sourceRequest
    ? generatePath(ROUTES.changeRequestEdit, {
        requestId: info.sourceRequest.id,
      })
    : generatePath(ROUTES.programDetail, { programId });
  const onFinish = (values: Values) =>
    update.mutate(values, {
      onSuccess: () => void navigate(back),
      onError: (error) => {
        if (!applyFieldErrors(form, error))
          void message.error(errorMessage(error, 'Không lưu được thông tin.'));
      },
    });
  return (
    <Flex vertical gap="middle">
      <Flex justify="space-between" align="center" wrap gap="small">
        <Typography.Title level={2} style={{ margin: 0 }}>
          Thông tin chương trình {info.program.programCode}
        </Typography.Title>
        <Link to={back}>
          {info.sourceRequest ? 'Về đề xuất' : 'Về chương trình'}
        </Link>
      </Flex>
      <RequestDraftBanner request={info.sourceRequest} />
      {info.canEdit ? (
        <Form<Values>
          form={form}
          layout="vertical"
          onFinish={onFinish}
          style={{ maxWidth: 800 }}
        >
          <Typography.Title level={5}>Định danh</Typography.Title>
          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Form.Item
                name="programName"
                label="Tên chương trình"
                rules={PROGRAM_RULES.programName}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="semesterCount"
                label="Số học kỳ"
                rules={PROGRAM_RULES.semesterCount}
              >
                <InputNumber
                  min={SEMESTERS_MIN}
                  max={SEMESTERS_MAX}
                  precision={0}
                />
              </Form.Item>
            </Col>
          </Row>
          <Typography.Title level={5}>Ngành</Typography.Title>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="majorCode"
                label="Mã ngành"
                rules={PROGRAM_RULES.majorCode}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item
                name="majorName"
                label="Tên ngành"
                rules={PROGRAM_RULES.majorName}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Typography.Title level={5}>Tín chỉ</Typography.Title>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="totalCredits"
                label="Tổng số tín chỉ"
                rules={PROGRAM_RULES.totalCredits}
              >
                <Input inputMode="decimal" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="compulsoryCredits"
                label="Tín chỉ bắt buộc"
                rules={PROGRAM_RULES.compulsoryCredits}
              >
                <Input inputMode="decimal" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="electiveCredits"
                label="Tín chỉ tự chọn"
                rules={PROGRAM_RULES.electiveCredits}
                extra={
                  <CreditsGapHint
                    total={total}
                    compulsory={compulsory}
                    elective={elective}
                  />
                }
              >
                <Input inputMode="decimal" />
              </Form.Item>
            </Col>
          </Row>
          <Space>
            <Button type="primary" htmlType="submit" loading={update.isPending}>
              Lưu
            </Button>
            <Button onClick={() => void navigate(back)}>Hủy</Button>
          </Space>
        </Form>
      ) : (
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Tên chương trình">
            {info.programName}
          </Descriptions.Item>
          <Descriptions.Item label="Mã ngành">
            {info.majorCode}
          </Descriptions.Item>
          <Descriptions.Item label="Tên ngành">
            {info.majorName}
          </Descriptions.Item>
          <Descriptions.Item label="Số học kỳ">
            {info.semesterCount}
          </Descriptions.Item>
          <Descriptions.Item label="Tổng số tín chỉ">
            {info.totalCredits}
          </Descriptions.Item>
          <Descriptions.Item label="Tín chỉ bắt buộc">
            {info.compulsoryCredits}
          </Descriptions.Item>
          <Descriptions.Item label="Tín chỉ tự chọn">
            {info.electiveCredits}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Flex>
  );
}
