import { useEffect } from 'react';
import {
  App,
  Button,
  Flex,
  Form,
  Input,
  InputNumber,
  Select,
  Skeleton,
  Space,
  Typography,
  Col,
  Row,
} from 'antd';
import { generatePath, useNavigate, useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import {
  applyFieldErrors,
  errorMessage,
} from '../../../shared/forms/applyFieldErrors';
import type {
  CreateProgramRequest,
  DegreeLevel,
  ProgramDetail,
  UpdateProgramRequest,
} from '../api/programs';
import { CreditsGapHint } from '../components/CreditsGapHint';
import { DEGREE_LEVEL_LABELS } from '../constants/programLabels';
import { useProgram, useUpdateProgram } from '../hooks/usePrograms';
import {
  PROGRAM_RULES,
  SEMESTERS_MAX,
  SEMESTERS_MIN,
} from '../schema/programRules';

type ProgramFormValues = CreateProgramRequest;

const LEVEL_OPTIONS = (Object.keys(DEGREE_LEVEL_LABELS) as DegreeLevel[]).map(
  (value) => ({ value, label: DEGREE_LEVEL_LABELS[value] }),
);
const NOT_EDITABLE_WARNING =
  'Chương trình đã có phiên bản ban hành, chỉ sửa được qua đề xuất thay đổi.';

function toFormValues(program: ProgramDetail): Partial<ProgramFormValues> {
  const draft = program.draftVersion;
  return {
    programCode: program.programCode,
    degreeLevel: program.degreeLevel,
    programName: draft?.programName,
    majorCode: draft?.majorCode,
    majorName: draft?.majorName,
    semesterCount: draft?.semesterCount,
    totalCredits: draft?.totalCredits,
    compulsoryCredits: draft?.compulsoryCredits,
    electiveCredits: draft?.electiveCredits,
  };
}

// Edit-only on purpose: building a programme from scratch is out of scope; new programmes come from cloning.
export function ProgramFormPage() {
  const { programId = '' } = useParams();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm<ProgramFormValues>();
  const { data: program, isPending } = useProgram(programId);
  const update = useUpdateProgram();
  const total = Form.useWatch('totalCredits', form);
  const compulsory = Form.useWatch('compulsoryCredits', form);
  const elective = Form.useWatch('electiveCredits', form);

  const editable = program?.editPath === 'DIRECT';
  useEffect(() => {
    if (!program) return;
    if (program.editPath !== 'DIRECT') {
      void message.warning(NOT_EDITABLE_WARNING);
      void navigate(
        generatePath(ROUTES.programDetail, { programId: program.id }),
        { replace: true },
      );
      return;
    }
    form.setFieldsValue(toFormValues(program));
  }, [program, form, message, navigate]);

  const onFinish = (values: ProgramFormValues) => {
    const onSuccess = (saved: ProgramDetail) =>
      void navigate(
        generatePath(ROUTES.programDetail, { programId: saved.id }),
      );
    const onError = (error: unknown) => {
      if (!applyFieldErrors(form, error))
        void message.error(errorMessage(error, 'Không lưu được chương trình.'));
    };
    // The code is fixed after creation; the faculty is not editable here either.
    const { programCode: _code, ...rest } = values;
    const body: UpdateProgramRequest = rest;
    update.mutate({ programId, body }, { onSuccess, onError });
  };

  if (isPending || !editable) return <Skeleton active />;
  return (
    <Flex vertical gap="middle">
      <Typography.Title level={2} style={{ margin: 0 }}>
        {`Sửa thông tin chương trình ${program?.programCode ?? ''}`}
      </Typography.Title>
      <Form<ProgramFormValues>
        form={form}
        layout="vertical"
        onFinish={onFinish}
        style={{ maxWidth: 800 }}
      >
        <Typography.Title level={5}>Định danh</Typography.Title>
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item
              name="programCode"
              label="Mã chương trình"
              rules={PROGRAM_RULES.programCode}
            >
              <Input disabled />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name="degreeLevel"
              label="Trình độ"
              rules={PROGRAM_RULES.degreeLevel}
            >
              <Select options={LEVEL_OPTIONS} placeholder="Chọn trình độ" />
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
          <Col xs={24} md={24}>
            <Form.Item
              name="programName"
              label="Tên chương trình"
              rules={PROGRAM_RULES.programName}
            >
              <Input />
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
              <Input inputMode="decimal" placeholder="Ví dụ 150" />
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
          <Button
            onClick={() =>
              void navigate(generatePath(ROUTES.programDetail, { programId }))
            }
          >
            Hủy
          </Button>
        </Space>
      </Form>
    </Flex>
  );
}
