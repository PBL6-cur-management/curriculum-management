import { useRef, useState } from 'react';
import { Alert, App, Button, Form, Input, Modal, Select } from 'antd';
import dayjs from 'dayjs';
import { ApiError } from '../../../shared/api/client';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import { semesterLabel } from '../../../shared/releases/semesters';
import type {
  EnrollmentCommand,
  StudentDetail,
  StudentEnrollment,
} from '../api/students';
import { ENROLLMENT_OPERATION_LABELS } from '../constants/studentLabels';
import {
  useCreateStudentEnrollment,
  useEnrollmentTargets,
  useStudentPrograms,
  useStudentSemesters,
} from '../hooks/useStudents';
import { enrollmentBasisRules } from '../schema/enrollmentRules';

interface EnrollmentCommandModalProps {
  student: StudentDetail;
  sourceEnrollment: StudentEnrollment | null;
  operation: EnrollmentCommand['operation'];
  open: boolean;
  onClose: () => void;
  onReload: () => Promise<StudentDetail | null>;
}
interface EnrollmentValues {
  programId: string;
  fromSemesterId: string;
  targetVersionId: string;
  basisDecision: string;
}
export function EnrollmentCommandModal({
  student,
  sourceEnrollment,
  operation,
  open,
  onClose,
  onReload,
}: EnrollmentCommandModalProps) {
  const [form] = Form.useForm<EnrollmentValues>();
  const [snapshot, setSnapshot] = useState({ student, sourceEnrollment });
  const [confirming, setConfirming] = useState(false);
  const confirmationLock = useRef(false);
  const [reloading, setReloading] = useState(false);
  const semesterId = Form.useWatch('fromSemesterId', form) ?? '';
  const programId = Form.useWatch('programId', form) ?? '';
  const semesters = useStudentSemesters();
  const programs = useStudentPrograms(semesterId);
  const targets = useEnrollmentTargets(
    student.id,
    { programId, semesterId },
    open,
  );
  const mutation = useCreateStudentEnrollment(student.id);
  const { modal } = App.useApp();
  const conflict =
    mutation.error instanceof ApiError && mutation.error.status === 409;
  const denied =
    mutation.error instanceof ApiError && mutation.error.status === 403;
  const pending = confirming || mutation.isPending || reloading;
  return (
    <Modal
      open={open}
      title={ENROLLMENT_OPERATION_LABELS[operation]}
      okText="Xem lại và xác nhận"
      cancelText="Hủy"
      confirmLoading={pending}
      okButtonProps={{
        disabled:
          pending ||
          conflict ||
          denied ||
          targets.isFetching ||
          !targets.data?.length,
      }}
      onCancel={() => {
        if (!pending) onClose();
      }}
      onOk={() => form.submit()}
    >
      {mutation.error && (
        <Alert
          type="error"
          showIcon
          title={
            conflict
              ? 'Hồ sơ đã thay đổi. Tải lại, kiểm tra căn cứ và xác nhận lại; nội dung đang nhập được giữ.'
              : denied
                ? 'Quyền quản lý ghi danh đã thay đổi. Không thể gửi lại yêu cầu.'
                : errorMessage(
                    mutation.error,
                    'Không cập nhật được ghi danh. Hãy kiểm tra lại thông tin.',
                  )
          }
          action={
            conflict ? (
              <Button
                loading={reloading}
                onClick={async () => {
                  setReloading(true);
                  try {
                    const updated = await onReload();
                    if (updated) {
                      setSnapshot({
                        student: updated,
                        sourceEnrollment:
                          updated.enrollments.find(
                            (enrollment) =>
                              enrollment.id === sourceEnrollment?.id,
                          ) ?? null,
                      });
                      mutation.reset();
                    }
                  } finally {
                    setReloading(false);
                  }
                }}
              >
                Tải lại hồ sơ
              </Button>
            ) : undefined
          }
        />
      )}
      {[semesters, programs, targets].some((query) => query.isError) && (
        <Alert
          type="error"
          showIcon
          title="Không tải được lựa chọn ghi danh. Hãy đóng và mở lại biểu mẫu."
        />
      )}
      <Form
        form={form}
        layout="vertical"
        disabled={pending || denied}
        onFinish={(values) => {
          if (
            confirmationLock.current ||
            mutation.isPending ||
            conflict ||
            denied
          )
            return;
          const target = targets.data?.find(
            (entry) => entry.version.id === values.targetVersionId,
          );
          const semester = semesters.data?.find(
            (entry) => entry.id === values.fromSemesterId,
          );
          if (
            !target ||
            !semester?.startDate ||
            dayjs(semester.startDate).isAfter(dayjs(), 'day')
          )
            return;
          const body: EnrollmentCommand = {
            operation,
            targetVersionId: values.targetVersionId,
            fromSemesterId: values.fromSemesterId,
            basisDecision: values.basisDecision.trim(),
            expectedStudentUpdatedAt: snapshot.student.updatedAt,
            ...(operation === 'TRANSFER' && snapshot.sourceEnrollment
              ? {
                  sourceEnrollmentId: snapshot.sourceEnrollment.id,
                  expectedEnrollmentUpdatedAt:
                    snapshot.sourceEnrollment.updatedAt,
                }
              : {}),
          };
          confirmationLock.current = true;
          setConfirming(true);
          modal.confirm({
            title: ENROLLMENT_OPERATION_LABELS[operation],
            content: `${snapshot.sourceEnrollment?.program.programCode ?? 'Chưa ghi danh'} → ${target.program.programCode} / ${target.version.versionNumber}; từ ${semester.semesterCode}; căn cứ: ${body.basisDecision}`,
            okText: 'Xác nhận ghi danh',
            cancelText: 'Quay lại',
            onOk: async () => {
              try {
                await mutation.mutateAsync(body);
                onClose();
              } catch {
                /* Mutation error remains visible in the form. */
              }
            },
            afterClose: () => {
              confirmationLock.current = false;
              setConfirming(false);
            },
          });
        }}
      >
        <Form.Item
          name="fromSemesterId"
          label="Học kỳ bắt đầu"
          rules={[{ required: true, message: 'Chọn học kỳ bắt đầu.' }]}
        >
          <Select
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
            options={programs.data?.map((program) => ({
              value: program.id,
              label: `${program.programCode} — ${program.programName}`,
            }))}
            onChange={() => form.setFieldValue('targetVersionId', undefined)}
          />
        </Form.Item>
        <Form.Item
          name="targetVersionId"
          label="Phiên bản đã ban hành"
          rules={[{ required: true, message: 'Chọn phiên bản đã ban hành.' }]}
        >
          <Select
            loading={targets.isFetching}
            disabled={!programId || targets.isFetching}
            options={targets.data?.map((target) => ({
              value: target.version.id,
              label: `${target.version.versionNumber} · ${target.effectiveSemester.semesterCode}`,
            }))}
          />
        </Form.Item>
        {programId &&
          semesterId &&
          targets.isSuccess &&
          !targets.data.length && (
            <Alert
              type="warning"
              title="Chưa có phiên bản đã ban hành phù hợp với chương trình và học kỳ này."
            />
          )}
        <Form.Item
          name="basisDecision"
          label="Căn cứ / số quyết định"
          rules={enrollmentBasisRules}
        >
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
