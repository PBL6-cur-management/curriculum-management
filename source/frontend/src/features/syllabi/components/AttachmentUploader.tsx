import { App, Form, Select, Typography, Upload } from 'antd';
import { ApiError } from '../../../shared/api/client';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { AttachmentRules, SyllabusMaterialKind } from '../api/syllabi';
import {
  ATTACHED,
  UPLOAD_PROMPT,
  MATERIAL_KIND_LABELS,
  MATERIAL_KIND_ORDER,
} from '../constants/syllabusLabels';
import { useUploadAttachment } from '../hooks/useSyllabus';
import {
  acceptedExtensions,
  attachmentHint,
  checkAttachment,
} from '../utils/attachmentRules';

const PAYLOAD_TOO_LARGE_CODE = 'PAYLOAD_TOO_LARGE';

const isPayloadTooLarge = (error: unknown) =>
  error instanceof ApiError && error.code === PAYLOAD_TOO_LARGE_CODE;

interface AttachmentUploaderProps {
  courseId: string;
  syllabusId: string;
  attachmentRules: AttachmentRules;
}

// The drop zone of the editor's attachment tab; also on a published revision, which only ever gains signed files (US-077).
export function AttachmentUploader({
  courseId,
  syllabusId,
  attachmentRules,
}: AttachmentUploaderProps) {
  const { message } = App.useApp();
  const upload = useUploadAttachment(courseId, syllabusId);
  const [form] = Form.useForm<{ materialKind: SyllabusMaterialKind }>();
  const materialKind = Form.useWatch('materialKind', form);
  const hint = attachmentHint(attachmentRules);
  // false keeps AntD from posting by itself, so the upload goes through client.ts with the CSRF header.
  const beforeUpload = (file: File) => {
    if (!materialKind) return Upload.LIST_IGNORE;
    const problem = checkAttachment(file, attachmentRules);
    if (problem) {
      void message.error(problem);
      return Upload.LIST_IGNORE;
    }
    upload.mutate(
      { file, materialKind },
      {
        onSuccess: () => void message.success(ATTACHED),
        onError: (reason) =>
          void message.error(
            isPayloadTooLarge(reason)
              ? `${errorMessage(reason, '')} ${hint}`
              : errorMessage(reason, 'Không đính kèm được tệp.'),
          ),
      },
    );
    return false;
  };
  return (
    <Form form={form} layout="vertical">
      <Form.Item
        name="materialKind"
        label="Loại tài liệu"
        rules={[{ required: true, message: 'Chọn loại tài liệu.' }]}
      >
        <Select
          placeholder="Chọn loại tài liệu"
          disabled={upload.isPending}
          options={MATERIAL_KIND_ORDER.map((value) => ({
            value,
            label: MATERIAL_KIND_LABELS[value],
          }))}
        />
      </Form.Item>
      <Upload.Dragger
        accept={acceptedExtensions(attachmentRules).join(',')}
        beforeUpload={beforeUpload}
        showUploadList={false}
        multiple={false}
        disabled={upload.isPending || !materialKind}
      >
        <p>{UPLOAD_PROMPT}</p>
        <Typography.Text type="secondary">{hint}</Typography.Text>
      </Upload.Dragger>
    </Form>
  );
}
