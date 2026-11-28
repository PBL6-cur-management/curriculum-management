import { Alert, Form, Modal, Select, Typography } from 'antd';
import { ApiError } from '../../../shared/api/client';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { StudentEnrollment } from '../api/students';
import {
  useSetEnrollmentTrack,
  useVersionTracks,
} from '../hooks/useStudents';

interface EnrollmentTrackModalProps {
  studentId: string;
  enrollment: StudentEnrollment;
  open: boolean;
  onClose: () => void;
}

interface TrackFormValues {
  trackId?: string | null;
}

export function EnrollmentTrackModal({
  studentId,
  enrollment,
  open,
  onClose,
}: EnrollmentTrackModalProps) {
  const [form] = Form.useForm<TrackFormValues>();
  const tracks = useVersionTracks(enrollment.appliedVersion.id, open);
  const mutation = useSetEnrollmentTrack(studentId);
  const conflict =
    mutation.error instanceof ApiError && mutation.error.status === 409;
  const hasTracks = Boolean(tracks.data?.length);

  return (
    <Modal
      open={open}
      title="Chọn định hướng / chuyên ngành con"
      okText="Lưu định hướng"
      cancelText="Hủy"
      confirmLoading={mutation.isPending}
      okButtonProps={{
        disabled:
          mutation.isPending ||
          tracks.isPending ||
          (!hasTracks && !enrollment.track),
      }}
      onCancel={() => {
        if (!mutation.isPending) onClose();
      }}
      onOk={() => form.submit()}
    >
      <Typography.Paragraph type="secondary">
        {enrollment.program.programCode} — {enrollment.program.programName} ·
        Phiên bản {enrollment.appliedVersion.versionNumber}
      </Typography.Paragraph>
      {mutation.error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title={
            conflict
              ? 'Ghi danh đã thay đổi. Hãy đóng hộp thoại, tải lại hồ sơ và thử lại.'
              : errorMessage(
                  mutation.error,
                  'Không cập nhật được định hướng / chuyên ngành con.',
                )
          }
        />
      )}
      {tracks.isSuccess && !hasTracks && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="Phiên bản chương trình này chưa khai báo định hướng / chuyên ngành con."
        />
      )}
      <Form
        form={form}
        layout="vertical"
        initialValues={{ trackId: enrollment.track?.id ?? undefined }}
        disabled={mutation.isPending}
        onFinish={async (values) => {
          try {
            await mutation.mutateAsync({
              enrollmentId: enrollment.id,
              body: {
                trackId: values.trackId ?? null,
                expectedEnrollmentUpdatedAt: enrollment.updatedAt,
              },
            });
            onClose();
          } catch {
            /* Mutation error stays visible inside modal. */
          }
        }}
      >
        <Form.Item name="trackId" label="Định hướng / Chuyên ngành con">
          <Select
            allowClear
            loading={tracks.isFetching}
            disabled={!hasTracks && !enrollment.track}
            placeholder="Chưa chọn định hướng (áp dụng khung chung)"
            options={tracks.data?.map((track) => ({
              value: track.id,
              label: `${track.trackCode} — ${track.trackName}`,
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
