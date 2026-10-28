import { App, Button, Checkbox, Empty, Flex, Input, Table, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useEditorRemountKey } from '../hooks/useEditorRemountKey';
import { ApiError } from '../../../shared/api/client';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { AssessmentComponent, Clo } from '../api/syllabi';
import {
  CLO_WEIGHT,
  DISCARD_CANCEL,
  DISCARD_OK,
  DISCARD_TITLE,
  FORMULA_ERRORS,
  GO_TO_CLO_TAB,
  GO_TO_FORMULA_TAB,
  MAPPINGS_SAVED,
  NO_CLOS_TO_MAP,
  SAVE_FORMULA_FIRST,
  SAVE_MAPPINGS,
  SAVE_MAPPINGS_FAILED,
} from '../constants/gradeFormulaLabels';
import { useReplaceAssessmentMappings } from '../hooks/useGradeFormula';
import { SYLLABUS_QUERY_KEYS } from '../hooks/useSyllabus';
import type { EditorTabProps } from '../types';
import {
  isValidPercent,
  normalizeDecimalInput,
} from '../utils/gradeFormulaValues';
import { AssessmentCoverageAlert } from './AssessmentCoverageAlert';
import { StaleAssessmentAlert } from './StaleAssessmentAlert';

const STALE_CODE = 'ASSESSMENT_STALE';
const FORMULA_TAB_KEY = 'formula';
const CLO_TAB_KEY = 'clos';

// Sparse grid state: a key is present when the cell is mapped; its value is the percentage text ('' = none).
type Cells = Record<string, string>;

const cellKey = (componentId: string, cloId: string) =>
  JSON.stringify([componentId, cloId]);

const toCells = (components: readonly AssessmentComponent[]): Cells => {
  const cells: Cells = {};
  for (const component of components)
    for (const mapping of component.mappings)
      cells[cellKey(component.id, mapping.cloId)] = mapping.cloWeight ?? '';
  return cells;
};

const serialize = (cells: Cells) =>
  JSON.stringify(
    Object.entries(cells)
      .map(([key, weight]) => [key, normalizeDecimalInput(weight)])
      .sort(([a], [b]) => String(a).localeCompare(String(b))),
  );

interface MappingEditorProps extends EditorTabProps {
  onChanged: () => void;
}

