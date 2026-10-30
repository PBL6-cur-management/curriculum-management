import { Card, Col, Descriptions, Row, Table, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
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
  const { computed, declared } = credits;
  return (
    <Descriptions
      size="small"
      bordered
      column={{ xs: 1, md: 3 }}
      title="Tổng tín chỉ chương trình (nhóm tự chọn tính theo mức tối thiểu) — tính từ khung / khai báo"
    >
      <Descriptions.Item label="Bắt buộc">
        {computed.compulsory} / {declared.compulsory}
      </Descriptions.Item>
      <Descriptions.Item label="Tự chọn">
        {computed.elective} / {declared.elective}
      </Descriptions.Item>
      <Descriptions.Item label="Tổng">
        {computed.total} / {declared.total}
        {credits.mismatch && (
          <Tag color="warning" style={{ marginLeft: 8 }}>
            Lệch so với khai báo
          </Tag>
        )}
      </Descriptions.Item>
    </Descriptions>
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
