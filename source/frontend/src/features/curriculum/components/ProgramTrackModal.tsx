import { App, Col, Form, Input, InputNumber, Modal, Row } from 'antd';
import {
  applyFieldErrors,
  errorMessage,
} from '../../../shared/forms/applyFieldErrors';
import type { ProgramTrack } from '../api/curriculum';
import { useCreateTrack, useUpdateTrack } from '../hooks/useCurriculum';
import {
  TRACK_CODE_RULES,
  TRACK_CREDITS_RULES,
  TRACK_DESC_RULES,
  TRACK_ENGLISH_NAME_RULES,
  TRACK_NAME_RULES,
} from '../schema/curriculumRules';

interface ProgramTrackModalProps {
  versionId: string;
  // null = creating a new track.
  track: ProgramTrack | null;
  onClose: () => void;
}

interface TrackFormValues {
  trackCode: string;
  trackName: string;
  englishName?: string | null;
  compulsoryCredits?: string | null;
  electiveCredits?: string | null;
  sortOrder?: number | null;
  description?: string | null;
}

const blankToNull = (text: string | null | undefined) => {
  const trimmed = text?.trim();
  return trimmed ? trimmed : null;
};

export function ProgramTrackModal({
  versionId,
  track,
  onClose,
}: ProgramTrackModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<TrackFormValues>();
  const create = useCreateTrack(versionId);
  const update = useUpdateTrack(versionId);
  const pending = create.isPending || update.isPending;

  const submit = (values: TrackFormValues) => {
    const body = {
      trackCode: values.trackCode.trim(),
      trackName: values.trackName.trim(),
      englishName: blankToNull(values.englishName),
      compulsoryCredits: blankToNull(values.compulsoryCredits),
      electiveCredits: blankToNull(values.electiveCredits),
      ...(typeof values.sortOrder === 'number'
        ? { sortOrder: values.sortOrder }
        : {}),
      description: blankToNull(values.description),
    };
    const options = {
      onSuccess: () => {
        void message.success(
          track ? 'Đã cập nhật định hướng.' : 'Đã thêm định hướng mới.',
        );
        onClose();
      },
      onError: (reason: unknown) => {
        if (!applyFieldErrors(form, reason))
          void message.error(
            errorMessage(reason, 'Không lưu được định hướng.'),
          );
      },
    };
    if (track) update.mutate({ trackId: track.id, body }, options);
    else create.mutate(body, options);
  };

  return (
    <Modal
      open
      title={
        track
          ? `Sửa định hướng ${track.trackCode}`
          : 'Thêm định hướng / chuyên ngành con'
      }
      okText="Lưu"
      cancelText="Hủy"
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={pending}
      destroyOnHidden
    >
      <Form<TrackFormValues>
        form={form}
        layout="vertical"
        initialValues={{
          trackCode: track?.trackCode,
          trackName: track?.trackName,
          englishName: track?.englishName,
          compulsoryCredits: track?.compulsoryCredits,
          electiveCredits: track?.electiveCredits,
          sortOrder: track?.sortOrder,
          description: track?.description,
        }}
        onFinish={submit}
      >
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item
              name="trackCode"
              label="Mã định hướng"
              rules={TRACK_CODE_RULES}
            >
              <Input placeholder="Ví dụ: CNPM" />
            </Form.Item>
          </Col>
          <Col xs={24} md={16}>
            <Form.Item
              name="trackName"
              label="Tên định hướng"
              rules={TRACK_NAME_RULES}
            >
              <Input placeholder="Ví dụ: Công nghệ phần mềm" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="englishName"
          label="Tên tiếng Anh"
          rules={TRACK_ENGLISH_NAME_RULES}
        >
          <Input placeholder="Ví dụ: Software Engineering" />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item
              name="compulsoryCredits"
              label="Tín chỉ bắt buộc"
              rules={TRACK_CREDITS_RULES}
            >
              <Input inputMode="decimal" placeholder="Ví dụ: 8" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name="electiveCredits"
              label="Tín chỉ tự chọn"
              rules={TRACK_CREDITS_RULES}
            >
              <Input inputMode="decimal" placeholder="Ví dụ: 6" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="sortOrder" label="Thứ tự hiển thị">
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="description"
          label="Mô tả"
          rules={TRACK_DESC_RULES}
        >
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
