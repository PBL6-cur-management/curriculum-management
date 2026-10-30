import {
  Alert,
  Card,
  Col,
  DatePicker,
  Flex,
  Row,
  Table,
  Typography,
  type TableColumnsType,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { REQUEST_STATUS_LABELS } from '../../../shared/change-requests/requestStatus';
import {
  FilterBar,
  PageHeader,
  SummaryStrip,
  formatEmpty,
} from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import {
  ORIGIN_LABELS,
  REQUEST_TYPE_LABELS,
} from '../../change-requests/constants/changeRequestLabels';
import type { ChangeRequestStatistics } from '../api/reports';
import { APPROVAL_LEVEL_LABELS } from '../constants/reportLabels';
import { useChangeRequestStatistics } from '../hooks/useReports';

const DATE = 'YYYY-MM-DD';
type Count = ChangeRequestStatistics['byStatus'][number];

function CountCard({
  title,
  rows,
  labels,
}: {
  title: string;
  rows: Count[];
  labels: Record<string, string>;
}) {
  return (
    <Card title={title} size="small">
      <Table
        rowKey="key"
        size="small"
        pagination={false}
        dataSource={rows}
        locale={{ emptyText: 'Không có đề xuất' }}
        columns={[
          {
            title: 'Nhóm',
            key: 'label',
            render: (_, row) => labels[row.key] ?? row.key,
          },
          {
            title: 'Số đề xuất',
            dataIndex: 'count',
            key: 'count',
            align: 'right',
            width: 110,
          },
        ]}
      />
    </Card>
  );
}

const LEVEL_COLUMNS: TableColumnsType<
  ChangeRequestStatistics['levels'][number]
> = [
  {
    title: 'Cấp duyệt',
    key: 'level',
    render: (_, row) =>
      APPROVAL_LEVEL_LABELS[row.approvalLevel] ?? `Cấp ${row.approvalLevel}`,
  },
  {
    title: 'Lượt đã xử lý',
    dataIndex: 'visitCount',
    key: 'visits',
    align: 'right',
    width: 130,
  },
  {
    title: 'Thời gian trung bình (giờ)',
    key: 'average',
    align: 'right',
    width: 200,
    render: (_, row) => formatEmpty(row.averageHours, 'Chưa có lượt'),
  },
];

// MH-44 — US-109: proposal counts in an interval and the average time each approval level took.
export default function ChangeRequestStatisticsPage() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => [
    dayjs().startOf('year'),
    dayjs(),
  ]);
  const statistics = useChangeRequestStatistics({
    from: range[0].format(DATE),
    to: range[1].format(DATE),
  });
  const data = statistics.data;

  return (
    <Flex vertical gap="middle">
      <PageHeader
        title="Thống kê đề xuất"
        subtitle="Số đề xuất tạo trong khoảng thời gian và thời gian xử lý ở từng cấp duyệt."
      />
      <FilterBar>
        <DatePicker.RangePicker
          aria-label="Khoảng thời gian tạo đề xuất"
          allowClear={false}
          format="DD/MM/YYYY"
          value={range}
          onChange={(next) => {
            if (next?.[0] && next[1]) setRange([next[0], next[1]]);
          }}
        />
      </FilterBar>
      {statistics.isError ? (
        <Alert
          type="error"
          showIcon
          title={errorMessage(statistics.error, 'Không đọc được thống kê.')}
        />
      ) : null}
      {data ? (
        <>
          <SummaryStrip
            items={[
              { label: 'Tổng số đề xuất', value: data.total },
              ...data.byStatus
                .filter(
                  (row) => row.key === 'EFFECTIVE' || row.key === 'REJECTED',
                )
                .map((row) => ({
                  label:
                    REQUEST_STATUS_LABELS[
                      row.key as keyof typeof REQUEST_STATUS_LABELS
                    ],
                  value: row.count,
                })),
            ]}
          />
          {data.scoped ? (
            <Typography.Text type="secondary">
              Chỉ tính các đề xuất trong phạm vi được giao.
            </Typography.Text>
          ) : null}
          <Card title="Thời gian xử lý theo cấp" size="small">
            <Table
              rowKey="approvalLevel"
              size="small"
              pagination={false}
              columns={LEVEL_COLUMNS}
              dataSource={data.levels}
            />
            <Typography.Text type="secondary">
              Tính từ khi đề xuất đến cấp đó tới khi cấp đó ra quyết định; cấp
              được bỏ qua và lượt còn chờ không tính.
            </Typography.Text>
          </Card>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={8}>
              <CountCard
                title="Theo trạng thái"
                rows={data.byStatus}
                labels={REQUEST_STATUS_LABELS}
              />
            </Col>
            <Col xs={24} lg={8}>
              <CountCard
                title="Theo loại"
                rows={data.byType}
                labels={REQUEST_TYPE_LABELS}
              />
            </Col>
            <Col xs={24} lg={8}>
              <CountCard
                title="Theo nguồn"
                rows={data.byOrigin}
                labels={ORIGIN_LABELS}
              />
            </Col>
          </Row>
        </>
      ) : statistics.isLoading ? (
        <Card loading />
      ) : null}
    </Flex>
  );
}
