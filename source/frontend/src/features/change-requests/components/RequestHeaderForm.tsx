import { Button, Flex, Form, Input, Radio, Segmented, Select } from 'antd';
import type { FormInstance } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { hasPermission } from '../../../shared/auth/permissions';
import { useMe } from '../../../shared/auth/useMe';
import type {
  ChangeRequestType,
  ChangeTargetType,
} from '../api/changeRequests';
import {
  ORIGIN_LABELS,
  REQUEST_TYPE_LABELS,
  TARGET_FIELD_HINT,
  TARGET_TYPE_LABELS,
  UNSUPPORTED_TYPE_HINT,
} from '../constants/changeRequestLabels';
import { REASON_MAX } from '../constants/changeRequestLimits';
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
  // "CODE — name" of the prefilled target, so the picker shows more than an id.
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
  const requestType = Form.useWatch('requestType', form);
  const targetType = Form.useWatch('targetType', form);
  const targetId = Form.useWatch('targetId', form);
  const origin = Form.useWatch('origin', form);
  const kinds = requestType ? TYPE_TARGETS[requestType] : [];
  const editing = mode === 'edit';

  // Remember chosen target per kind so switching requestType/kind preserves prefill and selections
  const rememberedTargets = useRef<Partial<Record<ChangeTargetType, string>>>(
    initialValues?.targetType && initialValues.targetId
      ? { [initialValues.targetType]: initialValues.targetId }
      : {},
  );
  const [rememberedLabels, setRememberedLabels] = useState<
    Partial<Record<ChangeTargetType, string>>
  >(
    initialValues?.targetType && targetLabel
      ? { [initialValues.targetType]: targetLabel }
      : {},
  );

  useEffect(() => {
    if (targetType && targetId) {
      rememberedTargets.current[targetType] = targetId;
    }
  }, [targetType, targetId]);

  useEffect(() => {
    if (targetType && targetLabel) {
      setRememberedLabels((prev) => ({
        ...prev,
        [targetType]: targetLabel,
      }));
    }
  }, [targetType, targetLabel]);

  // A type is offered to someone who holds one of its edit permissions somewhere; the server decides on the target.
  const typeOptions = types.map((type) => {
    const unsupported = UNSUPPORTED_TYPES.includes(type);
    const allowed =
      !unsupported &&
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
    const supportedKinds = TYPE_TARGETS[next];
    const currentType = form.getFieldValue('targetType') as
      | ChangeTargetType
      | undefined;
    const currentId = form.getFieldValue('targetId') as string | undefined;

    // 1. If current targetType is supported by the new requestType: keep targetType and targetId
    if (currentType && supportedKinds.includes(currentType)) {
      const idToKeep =
        currentId ||
        rememberedTargets.current[currentType] ||
        (initialValues?.targetType === currentType
          ? initialValues.targetId
          : '') ||
        '';
      form.setFieldsValue({
        targetType: currentType,
        targetId: idToKeep,
      });
      return;
    }

    // 2. If current targetType is not supported, check if initial prefilled target is supported
    if (
      initialValues?.targetType &&
      supportedKinds.includes(initialValues.targetType) &&
      (rememberedTargets.current[initialValues.targetType] ??
        initialValues.targetId)
    ) {
      form.setFieldsValue({
        targetType: initialValues.targetType,
        targetId:
          rememberedTargets.current[initialValues.targetType] ??
          initialValues.targetId ??
          '',
      });
      return;
    }

    // 3. Check if any other supported kind has a remembered target
    const rememberedKind = supportedKinds.find((kind) =>
      Boolean(rememberedTargets.current[kind]),
    );
    if (rememberedKind) {
      form.setFieldsValue({
        targetType: rememberedKind,
        targetId: rememberedTargets.current[rememberedKind] ?? '',
      });
      return;
    }

    // 4. Fallback to first supported kind and reset targetId
    form.setFieldsValue({
      targetType: supportedKinds[0],
      targetId: '',
    });
  };

  const isPrefilledTarget =
    targetType === initialValues?.targetType &&
    targetId === initialValues?.targetId;
  const initialLabelForTarget =
    (targetType && rememberedLabels[targetType]) ||
    (isPrefilledTarget ? targetLabel : undefined);

  return (
    <Form<RequestHeaderValues>
      form={form}
      layout="vertical"
      initialValues={{ origin: 'FACULTY', ...initialValues }}
      onFinish={onFinish}
      style={{ maxWidth: 720 }}
    >
      <Form.Item
        name="requestType"
        label="Loại đề xuất"
        rules={[{ required: true, message: 'Chọn loại đề xuất.' }]}
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
            }))}
            onChange={(next) => {
              const rememberedId =
                rememberedTargets.current[next] ??
                (next === initialValues?.targetType
                  ? (initialValues.targetId ?? '')
                  : '');
              form.setFieldsValue({
                targetType: next,
                targetId: rememberedId,
              });
            }}
          />
        </Form.Item>
      )}
      <Form.Item
        name="targetId"
        label={targetType ? TARGET_TYPE_LABELS[targetType] : 'Đối tượng'}
        rules={[{ required: true, message: TARGET_FIELD_HINT }]}
        extra={editing ? undefined : TARGET_FIELD_HINT}
      >
        {editing ? (
          <Input disabled value={targetLabel} placeholder={targetLabel} />
        ) : (
          <TargetSelect
            targetType={targetType ?? kinds[0] ?? 'COURSE'}
            initialLabel={initialLabelForTarget}
          />
        )}
      </Form.Item>
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
        label="Số văn bản căn cứ"
        dependencies={['origin']}
        required={origin === 'UNIVERSITY'}
        rules={basisNumberRules(origin)}
      >
        <Input placeholder="Ví dụ 123/QĐ-ĐHBK" />
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
