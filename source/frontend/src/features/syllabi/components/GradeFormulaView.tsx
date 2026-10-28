import { Alert, Flex, Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import type { AssessmentComponent, Syllabus } from '../api/syllabi';
import {
  CLO_WEIGHT,
  CONDITION_EXPLANATION,
  COURSE_FAILING_SCORE,
  FORMULA_COLUMN_LABELS,
  FORMULA_TAB_LABEL,
  MAPPING_TAB_LABEL,
  NO_MAPPINGS,
  NOT_DECLARED,
  RULE_ONLY_NOTE,
} from '../constants/gradeFormulaLabels';
import { AssessmentCoverageAlert } from './AssessmentCoverageAlert';

interface GradeFormulaViewProps {
  syllabus: Syllabus;
}

const dash = (value: string | null) => value ?? '—';

export function GradeFormulaView({ syllabus }: GradeFormulaViewProps) {
  const formula = syllabus.gradingFormula;
  // No heading while empty: a revision without a formula reads as one line under the assessment method text.
  if (formula.components.length === 0)
    return <Typography.Text type="secondary">{NOT_DECLARED}</Typography.Text>;
  const anyConditional = formula.components.some(
    (component) => component.isConditional,
  );
  const columns: TableColumnsType<AssessmentComponent> = [
    {
      title: FORMULA_COLUMN_LABELS.code,
      dataIndex: 'componentCode',
      width: 90,
    },
    { title: FORMULA_COLUMN_LABELS.name, dataIndex: 'componentName' },
    {
      title: FORMULA_COLUMN_LABELS.weight,
      dataIndex: 'weight',
      width: 120,
      align: 'right',
    },
    {
      title: FORMULA_COLUMN_LABELS.form,
      dataIndex: 'assessmentForm',
      render: dash,
    },
    {
      title: FORMULA_COLUMN_LABELS.conditional,
      width: 150,
      render: (_v, component) =>
        component.isConditional
          ? `Có — ngưỡng ${component.conditionThreshold ?? '—'}`
          : 'Không',
    },
    {
      title: FORMULA_COLUMN_LABELS.failingScore,
      dataIndex: 'failingScore',
      width: 130,
      render: dash,
    },
  ];
  const mappingRows = formula.components.flatMap((component) =>
    component.mappings.map((mapping) => ({
      key: `${component.id}:${mapping.cloId}`,
      component: component.componentCode,
      clo:
        syllabus.clos.find((clo) => clo.id === mapping.cloId)?.cloCode ??
        mapping.cloId,
      weight: mapping.cloWeight,
    })),
  );
  return (
    <section>
      <Typography.Title level={5}>{FORMULA_TAB_LABEL}</Typography.Title>
      <Flex vertical gap="small">
        {syllabus.status === 'DRAFT' && (
          <AssessmentCoverageAlert warnings={formula.warnings} />
        )}
        <Table<AssessmentComponent>
          size="small"
          rowKey="id"
          pagination={false}
          columns={columns}
          dataSource={[...formula.components]}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={2}>
                Tổng
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right">
                {formula.totalWeight}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} colSpan={3} />
            </Table.Summary.Row>
          )}
        />
        {formula.failingScore !== null && (
          <Typography.Text>
            {COURSE_FAILING_SCORE}: {formula.failingScore}.{' '}
            {CONDITION_EXPLANATION}
          </Typography.Text>
        )}
        {anyConditional && (
          <Alert type="info" showIcon title={CONDITION_EXPLANATION} />
        )}
        <Typography.Text type="secondary">{RULE_ONLY_NOTE}</Typography.Text>
        <Typography.Title level={5}>{MAPPING_TAB_LABEL}</Typography.Title>
        <Table
          size="small"
          pagination={false}
          locale={{ emptyText: NO_MAPPINGS }}
          dataSource={mappingRows}
          columns={[
            { title: 'Thành phần', dataIndex: 'component', width: 120 },
            { title: 'CLO', dataIndex: 'clo', width: 120 },
            {
              title: CLO_WEIGHT,
              dataIndex: 'weight',
              render: dash,
            },
          ]}
        />
      </Flex>
    </section>
  );
}
