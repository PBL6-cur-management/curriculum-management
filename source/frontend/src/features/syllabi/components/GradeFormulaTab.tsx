import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Flex,
  Form,
  Input,
  Popconfirm,
  Switch,
  Table,
  Typography,
} from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useEditorRemountKey } from '../hooks/useEditorRemountKey';
import { ApiError } from '../../../shared/api/client';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type {
  AssessmentComponent,
  GradeFormula,
  ReplaceGradeFormulaRequest,
} from '../api/syllabi';
import {
  ADD_COMPONENT,
  COURSE_FAILING_SCORE,
  DISCARD_CANCEL,
  DISCARD_OK,
  DISCARD_TITLE,
  FORMULA_COLUMN_LABELS,
  FORMULA_ERRORS,
  FORMULA_SAVED,
  REMOVE_COMPONENT,
  REMOVE_PERSISTED_BODY,
  REMOVE_PERSISTED_TITLE,
  RULE_ONLY_NOTE,
  SAVE_FORMULA,
  SAVE_FORMULA_FAILED,
  weightGapText,
  CONDITION_EXPLANATION,
} from '../constants/gradeFormulaLabels';
import { useReplaceGradeFormula } from '../hooks/useGradeFormula';
import { SYLLABUS_QUERY_KEYS } from '../hooks/useSyllabus';
import type { EditorTabProps } from '../types';
import {
  assessmentFieldPath,
  FORMULA_VALUE_LIMITS,
  isValidPercent,
  isValidThreshold,
  normalizeComponentCode,
  normalizeDecimalInput,
  summarizeWeights,
} from '../utils/gradeFormulaValues';
import { StaleAssessmentAlert } from './StaleAssessmentAlert';

const STALE_CODE = 'ASSESSMENT_STALE';

interface RowValues {
  id?: string;
  componentCode: string;
  componentName: string;
  weight: string;
  assessmentForm: string;
  isConditional: boolean;
  conditionThreshold: string;
  failingScore: string;
}
interface FormulaValues {
  failingScore: string;
  components: RowValues[];
}

const EMPTY_ROW: RowValues = {
  componentCode: '',
  componentName: '',
  weight: '',
  assessmentForm: '',
  isConditional: false,
  conditionThreshold: '',
  failingScore: '',
};

const toRow = (component: AssessmentComponent): RowValues => ({
  id: component.id,
  componentCode: component.componentCode,
  componentName: component.componentName,
  weight: component.weight,
  assessmentForm: component.assessmentForm ?? '',
  isConditional: component.isConditional,
  conditionThreshold: component.conditionThreshold ?? '',
  failingScore: component.failingScore ?? '',
});

const toFormValues = (formula: GradeFormula): FormulaValues => ({
  failingScore: formula.failingScore ?? '',
  components: formula.components.map(toRow),
});

const decimalOrNull = (value: string | undefined) =>
  normalizeDecimalInput(value);

// The request body, and also the shape two states are compared in: strings only, trimmed, nothing derived.
function toBody(
  values: FormulaValues,
  expectedUpdatedAt: string,
): ReplaceGradeFormulaRequest {
  return {
    expectedUpdatedAt,
    failingScore: decimalOrNull(values.failingScore),
    components: values.components.map((row) => ({
      ...(row.id ? { id: row.id } : {}),
      componentCode: normalizeComponentCode(row.componentCode),
      componentName: (row.componentName ?? '').trim(),
      weight: decimalOrNull(row.weight) ?? '',
      assessmentForm: (row.assessmentForm ?? '').trim() || null,
      isConditional: row.isConditional,
      conditionThreshold: row.isConditional
        ? decimalOrNull(row.conditionThreshold)
        : null,
      failingScore: decimalOrNull(row.failingScore),
    })),
  };
}

const comparable = (values: FormulaValues) =>
  JSON.stringify(toBody(values, ''));

interface FormulaEditorProps extends EditorTabProps {
  onSaved: () => void;
  onReloaded: () => void;
}