function MappingEditor({
  courseId,
  syllabus,
  canEditClos,
  onDirtyChange,
  onNavigateTab,
  onChanged,
}: MappingEditorProps) {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const save = useReplaceAssessmentMappings(courseId);
  const formula = syllabus.gradingFormula;
  const initial = useMemo(() => toCells(formula.components), [formula]);
  const [cells, setCells] = useState<Cells>(initial);
  const [stale, setStale] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const dirty = serialize(cells) !== serialize(initial);
  const weightsValid = Object.values(cells).every(
    (weight) =>
      normalizeDecimalInput(weight) === null || isValidPercent(weight),
  );

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  if (formula.components.length === 0)
    return (
      <Empty description={SAVE_FORMULA_FIRST}>
        {onNavigateTab && (
          <Button onClick={() => onNavigateTab(FORMULA_TAB_KEY)}>
            {GO_TO_FORMULA_TAB}
          </Button>
        )}
      </Empty>
    );
  if (syllabus.clos.length === 0)
    return (
      <Empty description={NO_CLOS_TO_MAP}>
        {canEditClos && onNavigateTab && (
          <Button onClick={() => onNavigateTab(CLO_TAB_KEY)}>
            {GO_TO_CLO_TAB}
          </Button>
        )}
      </Empty>
    );

  const covered = new Set(
    Object.keys(cells).map((key) => (JSON.parse(key) as string[])[1]),
  );

  const toggle = (componentId: string, cloId: string, checked: boolean) =>
    setCells((previous) => {
      const next = { ...previous };
      const key = cellKey(componentId, cloId);
      if (checked) next[key] = '';
      else delete next[key];
      return next;
    });
  const setWeight = (componentId: string, cloId: string, weight: string) =>
    setCells((previous) => ({
      ...previous,
      [cellKey(componentId, cloId)]: weight,
    }));

  const submit = async () => {
    setServerError(null);
    try {
      await save.mutateAsync({
        syllabusId: syllabus.id,
        body: {
          expectedUpdatedAt: syllabus.updatedAt,
          mappings: Object.entries(cells).map(([key, weight]) => {
            const [assessmentComponentId, cloId] = JSON.parse(key) as [
              string,
              string,
            ];
            return {
              assessmentComponentId,
              cloId,
              cloWeight: normalizeDecimalInput(weight),
            };
          }),
        },
      });
      void message.success(MAPPINGS_SAVED);
      onChanged();
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === STALE_CODE) {
        setStale(true);
        return;
      }
      setServerError(errorMessage(reason, SAVE_MAPPINGS_FAILED));
    }
  };

  const reload = () => {
    const proceed = async () => {
      setReloading(true);
      try {
        await queryClient.invalidateQueries({
          queryKey: SYLLABUS_QUERY_KEYS.courseRoot(courseId),
        });
        onChanged();
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

  const columns: TableColumnsType<AssessmentComponent> = [
    {
      title: 'Thành phần',
      fixed: 'left',
      width: 200,
      render: (_v, component) => (
        <span>
          {component.componentCode} — {component.componentName}
        </span>
      ),
    },
    ...syllabus.clos.map((clo: Clo) => ({
      title: (
        <Flex vertical gap={2}>
          <span>{clo.cloCode}</span>
          {!covered.has(clo.id) && (
            <Tag color="warning">Chưa được đánh giá</Tag>
          )}
        </Flex>
      ),
      width: 150,
      render: (_v: unknown, component: AssessmentComponent) => {
        const key = cellKey(component.id, clo.id);
        const mapped = key in cells;
        const label = `${component.componentCode} – ${clo.cloCode}`;
        return (
          <Flex vertical gap={4}>
            <Checkbox
              checked={mapped}
              aria-label={label}
              onChange={(event) =>
                toggle(component.id, clo.id, event.target.checked)
              }
            />
            {mapped && (
              <Input
                size="small"
                inputMode="decimal"
                placeholder="%"
                aria-label={`${CLO_WEIGHT}: ${label}`}
                value={cells[key]}
                status={
                  normalizeDecimalInput(cells[key]) !== null &&
                  !isValidPercent(cells[key])
                    ? 'error'
                    : undefined
                }
                onChange={(event) =>
                  setWeight(component.id, clo.id, event.target.value)
                }
              />
            )}
          </Flex>
        );
      },
    })),
  ];

  return (
    <Flex vertical gap="middle">
      {stale && <StaleAssessmentAlert loading={reloading} onReload={reload} />}
      <AssessmentCoverageAlert warnings={formula.warnings} />
      {!weightsValid && <span role="alert">{FORMULA_ERRORS.cloWeight}</span>}
      {serverError && <span role="alert">{serverError}</span>}
      <Table<AssessmentComponent>
        size="small"
        rowKey="id"
        pagination={false}
        columns={columns}
        dataSource={[...formula.components]}
        scroll={{ x: 'max-content' }}
      />
      <Flex justify="end">
        <Button
          type="primary"
          loading={save.isPending}
          disabled={!dirty || !weightsValid}
          onClick={() => void submit()}
        >
          {SAVE_MAPPINGS}
        </Button>
      </Flex>
    </Flex>
  );
}

// Remounted after every save or reload so the grid restarts from what the server stored.
export function AssessmentCloTab(props: EditorTabProps) {
  const { key, trackDirty, restart } = useEditorRemountKey(
    props.syllabus.id,
    props.syllabus.updatedAt,
    props.onDirtyChange,
  );
  return (
    <MappingEditor
      key={key}
      {...props}
      onDirtyChange={trackDirty}
      onChanged={restart}
    />
  );
}
