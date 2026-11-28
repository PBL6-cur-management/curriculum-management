import { useState } from 'react';
import {
  Alert,
  Button,
  Flex,
  Form,
  Input,
  Modal,
  Select,
  Table,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { StatusTag } from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import { semesterLabel } from '../../../shared/releases/semesters';
import type {
  BulkTransferResult,
  BulkTransferResultItem,
} from '../api/students';
import {
  BULK_TRANSFER_RESULT_COLORS,
  BULK_TRANSFER_RESULT_LABELS,
} from '../constants/studentLabels';
import {
  useBulkTransferStudents,
  useEnrollmentTargets,
  useStudentPrograms,
  useStudentSemesters,
  useVersionTracks,
} from '../hooks/useStudents';
import {
  BULK_TRANSFER_DECISION_RULES,
  BULK_TRANSFER_REASON_RULES,
} from '../schema/enrollmentRules';

interface BulkTransferModalProps {
  open: boolean;
  studentIds: string[];
  onClose: () => void;
  onSucceeded: () => void;
}

interface BulkTransferFormValues {
  effectiveSemesterId: string;
  programId: string;
  targetVersionId: string;
  trackId?: string;
  decisionNumber?: string;
  reason?: string;
}

export function BulkTransferModal({
  open,
  studentIds,
  onClose,
  onSucceeded,
}: BulkTransferModalProps) {
  const [form] = Form.useForm<BulkTransferFormValues>();
  const [summary, setSummary] = useState<BulkTransferResult | null>(null);
  const [basisError, setBasisError] = useState<string | null>(null);
  const semesterId = Form.useWatch('effectiveSemesterId', form) ?? '';
  const programId = Form.useWatch('programId', form) ?? '';
  const targetVersionId = Form.useWatch('targetVersionId', form) ?? '';
  const anchorStudentId = studentIds[0] ?? '';

  const semesters = useStudentSemesters();
  const programs = useStudentPrograms(semesterId);
  const targets = useEnrollmentTargets(
    anchorStudentId,
    { programId, semesterId },
    open,
  );
  const tracks = useVersionTracks(
    targetVersionId,
    open && Boolean(targetVersionId),
  );
  const bulkTransfer = useBulkTransferStudents();

  function handleClose() {
    if (bulkTransfer.isPending) return;
    if (summary && summary.succeeded > 0) {
      onSucceeded();
    }
    onClose();
  }

  return (
    <Modal
      open={open}
      title={`Chuyển CTĐT hàng loạt (${studentIds.length} sinh viên)`}
      width={680}
      onCancel={handleClose}
      footer={
        summary ? (
          <Button type="primary" onClick={handleClose}>
            Đóng
          </Button>
        ) : (
          <Flex justify="end" gap={8}>
            <Button disabled={bulkTransfer.isPending} onClick={handleClose}>
              Hủy
            </Button>
            <Button
              type="primary"
              loading={bulkTransfer.isPending}
              disabled={
                bulkTransfer.isPending ||
                targets.isFetching ||
                !targets.data?.length
              }
              onClick={() => form.submit()}
            >
              Thực hiện chuyển CTĐT
            </Button>
          </Flex>
        )
      }
    >
      {summary ? (
        <Flex vertical gap="middle">
          <Alert
            type={
              summary.failed === 0
                ? 'success'
                : summary.succeeded === 0
                  ? 'error'
                  : 'warning'
            }
            showIcon
            title={`Đã xử lý ${summary.total} sinh viên: thành công ${summary.succeeded}, thất bại ${summary.failed}.`}
          />
          <Table<BulkTransferResultItem>
            rowKey={(item, index) => `${item.studentCode}-${index}`}
            dataSource={summary.results}
            size="small"
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            columns={[
              {
                title: 'Mã sinh viên',
                dataIndex: 'studentCode',
                render: (code: string) => (
                  <Typography.Text code>{code}</Typography.Text>
                ),
              },
              {
                title: 'Kết quả',
                dataIndex: 'status',
                render: (status: BulkTransferResultItem['status']) => (
                  <StatusTag
                    status={status}
                    colorMap={BULK_TRANSFER_RESULT_COLORS}
                    labelMap={BULK_TRANSFER_RESULT_LABELS}
                  />
                ),
              },
              {
                title: 'Chi tiết',
                render: (_, item) =>
                  item.status === 'OK'
                    ? 'Đã chuyển chương trình'
                    : (item.errorMessage ?? 'Không thể chuyển chương trình.'),
              },
            ]}
          />
        </Flex>
      ) : (
        <Flex vertical gap="middle">
          {bulkTransfer.error && (
            <Alert
              type="error"
              showIcon
              title={errorMessage(
                bulkTransfer.error,
                'Không thực hiện được chuyển CTĐT hàng loạt. Hãy kiểm tra thông tin và thử lại.',
              )}
            />
          )}
          {basisError && <Alert type="error" showIcon title={basisError} />}
          <Form
            form={form}
            layout="vertical"
            disabled={bulkTransfer.isPending}
            onValuesChange={() => setBasisError(null)}
            onFinish={async (values) => {
              const decision = values.decisionNumber?.trim() ?? '';
              const reason = values.reason?.trim() ?? '';
              const basisDecision = [decision, reason]
                .filter(Boolean)
                .join(' — ');
              if (!basisDecision) {
                setBasisError(
                  'Nhập ít nhất số quyết định hoặc lý do / căn cứ chuyển.',
                );
                return;
              }
              try {
                const result = await bulkTransfer.mutateAsync({
                  studentIds,
                  targetVersionId: values.targetVersionId,
                  fromSemesterId: values.effectiveSemesterId,
                  basisDecision,
                  ...(values.trackId ? { trackId: values.trackId } : {}),
                });
                setSummary(result);
              } catch {
                /* Mutation error is rendered above the form. */
              }
            }}
          >
            <Form.Item
              name="effectiveSemesterId"
              label="Học kỳ hiệu lực"
              rules={[{ required: true, message: 'Chọn học kỳ hiệu lực.' }]}
            >
              <Select
                placeholder="Chọn học kỳ bắt đầu áp dụng"
                options={semesters.data?.map((semester) => ({
                  value: semester.id,
                  label: semesterLabel(semester),
                  disabled:
                    !semester.startDate ||
                    dayjs(semester.startDate).isAfter(dayjs(), 'day'),
                }))}
                onChange={() =>
                  form.setFieldsValue({
                    programId: undefined,
                    targetVersionId: undefined,
                    trackId: undefined,
                  })
                }
              />
            </Form.Item>
            <Form.Item
              name="programId"
              label="Chương trình đích"
              rules={[{ required: true, message: 'Chọn chương trình đích.' }]}
            >
              <Select
                disabled={!semesterId}
                placeholder="Chọn chương trình đào tạo đích"
                options={programs.data?.map((program) => ({
                  value: program.id,
                  label: `${program.programCode} — ${program.programName}`,
                }))}
                onChange={() =>
                  form.setFieldsValue({
                    targetVersionId: undefined,
                    trackId: undefined,
                  })
                }
              />
            </Form.Item>
            <Form.Item
              name="targetVersionId"
              label="Phiên bản đã ban hành"
              rules={[
                { required: true, message: 'Chọn phiên bản đã ban hành.' },
              ]}
            >
              <Select
                loading={targets.isFetching}
                disabled={!programId || targets.isFetching}
                placeholder="Chọn phiên bản chương trình"
                options={targets.data?.map((target) => ({
                  value: target.version.id,
                  label: `${target.version.versionNumber} · ${target.effectiveSemester.semesterCode}`,
                }))}
                onChange={() => form.setFieldValue('trackId', undefined)}
              />
            </Form.Item>
            {programId &&
              semesterId &&
              targets.isSuccess &&
              !targets.data.length && (
                <Alert
                  type="warning"
                  showIcon
                  title="Chưa có phiên bản đã ban hành phù hợp với chương trình và học kỳ này."
                />
              )}
            {Boolean(tracks.data?.length) && (
              <Form.Item
                name="trackId"
                label="Định hướng / Chuyên ngành con (tùy chọn)"
              >
                <Select
                  allowClear
                  loading={tracks.isFetching}
                  placeholder="Chưa chọn định hướng"
                  options={tracks.data?.map((track) => ({
                    value: track.id,
                    label: `${track.trackCode} — ${track.trackName}`,
                  }))}
                />
              </Form.Item>
            )}
            <Form.Item
              name="decisionNumber"
              label="Số quyết định (tùy chọn)"
              rules={BULK_TRANSFER_DECISION_RULES}
            >
              <Input placeholder="Ví dụ: QĐ-125/ĐHBK" />
            </Form.Item>
            <Form.Item
              name="reason"
              label="Lý do / căn cứ chuyển"
              rules={BULK_TRANSFER_REASON_RULES}
            >
              <Input.TextArea
                rows={3}
                placeholder="Nhập căn cứ hoặc lý do chuyển chương trình đào tạo"
              />
            </Form.Item>
          </Form>
        </Flex>
      )}
    </Modal>
  );
}