function FormulaEditor({
  courseId,
  syllabus,
  onDirtyChange,
  onSaved,
  onReloaded,
}: FormulaEditorProps) {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<FormulaValues>();
  const save = useReplaceGradeFormula(courseId);
  const [stale, setStale] = useState(false);
  const [reloading, setReloading] = useState(false);
  const initial = useMemo(
    () => toFormValues(syllabus.gradingFormula),
    [syllabus.gradingFormula],
  );
  const baseline = useMemo(() => comparable(initial), [initial]);
  const watched = Form.useWatch([], form) as FormulaValues | undefined;
  const current = watched ?? initial;
  const rows = current.components ?? [];
  const summary = summarizeWeights(rows.map((row) => row?.weight ?? ''));
  const dirty = comparable({ ...current, components: rows }) !== baseline;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const submit = async (values: FormulaValues) => {
    try {
      await save.mutateAsync({
        syllabusId: syllabus.id,
        body: toBody(values, syllabus.updatedAt),
      });
      void message.success(FORMULA_SAVED);
      onSaved();
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === STALE_CODE) {
        setStale(true);
        return;
      }
      const named =
        reason instanceof ApiError
          ? (reason.details ?? []).filter((detail) =>
              /^(components|failingScore)/.test(detail.field),
            )
          : [];
      if (named.length > 0 && reason instanceof ApiError) {
        form.setFields(
          named.map((detail) => ({
            name: assessmentFieldPath(detail.field) as never,
            errors: [reason.message],
          })),
        );
        return;
      }
      void message.error(errorMessage(reason, SAVE_FORMULA_FAILED));
    }
  };

  const reload = () => {
    const proceed = async () => {
      setReloading(true);
      try {
        await queryClient.invalidateQueries({
          queryKey: SYLLABUS_QUERY_KEYS.courseRoot(courseId),
        });
        onReloaded();
      } finally {
        setReloading(false);
      }
    };
    if (!dirty) {
      void proceed();
      return;
    }
    modal.confirm({
      title: DISCARD_TITLE,
      okText: DISCARD_OK,
      cancelText: DISCARD_CANCEL,
      okButtonProps: { danger: true },
      onOk: proceed,
    });
  };

  const canSave = rows.length > 0 && summary.valid && dirty;

  return (
    <Flex vertical gap="middle">
      {stale && <StaleAssessmentAlert loading={reloading} onReload={reload} />}
      <Typography.Text type="secondary">{RULE_ONLY_NOTE}</Typography.Text>
      <Form<FormulaValues>
        form={form}
        layout="vertical"
        initialValues={initial}
        onFinish={(values) => void submit(values)}
      >
        <Form.Item
          name="failingScore"
          label={COURSE_FAILING_SCORE}
          extra={CONDITION_EXPLANATION}
          rules={[
            {
              validator: (_rule, value: string) =>
                isValidThreshold(value)
                  ? Promise.resolve()
                  : Promise.reject(new Error(FORMULA_ERRORS.threshold)),
            },
          ]}
          style={{ maxWidth: 240 }}
        >
          <Input inputMode="decimal" aria-label={COURSE_FAILING_SCORE} />
        </Form.Item>
        <Form.List name="components">
          {(fields, { add, remove }) => (
            <Flex vertical gap="small">
              <Table
                size="small"
                pagination={false}
                rowKey="key"
                dataSource={fields}
                scroll={{ x: 'max-content' }}
                columns={[
                  {
                    title: FORMULA_COLUMN_LABELS.code,
                    width: 110,
                    render: (_v, field) => (
                      <>
                        {/* Unregistered values are dropped from the form, so the id rides in a hidden field. */}
                        <Form.Item name={[field.name, 'id']} hidden noStyle>
                          <Input />
                        </Form.Item>
                        <Form.Item
                          name={[field.name, 'componentCode']}
                          style={{ margin: 0 }}
                          validateFirst
                          dependencies={[['components']]}
                          rules={[
                            {
                              validator: (_rule, value: string) => {
                                const code = normalizeComponentCode(value);
                                if (code === '')
                                  return Promise.reject(
                                    new Error(FORMULA_ERRORS.codeRequired),
                                  );
                                if (code.length > FORMULA_VALUE_LIMITS.CODE_MAX)
                                  return Promise.reject(
                                    new Error(FORMULA_ERRORS.codeMax),
                                  );
                                if (
                                  code.startsWith(
                                    FORMULA_VALUE_LIMITS.TEMPORARY_CODE_PREFIX,
                                  )
                                )
                                  return Promise.reject(
                                    new Error(FORMULA_ERRORS.codeReserved),
                                  );
                                const all = (
                                  (form.getFieldValue(
                                    'components',
                                  ) as RowValues[]) ?? []
                                ).map((row) =>
                                  normalizeComponentCode(row?.componentCode),
                                );
                                return all.filter((c) => c === code).length > 1
                                  ? Promise.reject(
                                      new Error(FORMULA_ERRORS.codeDuplicate),
                                    )
                                  : Promise.resolve();
                              },
                            },
                          ]}
                        >
                          <Input aria-label={FORMULA_COLUMN_LABELS.code} />
                        </Form.Item>
                      </>
                    ),
                  },
                  {
                    title: FORMULA_COLUMN_LABELS.name,
                    width: 200,
                    render: (_v, field) => (
                      <Form.Item
                        name={[field.name, 'componentName']}
                        style={{ margin: 0 }}
                        rules={[
                          {
                            required: true,
                            whitespace: true,
                            message: FORMULA_ERRORS.nameRequired,
                          },
                          {
                            max: FORMULA_VALUE_LIMITS.NAME_MAX,
                            message: FORMULA_ERRORS.nameMax,
                          },
                        ]}
                      >
                        <Input aria-label={FORMULA_COLUMN_LABELS.name} />
                      </Form.Item>
                    ),
                  },
                  {
                    title: FORMULA_COLUMN_LABELS.weight,
                    width: 110,
                    render: (_v, field) => (
                      <Form.Item
                        name={[field.name, 'weight']}
                        style={{ margin: 0 }}
                        rules={[
                          {
                            validator: (_rule, value: string) =>
                              isValidPercent(value)
                                ? Promise.resolve()
                                : Promise.reject(
                                    new Error(FORMULA_ERRORS.weight),
                                  ),
                          },
                        ]}
                      >
                        <Input
                          inputMode="decimal"
                          aria-label={FORMULA_COLUMN_LABELS.weight}
                        />
                      </Form.Item>
                    ),
                  },
                  {
                    title: FORMULA_COLUMN_LABELS.form,
                    width: 200,
                    render: (_v, field) => (
                      <Form.Item
                        name={[field.name, 'assessmentForm']}
                        style={{ margin: 0 }}
                        rules={[
                          {
                            max: FORMULA_VALUE_LIMITS.FORM_MAX,
                            message: FORMULA_ERRORS.formMax,
                          },
                        ]}
                      >
                        <Input aria-label={FORMULA_COLUMN_LABELS.form} />
                      </Form.Item>
                    ),
                  },
                  {
                    title: FORMULA_COLUMN_LABELS.conditional,
                    width: 120,
                    render: (_v, field) => (
                      <Form.Item
                        name={[field.name, 'isConditional']}
                        valuePropName="checked"
                        style={{ margin: 0 }}
                      >
                        <Switch
                          aria-label={FORMULA_COLUMN_LABELS.conditional}
                          onChange={(checked) => {
                            if (!checked)
                              form.setFieldValue(
                                [
                                  'components',
                                  field.name,
                                  'conditionThreshold',
                                ],
                                '',
                              );
                          }}
                        />
                      </Form.Item>
                    ),
                  },
                  {
                    title: FORMULA_COLUMN_LABELS.threshold,
                    width: 120,
                    render: (_v, field) => (
                      <Form.Item
                        noStyle
                        shouldUpdate={(
                          prev: FormulaValues,
                          next: FormulaValues,
                        ) =>
                          prev.components?.[field.name]?.isConditional !==
                          next.components?.[field.name]?.isConditional
                        }
                      >
                        {() => {
                          const conditional = form.getFieldValue([
                            'components',
                            field.name,
                            'isConditional',
                          ]) as boolean;
                          return (
                            <Form.Item
                              name={[field.name, 'conditionThreshold']}
                              style={{ margin: 0 }}
                              rules={[
                                {
                                  validator: (_rule, value: string) => {
                                    if (!conditional) return Promise.resolve();
                                    if (normalizeDecimalInput(value) === null)
                                      return Promise.reject(
                                        new Error(
                                          FORMULA_ERRORS.thresholdRequired,
                                        ),
                                      );
                                    return isValidThreshold(value)
                                      ? Promise.resolve()
                                      : Promise.reject(
                                          new Error(FORMULA_ERRORS.threshold),
                                        );
                                  },
                                },
                              ]}
                            >
                              <Input
                                inputMode="decimal"
                                disabled={!conditional}
                                aria-label={FORMULA_COLUMN_LABELS.threshold}
                              />
                            </Form.Item>
                          );
                        }}
                      </Form.Item>
                    ),
                  },
                  {
                    title: FORMULA_COLUMN_LABELS.failingScore,
                    width: 120,
                    render: (_v, field) => (
                      <Form.Item
                        name={[field.name, 'failingScore']}
                        style={{ margin: 0 }}
                        rules={[
                          {
                            validator: (_rule, value: string) =>
                              isValidThreshold(value)
                                ? Promise.resolve()
                                : Promise.reject(
                                    new Error(FORMULA_ERRORS.threshold),
                                  ),
                          },
                        ]}
                      >
                        <Input
                          inputMode="decimal"
                          aria-label={FORMULA_COLUMN_LABELS.failingScore}
                        />
                      </Form.Item>
                    ),
                  },
                  {
                    title: FORMULA_COLUMN_LABELS.actions,
                    width: 70,
                    render: (_v, field) => {
                      const persisted = Boolean(
                        form.getFieldValue(['components', field.name, 'id']),
                      );
                      const button = (
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          aria-label={REMOVE_COMPONENT}
                          onClick={
                            persisted ? undefined : () => remove(field.name)
                          }
                        />
                      );
                      return persisted ? (
                        <Popconfirm
                          title={REMOVE_PERSISTED_TITLE}
                          description={REMOVE_PERSISTED_BODY}
                          okText={REMOVE_COMPONENT}
                          cancelText={DISCARD_CANCEL}
                          okButtonProps={{ danger: true }}
                          onConfirm={() => remove(field.name)}
                        >
                          {button}
                        </Popconfirm>
                      ) : (
                        button
                      );
                    },
                  },
                ]}
              />
              <Flex justify="space-between" align="center" wrap gap="small">
                <Button
                  icon={<PlusOutlined />}
                  disabled={
                    fields.length >= FORMULA_VALUE_LIMITS.COMPONENTS_MAX
                  }
                  onClick={() => add({ ...EMPTY_ROW })}
                >
                  {ADD_COMPONENT}
                </Button>
                <Typography.Text
                  role="status"
                  aria-live="polite"
                  type={summary.valid ? 'success' : 'danger'}
                >
                  {weightGapText(summary)}
                </Typography.Text>
              </Flex>
            </Flex>
          )}
        </Form.List>
        <Flex justify="end" style={{ marginTop: 16 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={save.isPending}
            disabled={!canSave}
          >
            {SAVE_FORMULA}
          </Button>
        </Flex>
      </Form>
    </Flex>
  );
}

// Remounted after every save or reload so the form restarts from the server's rows and their ids.
export function GradeFormulaTab(props: EditorTabProps) {
  const { key, trackDirty, restart } = useEditorRemountKey(
    props.syllabus.id,
    props.syllabus.updatedAt,
    props.onDirtyChange,
  );
  return (
    <FormulaEditor
      key={key}
      {...props}
      onDirtyChange={trackDirty}
      onSaved={restart}
      onReloaded={restart}
    />
  );
}
