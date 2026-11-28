import {
  Button,
  Flex,
  Form,
  Input,
  Radio,
  Segmented,
  Select,
} from 'antd';
import type { FormInstance } from 'antd';
import { useId, useRef } from 'react';
import { hasPermission } from '../../../shared/auth/permissions';
import { useMe } from '../../../shared/auth/useMe';
import { semesterLabel } from '../../../shared/releases/semesters';
import {
  useCohorts,
  useSemesters,
} from '../../../shared/releases/useReleaseOptions';
import type {
  ChangeRequestType,
  ChangeTargetType,
} from '../api/changeRequests';
import {
  ORIGIN_LABELS,
  PROGRAM_LEVEL_REQUEST_HINT,
  REQUEST_TYPE_LABELS,
  TARGET_FIELD_HINT,
  TARGET_TYPE_LABELS,
  UNSUPPORTED_TYPE_HINT,
} from '../constants/changeRequestLabels';
import { REASON_MAX } from '../constants/changeRequestLimits';
import { useTargetLabel } from '../hooks/useChangeRequests';
import {
  basisNumberRules,
  reasonRules,
  titleRules,
  type RequestHeaderValues,
} from '../schema/requestRules';
import {
  EDIT_PERMISSIONS,
  TYPE_TARGETS,
  UNSUPPORTED_TYPES,
} from '../requestTypes';
import { TargetSelect } from './TargetSelect';

interface RequestHeaderFormProps {
  form: FormInstance<RequestHeaderValues>;
  mode: 'create' | 'edit';
  types: readonly ChangeRequestType[];
  initialValues?: Partial<RequestHeaderValues>;
  // "CODE — name" of the immutable target when editing an existing request.
  targetLabel?: string;
  onFinish: (values: RequestHeaderValues) => void;
  onCancel?: () => void;
  submitting: boolean;
}

