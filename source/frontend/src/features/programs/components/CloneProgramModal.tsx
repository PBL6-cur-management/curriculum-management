import { App, Form, Input, Modal, Select, Typography } from 'antd';
import { generatePath, useNavigate } from 'react-router';
import { ROUTES } from '../../../routes';
import {
  applyFieldErrors,
  errorMessage,
} from '../../../shared/forms/applyFieldErrors';
import type { ProgramDetail } from '../api/programs';
import {
  CLONE_SCOPE_NOTE,
  VERSION_STATUS_LABELS,
  versionLabel,
} from '../constants/programLabels';
import { useCloneProgram } from '../hooks/usePrograms';
import { PROGRAM_CODE_RULES, PROGRAM_NAME_RULES } from '../schema/programRules';

interface CloneProgramModalProps {
  program: ProgramDetail;
  onClose: () => void;
}

interface CloneValues {
  programCode: string;
  programName: string;
  sourceVersionId: string;
}

export function CloneProgramModal({
  program,
  onClose,
}: CloneProgramModalProps) {
  const [form] = Form.useForm<CloneValues>();
  const { message } = App.useApp();
  const clone = useCloneProgram();
  const navigate = useNavigate();
  const onFinish = (values: CloneValues) =>
    clone.mutate(
      { programId: program.id, body: values },
      {
        onSuccess: (created) => {
          onClose();
          void navigate(
            generatePath(ROUTES.programDetail, { programId: created.id }),
          );
        },
        onError: (error) => {
          if (!applyFieldErrors(form, error))
            void message.error(
              errorMessage(error, 'Không nhân bản được chương trình.'),
            );
        },
      },
    );
  return (
    <Modal
      open
      title={`Nhân bản ${program.programCode}`}
      okText="Nhân bản"
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={clone.isPending}
    >
      <Form<CloneValues>
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{
          sourceVersionId: program.currentVersion.id,
          programName: program.currentVersionInfo.programName,
        }}
      >
        <Form.Item name="sourceVersionId" label="Phiên bản nguồn">
          <Select
            options={program.versions.map((version) => ({
              value: version.id,
              label: `${versionLabel(version)}${'decisionNumber' in version && version.decisionNumber ? ` (${String(version.decisionNumber)})` : ''} — ${VERSION_STATUS_LABELS[version.status]}`,
            }))}
          />
        </Form.Item>
        <Form.Item
          name="programCode"
          label="Mã chương trình mới"
          rules={PROGRAM_CODE_RULES}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="programName"
          label="Tên chương trình mới"
          rules={PROGRAM_NAME_RULES}
        >
          <Input />
        </Form.Item>
        <Typography.Paragraph type="secondary">
          {CLONE_SCOPE_NOTE}
        </Typography.Paragraph>
      </Form>
    </Modal>
  );
}
