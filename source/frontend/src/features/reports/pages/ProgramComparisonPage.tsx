import {
  Alert,
  App,
  Button,
  Card,
  Flex,
  Table,
  Tabs,
  Tag,
  type TableColumnsType,
} from 'antd';
import { useState } from 'react';
import {
  EmptyState,
  FilterBar,
  PageHeader,
  SummaryStrip,
} from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import {
  downloadProgramComparison,
  type ComparisonCourse,
  type ProgramComparison,
} from '../api/reports';
import { VersionPicker } from '../components/VersionPicker';
import { DIFFERENCE_LABELS } from '../constants/reportLabels';
import { useProgramComparison } from '../hooks/useReports';

type Side = 'left' | 'right';
interface Pick {
  programId: string;
  versionId: string;
}
const EMPTY: Pick = { programId: '', versionId: '' };

function sideColumns(
  side: Side,
  title: string,
): TableColumnsType<ComparisonCourse> {
  return [
    {
      title: `HK ${title}`,
      key: `${side}-semester`,
      width: 90,
      render: (_, row) => row[side]?.plannedSemester,
    },
    {
      title: `TC ${title}`,
      key: `${side}-credits`,
      width: 80,
      align: 'right',
      render: (_, row) => row[side]?.credits,
    },
    {
      title: `Loại ${title}`,
      key: `${side}-type`,
      width: 110,
      render: (_, row) =>
        row[side] ? (row[side].isElective ? 'Tự chọn' : 'Bắt buộc') : null,
    },
  ];
}

const COURSE_COLUMNS: TableColumnsType<ComparisonCourse> = [
  { title: 'Mã HP', dataIndex: 'courseCode', key: 'code', width: 120 },
  { title: 'Tên học phần', dataIndex: 'courseName', key: 'name' },
];

function exclusiveColumns(side: Side): TableColumnsType<ComparisonCourse> {
  return [...COURSE_COLUMNS, ...sideColumns(side, '')];
}

function ComparisonResult({ data }: { data: ProgramComparison }) {
  const leftName = data.left.programCode;
  const rightName = data.right.programCode;
  const sharedColumns: TableColumnsType<ComparisonCourse> = [
    ...COURSE_COLUMNS,
    ...sideColumns('left', 'A'),
    ...sideColumns('right', 'B'),
    {
      title: 'Khác nhau',
      key: 'differences',
      render: (_, row) =>
        row.differences.map((key) => (
          <Tag key={key} color="gold">
            {DIFFERENCE_LABELS[key] ?? key}
          </Tag>
        )),
    },
  ];
  const table = (
    rows: ComparisonCourse[],
    columns: TableColumnsType<ComparisonCourse>,
  ) => (
    <Table
      rowKey="courseCode"
      size="small"
      columns={columns}
      dataSource={rows}
      pagination={rows.length > 50 ? { pageSize: 50 } : false}
      scroll={{ x: 'max-content' }}
      locale={{ emptyText: 'Không có học phần' }}
    />
  );
  return (
    <Flex vertical gap="middle">
      <SummaryStrip
        items={[
          { label: 'Học phần chung', value: data.summary.sharedCount },
          {
            label: `Tín chỉ chung (${leftName} / ${rightName})`,
            value: `${data.summary.sharedCreditsLeft} / ${data.summary.sharedCreditsRight}`,
          },
          { label: 'Cặp tương đương', value: data.summary.equivalentCount },
          { label: `Chỉ có ở ${leftName}`, value: data.summary.leftOnlyCount },
          {
            label: `Chỉ có ở ${rightName}`,
            value: data.summary.rightOnlyCount,
          },
        ]}
      />
      <Card>
        <Tabs
          items={[
            {
              key: 'shared',
              label: `Học phần chung (${data.shared.length})`,
              children: table(data.shared, sharedColumns),
            },
            {
              key: 'equivalent',
              label: `Tương đương (${data.equivalent.length})`,
              children: (
                <Table
                  rowKey={(pair) =>
                    `${pair.left.courseCode}:${pair.right.courseCode}`
                  }
                  size="small"
                  dataSource={data.equivalent}
                  pagination={false}
                  locale={{ emptyText: 'Không có cặp tương đương' }}
                  columns={[
                    {
                      title: `HP ${leftName}`,
                      key: 'left',
                      render: (_, pair) =>
                        `${pair.left.courseCode} — ${pair.left.courseName}`,
                    },
                    {
                      title: `HP ${rightName}`,
                      key: 'right',
                      render: (_, pair) =>
                        `${pair.right.courseCode} — ${pair.right.courseName}`,
                    },
                  ]}
                />
              ),
            },
            {
              key: 'left',
              label: `Chỉ có ở ${leftName} (${data.leftOnly.length})`,
              children: table(data.leftOnly, exclusiveColumns('left')),
            },
            {
              key: 'right',
              label: `Chỉ có ở ${rightName} (${data.rightOnly.length})`,
              children: table(data.rightOnly, exclusiveColumns('right')),
            },
          ]}
        />
      </Card>
    </Flex>
  );
}

// MH-60 — US-105: two programs side by side, same split as the Excel file.
export default function ProgramComparisonPage() {
  const { message } = App.useApp();
  const [left, setLeft] = useState<Pick>(EMPTY);
  const [right, setRight] = useState<Pick>(EMPTY);
  const [downloading, setDownloading] = useState(false);
  const comparison = useProgramComparison(left.versionId, right.versionId);
  const ready = Boolean(left.versionId && right.versionId);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadProgramComparison(left.versionId, right.versionId);
    } catch (error) {
      message.error(errorMessage(error, 'Không tải được file so sánh.'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Flex vertical gap="middle">
      <PageHeader
        title="So sánh chương trình"
        subtitle="Đặt hai chương trình cạnh nhau để đối sánh học phần, tín chỉ và học kỳ."
        actions={
          <Button
            disabled={!comparison.data}
            loading={downloading}
            onClick={() => void download()}
          >
            Xuất Excel
          </Button>
        }
      />
      <FilterBar>
        <VersionPicker label="Chương trình A" {...left} onChange={setLeft} />
        <VersionPicker label="Chương trình B" {...right} onChange={setRight} />
      </FilterBar>
      {comparison.isError ? (
        <Alert
          type="error"
          showIcon
          title={errorMessage(comparison.error, 'Không so sánh được.')}
        />
      ) : null}
      {!ready ? (
        <EmptyState description="Chọn phiên bản của hai chương trình để so sánh." />
      ) : comparison.data ? (
        <ComparisonResult data={comparison.data} />
      ) : comparison.isLoading ? (
        <Card loading />
      ) : null}
    </Flex>
  );
}
