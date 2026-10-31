import { useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Flex,
  Form,
  Modal,
  Select,
  Typography,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import {
  applyFieldErrors,
  errorMessage,
} from '../../../shared/forms/applyFieldErrors';
import { CohortSelect } from '../../../shared/releases/CohortSelect';
import { SemesterSelect } from '../../../shared/releases/SemesterSelect';
import {
  RELEASE_OPTIONS_QUERY_ROOT,
  semesterLabel,
} from '../../../shared/releases/semesters';
import {
  useCohorts,
  useSemesters,
} from '../../../shared/releases/useReleaseOptions';
import type {
  AssignCohortVersionsInput,
  CohortVersionList,
  VersionRef,
} from '../api/releases';
import { ASSIGNMENT_REVISION_CHANGED } from '../constants/releaseLabels';
import {
  RELEASE_QUERY_ROOT,
  useAssignCohortVersions,
  useUpdateCohortVersion,
} from '../hooks/useReleases';
import { isIssuedVersion } from '../utils/versionComparison';
import { formatDecisionNumber } from '../../../shared/releases/decisionNumber';

interface CohortVersionAssignmentFormProps {
  assignments: CohortVersionList;
  versions: VersionRef[];
  assignmentId?: string;
  initialCohortId?: string;
  onCancel: () => void;
  onSaved: () => void;
}
type Values = Omit<AssignCohortVersionsInput, 'expectedRevision'>;
export function CohortVersionAssignmentForm({
  assignments,
  versions,
  assignmentId,
  initialCohortId,
  onCancel,
  onSaved,
}: CohortVersionAssignmentFormProps) {
  const [form] = Form.useForm<Values>();
  const cohorts = useCohorts();
  const semesters = useSemesters();
  const create = useAssignCohortVersions(assignments.programId);
  const update = useUpdateCohortVersion(
    assignments.programId,
    assignmentId ?? '',
  );
  const current = assignments.assignments.find(
    (row) => row.id === assignmentId,
  );
  const { modal, message } = App.useApp();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();
  const [reloadRequired, setReloadRequired] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const revision = useRef(assignments.revision);
  const saving = useRef(false);
  const confirmation = useRef<ReturnType<typeof modal.confirm> | null>(null);
  const prefilled = useRef(false);
  const pending = create.isPending || update.isPending;
  useEffect(() => {
    if (revision.current !== assignments.revision) {
      revision.current = assignments.revision;
      if (confirmation.current && !saving.current) {
        confirmation.current.destroy();
        confirmation.current = null;
        setConfirming(false);
        setError(ASSIGNMENT_REVISION_CHANGED);
      }
    }
  }, [assignments.revision]);
  useEffect(() => () => confirmation.current?.destroy(), []);
  useEffect(() => {
    if (!prefilled.current && cohorts.data) {
      prefilled.current = true;
      if (
        !assignmentId &&
        cohorts.data.some((cohort) => cohort.id === initialCohortId)
      )
        form.setFieldValue('cohortIds', [initialCohortId]);
    }
  }, [cohorts.data, initialCohortId, assignmentId, form]);
  const reload = async () => {
    setReloading(true);
    try {
      await Promise.all([
        queryClient.refetchQueries(
          { queryKey: RELEASE_QUERY_ROOT, type: 'active' },
          { throwOnError: true },
        ),
        queryClient.refetchQueries(
          { queryKey: RELEASE_OPTIONS_QUERY_ROOT, type: 'active' },
          { throwOnError: true },
        ),
      ]);
      setReloadRequired(false);
      setError('Dữ liệu đã nạp lại. Kiểm tra lựa chọn và xác nhận lại.');
    } catch {
      setError('Không nạp lại được dữ liệu. Vui lòng thử lại.');
    } finally {
      setReloading(false);
    }
  };
  const submit = (values: Values) => {
    const semester = semesters.data?.find(
      (row) => row.id === values.fromSemesterId,
    );
    const version =
      current?.version ??
      versions.find((row) => row.id === values.programVersionId);
    const cohortIds = current ? [current.cohort.id] : [...values.cohortIds];
    const selectedCohorts = (cohorts.data ?? []).filter((row) =>
      cohortIds.includes(row.id),
    );
    if (
      !semester?.startDate ||
      !version ||
      selectedCohorts.length !== cohortIds.length ||
      reloadRequired ||
      confirming
    )
      return;
    const capturedRevision = assignments.revision;
    const body = {
      programVersionId: version.id,
      fromSemesterId: values.fromSemesterId,
      cohortIds,
      expectedRevision: capturedRevision,
    };
    setConfirming(true);
    confirmation.current = modal.confirm({
      title: assignmentId
        ? 'Xác nhận sửa học kỳ áp dụng'
        : 'Xác nhận gán phiên bản',
      content: (
        <>
          <Typography.Paragraph>
            Phiên bản {version.versionNumber} · Quyết định{' '}
            {formatDecisionNumber(version.decisionNumber)}
          </Typography.Paragraph>
          <Typography.Paragraph>
            Khóa: {selectedCohorts.map((row) => row.cohortCode).join(', ')}
          </Typography.Paragraph>
          <Typography.Paragraph>
            Từ học kỳ: {semesterLabel(semester)}
          </Typography.Paragraph>
          <Alert
            type="warning"
            title="Nếu chọn học kỳ đã bắt đầu, kết quả tra cứu của các học kỳ trước có thể thay đổi."
          />
        </>
      ),
      okText: assignmentId
        ? 'Xác nhận sửa học kỳ áp dụng'
        : 'Xác nhận gán phiên bản',
      cancelText: 'Hủy',
      onCancel: () => {
        confirmation.current = null;
        setConfirming(false);
      },
      onOk: async () => {
        if (revision.current !== capturedRevision) {
          setError(ASSIGNMENT_REVISION_CHANGED);
          confirmation.current?.destroy();
          setConfirming(false);
          return;
        }
        saving.current = true;
        try {
          if (assignmentId)
            await update.mutateAsync({
              fromSemesterId: body.fromSemesterId,
              expectedRevision: body.expectedRevision,
            });
          else await create.mutateAsync(body);
          void message.success(
            assignmentId
              ? 'Đã sửa học kỳ áp dụng.'
              : 'Đã gán phiên bản cho các khóa đã chọn.',
          );
          onSaved();
        } catch (reason) {
          applyFieldErrors(form, reason);
          confirmation.current?.destroy();
          confirmation.current = null;
          setConfirming(false);
          if (
            reason instanceof ApiError &&
            reason.code === 'ASSIGNMENT_STATE_CHANGED'
          ) {
            setError(ASSIGNMENT_REVISION_CHANGED);
            setReloadRequired(true);
            void queryClient.invalidateQueries({
              queryKey: RELEASE_QUERY_ROOT,
            });
            void queryClient.invalidateQueries({
              queryKey: RELEASE_OPTIONS_QUERY_ROOT,
            });
          } else {
            setError(
              errorMessage(reason, 'Không lưu được lịch gán phiên bản.'),
            );
            void message.error(
              errorMessage(reason, 'Không lưu được lịch gán phiên bản.'),
            );
          }
        } finally {
          saving.current = false;
        }
      },
    });
  };
  return (
    <Modal
      open
      title={assignmentId ? 'Sửa học kỳ áp dụng' : 'Gán phiên bản'}
      footer={null}
      onCancel={onCancel}
      closable={!pending && !confirming}
      keyboard={!pending && !confirming}
      mask={{ closable: !pending && !confirming }}
    >
      {assignmentId && (
        <Alert
          type="warning"
          title="Sửa học kỳ áp dụng có thể làm thay đổi kết quả tra cứu của các học kỳ trước. Để chuyển sang phiên bản khác từ học kỳ mới, hãy tạo dòng gán mới."
        />
      )}
      {error && <Alert type="error" showIcon title={error} />}
      {(cohorts.error || semesters.error) && (
        <Alert
          type="error"
          title="Không tải được danh sách khóa hoặc học kỳ."
        />
      )}
      <Form
        form={form}
        layout="vertical"
        initialValues={{ fromSemesterId: current?.fromSemester.id }}
        onFinish={submit}
        disabled={pending || confirming}
      >
        {current ? (
          <Typography.Paragraph>
            Khóa {current.cohort.cohortCode} · Phiên bản{' '}
            {current.version.versionNumber} ·{' '}
            {formatDecisionNumber(current.version.decisionNumber)}
          </Typography.Paragraph>
        ) : (
          <>
            <Form.Item
              name="programVersionId"
              label="Phiên bản ban hành"
              rules={[
                { required: true, message: 'Chọn phiên bản đã ban hành.' },
              ]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={versions.filter(isIssuedVersion).map((row) => ({
                  value: row.id,
                  label: `${row.versionNumber} · ${formatDecisionNumber(row.decisionNumber)}`,
                }))}
              />
            </Form.Item>
            <Form.Item
              name="cohortIds"
              label="Các khóa được chọn"
              rules={[
                {
                  required: true,
                  type: 'array',
                  min: 1,
                  message: 'Chọn ít nhất một khóa.',
                },
              ]}
            >
              <CohortSelect />
            </Form.Item>
          </>
        )}
        <Form.Item
          name="fromSemesterId"
          label="Từ học kỳ"
          rules={[{ required: true, message: 'Chọn học kỳ có ngày bắt đầu.' }]}
        >
          <SemesterSelect />
        </Form.Item>
        <Flex gap="small">
          <Button
            type="primary"
            htmlType="submit"
            loading={pending}
            disabled={
              reloadRequired ||
              reloading ||
              Boolean(cohorts.error || semesters.error)
            }
          >
            Tiếp tục xác nhận
          </Button>
          <Button onClick={onCancel}>Hủy</Button>
        </Flex>
      </Form>
      {reloadRequired && (
        <Button loading={reloading} onClick={() => void reload()}>
          Nạp lại dữ liệu
        </Button>
      )}
    </Modal>
  );
}