// Header of a request: type, target, title, reason, origin and the basis document (US-054, US-055).
export function RequestHeaderForm({
  form,
  mode,
  types,
  initialValues,
  targetLabel,
  onFinish,
  onCancel,
  submitting,
}: RequestHeaderFormProps) {
  const { data: me } = useMe();
  const { data: semesters = [], isPending: semestersPending } = useSemesters();
  const { data: cohorts = [], isPending: cohortsPending } = useCohorts();
  const canCreateProgramRequest =
    me?.roles.some(
      (role) => role.roleCode === 'R1' || role.roleCode === 'R3',
    ) ?? false;
  const requestType = Form.useWatch('requestType', form);
  const targetType = Form.useWatch('targetType', form);
  const targetId = Form.useWatch('targetId', form);
  const origin = Form.useWatch('origin', form);
  const kinds = requestType ? TYPE_TARGETS[requestType] : [];
  const editing = mode === 'edit';
  const readonlyTargetId = useId();
  const currentLabel = useTargetLabel(
    editing ? undefined : targetType,
    editing ? undefined : targetId || undefined,
  );

  // Remember chosen target per kind so switching requestType/kind preserves prefill and selections
  const rememberedTargets = useRef<Partial<Record<ChangeTargetType, string>>>(
    initialValues?.targetType && initialValues.targetId
      ? { [initialValues.targetType]: initialValues.targetId }
      : {},
  );

  const isProgramOnlyType = (type: ChangeRequestType) =>
    type === 'CURRICULUM' || type === 'PROGRAM_INFO';
  const hasProgramLevelType = types.some(
    (type) =>
      isProgramOnlyType(type) ||
      (type === 'OUTCOME' && TYPE_TARGETS[type].includes('PROGRAM')),
  );

  // A type is offered to someone who holds one of its edit permissions somewhere; the server decides on the target.
  // Program-level CR types require R1 or R3 (Workflow B).
  const typeOptions = types.map((type) => {
    const unsupported = UNSUPPORTED_TYPES.includes(type);
    const programBlocked = isProgramOnlyType(type) && !canCreateProgramRequest;
    const allowed =
      !unsupported &&
      !programBlocked &&
      EDIT_PERMISSIONS[type].some((code) => hasPermission(me, code));
    return {
      value: type,
      disabled: !allowed,
      label: unsupported
        ? `${REQUEST_TYPE_LABELS[type]} — ${UNSUPPORTED_TYPE_HINT}`
        : REQUEST_TYPE_LABELS[type],
    };
  });

  const onTypeChange = (next: ChangeRequestType) => {
    const supportedKinds = TYPE_TARGETS[next].filter(
      (kind) =>
        !(next === 'OUTCOME' && kind === 'PROGRAM' && !canCreateProgramRequest),
    );
    const currentType = form.getFieldValue('targetType') as
      | ChangeTargetType
      | undefined;
    if (currentType && supportedKinds.includes(currentType)) return;

    const initialKind = initialValues?.targetType;
    const nextKind =
      initialKind &&
      supportedKinds.includes(initialKind) &&
      rememberedTargets.current[initialKind]
        ? initialKind
        : (supportedKinds.find((kind) => rememberedTargets.current[kind]) ??
          supportedKinds[0]);
    form.setFieldsValue({
      targetType: nextKind,
      targetId: rememberedTargets.current[nextKind] ?? '',
    });
  };

  const selectedLabel = targetId
    ? {
        id: targetId,
        label:
          currentLabel.data ??
          (currentLabel.isError
            ? 'Không tải được thông tin đối tượng'
            : 'Đang tải thông tin đối tượng…'),
      }
    : undefined;

  return (
    <Form<RequestHeaderValues>
      form={form}
      layout="vertical"
      initialValues={{ origin: 'FACULTY', ...initialValues }}
      onValuesChange={(changed: Partial<RequestHeaderValues>, values) => {
        if ('targetId' in changed && values.targetType) {
          rememberedTargets.current[values.targetType] = values.targetId;
        }
      }}
      onFinish={onFinish}
      style={{ maxWidth: 720 }}
    >
      <Form.Item
        name="requestType"
        label="Loại đề xuất"
        rules={[{ required: true, message: 'Chọn loại đề xuất.' }]}
        extra={
          !editing && !canCreateProgramRequest && hasProgramLevelType
            ? PROGRAM_LEVEL_REQUEST_HINT
            : undefined
        }
      >
        <Select
          options={typeOptions}
          disabled={editing || types.length === 1}
          onChange={onTypeChange}
          placeholder="Chọn loại đề xuất"
        />
      </Form.Item>
      <Form.Item name="targetType" hidden>
        <Input />
      </Form.Item>
      {kinds.length > 1 && !editing && (
        <Form.Item label="Đối tượng thuộc loại">
          <Segmented
            value={targetType}
            options={kinds.map((kind) => ({
              value: kind,
              label: TARGET_TYPE_LABELS[kind],
              disabled:
                requestType === 'OUTCOME' &&
                kind === 'PROGRAM' &&
                !canCreateProgramRequest,
            }))}
            onChange={(next) => {
              form.setFieldsValue({
                targetType: next,
                targetId: rememberedTargets.current[next] ?? '',
              });
            }}
          />
        </Form.Item>
      )}
      {editing ? (
        <Form.Item
          htmlFor={readonlyTargetId}
          label={targetType ? TARGET_TYPE_LABELS[targetType] : 'Đối tượng'}
        >
          <Input id={readonlyTargetId} disabled value={targetLabel} />
        </Form.Item>
      ) : (
        <Form.Item
          name="targetId"
          label={targetType ? TARGET_TYPE_LABELS[targetType] : 'Đối tượng'}
          rules={[{ required: true, message: TARGET_FIELD_HINT }]}
          extra={TARGET_FIELD_HINT}
        >
          <TargetSelect
            targetType={targetType ?? kinds[0] ?? 'COURSE'}
            selectedLabel={selectedLabel}
          />
        </Form.Item>
      )}
      <Form.Item name="title" label="Tiêu đề" rules={titleRules}>
        <Input />
      </Form.Item>
      <Form.Item name="reason" label="Lý do" rules={reasonRules}>
        <Input.TextArea rows={4} maxLength={REASON_MAX} showCount />
      </Form.Item>
      <Form.Item name="origin" label="Nguồn đề xuất">
        <Radio.Group
          options={(['FACULTY', 'UNIVERSITY'] as const).map((origin) => ({
            value: origin,
            label: ORIGIN_LABELS[origin],
          }))}
        />
      </Form.Item>
      <Form.Item
        name="basisDocumentNumber"
        label="Số văn bản"
        dependencies={['origin']}
        required={origin === 'UNIVERSITY'}
        rules={basisNumberRules(origin)}
      >
        <Input placeholder="Ví dụ 123/TTr-CNTT hoặc 123/QĐ-ĐHBK" />
      </Form.Item>
      <Form.Item name="effectiveSemesterId" label="Học kỳ hiệu lực dự kiến">
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          loading={semestersPending}
          placeholder="Chọn học kỳ hiệu lực dự kiến"
          options={semesters.map((semester) => ({
            value: semester.id,
            label: semesterLabel(semester),
          }))}
        />
      </Form.Item>
      <Form.Item name="cohortIds" label="Các khóa áp dụng dự kiến">
        <Select
          mode="multiple"
          allowClear
          showSearch
          optionFilterProp="label"
          loading={cohortsPending}
          placeholder="Chọn các khóa áp dụng dự kiến"
          options={cohorts.map((cohort) => ({
            value: cohort.id,
            label: `${cohort.cohortCode} (tuyển sinh ${cohort.intakeYear})`,
          }))}
        />
      </Form.Item>
      <Flex gap="small">
        <Button type="primary" htmlType="submit" loading={submitting}>
          {editing ? 'Lưu' : 'Tạo đề xuất'}
        </Button>
        {onCancel && <Button onClick={onCancel}>Hủy</Button>}
      </Flex>
    </Form>
  );
}
