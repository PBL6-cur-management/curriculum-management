import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { Card, Col, Flex, Row, Table, Tag, Tooltip, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { palette, radius } from '../../../shared/design-system/tokens';
import type { BlockTotal, Curriculum, SemesterTotal } from '../api/curriculum';
import { NO_BLOCK_LABEL } from '../constants/curriculumLabels';

interface CurriculumTotalsProps {
  curriculum: Curriculum;
  // When a block is filtered, its total is the one worth reading.
  highlightedBlock?: string | null;
}

const SEMESTER_COLUMNS: TableColumnsType<SemesterTotal> = [
  { title: 'Học kỳ', dataIndex: 'semester' },
  { title: 'Số HP', dataIndex: 'itemCount', align: 'right' },
  { title: 'Bắt buộc', dataIndex: 'compulsoryCredits', align: 'right' },
  { title: 'Tự chọn', dataIndex: 'electiveCredits', align: 'right' },
  { title: 'Tổng TC', dataIndex: 'totalCredits', align: 'right' },
];

export function ProgramCreditsLine({
  credits,
}: {
  credits: Curriculum['programCredits'];
}) {
  const { computed, declared, mismatch } = credits;
  return (
    <Flex
      wrap
      align="center"
      justify="space-between"
      gap={12}
      className="tabular"
      style={{
        background: palette.white,
        border: `1px solid ${palette.slate200}`,
        borderRadius: radius.md,
        padding: '8px 14px',
      }}
    >
      <Flex wrap align="center" gap={16}>
        <Typography.Text style={{ fontSize: 13 }}>
          <Typography.Text type="secondary">Tổng TC: </Typography.Text>
          <Typography.Text strong>
            {computed.total} / {declared.total}
          </Typography.Text>
        </Typography.Text>
        <Typography.Text
          type="secondary"
          aria-hidden="true"
          style={{ fontSize: 12 }}
        >
          ·
        </Typography.Text>
        <Typography.Text style={{ fontSize: 13 }}>
          <Typography.Text type="secondary">Bắt buộc: </Typography.Text>
          <Typography.Text strong>
            {computed.compulsory} / {declared.compulsory}
          </Typography.Text>
        </Typography.Text>
        <Typography.Text
          type="secondary"
          aria-hidden="true"
          style={{ fontSize: 12 }}
        >
          ·
        </Typography.Text>
        <Typography.Text style={{ fontSize: 13 }}>
          <Typography.Text type="secondary">Tự chọn: </Typography.Text>
          <Typography.Text strong>
            {computed.elective} / {declared.elective}
          </Typography.Text>
        </Typography.Text>
      </Flex>
      <Flex align="center" gap={8}>
        {mismatch ? (
          <Tag
            color="warning"
            icon={<ExclamationCircleOutlined />}
            style={{ marginInlineEnd: 0 }}
          >
            Lệch khai báo
          </Tag>
        ) : (
          <Tag
            color="success"
            icon={<CheckCircleOutlined />}
            style={{ marginInlineEnd: 0 }}
          >
            Khớp khai báo
          </Tag>
        )}
        <Tooltip title="Tổng tín chỉ tính từ khung / khai báo (nhóm tự chọn tính theo mức tối thiểu)">
          <InfoCircleOutlined
            aria-label="Giải thích cách tính tín chỉ"
            style={{ color: palette.slate400, fontSize: 13, cursor: 'help' }}
          />
        </Tooltip>
      </Flex>
    </Flex>
  );
}

// Totals come from the server. Per-semester and per-block tables count every row as on the Khoa sheet;
// the program line counts each elective group by its minimum (US-029 AC1).
export function CurriculumTotals({
  curriculum,
  highlightedBlock,
}: CurriculumTotalsProps) {
  const blockColumns: TableColumnsType<BlockTotal> = [
    {
      title: 'Khối kiến thức',
      render: (_value, block) => (
        <span title={block.blockName ?? undefined}>
          {block.symbol ?? NO_BLOCK_LABEL}
          {block.blockName ? ` — ${block.blockName}` : ''}
        </span>
      ),
    },
    { title: 'Số HP', dataIndex: 'itemCount', align: 'right' },
    { title: 'Tổng TC', dataIndex: 'totalCredits', align: 'right' },
  ];
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={14}>
        <Card size="small" title="Tín chỉ theo học kỳ">
          <Table<SemesterTotal>
            size="small"
            rowKey="semester"
            pagination={false}
            columns={SEMESTER_COLUMNS}
            dataSource={curriculum.semesters}
          />
        </Card>
      </Col>
      <Col xs={24} lg={10}>
        <Card size="small" title="Tín chỉ theo khối kiến thức">
          <Table<BlockTotal>
            size="small"
            rowKey={(block) => block.symbol ?? '\u0000none'}
            pagination={false}
            columns={blockColumns}
            dataSource={curriculum.blocks}
            rowClassName={(block) =>
              highlightedBlock !== undefined &&
              block.symbol === highlightedBlock
                ? 'ant-table-row-selected'
                : ''
            }
          />
        </Card>
      </Col>
    </Row>
  );
}
