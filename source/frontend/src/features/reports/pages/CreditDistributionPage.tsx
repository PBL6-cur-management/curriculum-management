import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Flex,
  Row,
  Table,
  type TableColumnsType,
} from 'antd';
import { useState } from 'react';
import {
  EmptyState,
  FilterBar,
  PageHeader,
  SummaryStrip,
  formatEmpty,
} from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import {
  downloadCreditDistribution,
  type CreditBucket,
  type CreditDistribution,
} from '../api/reports';
import { VersionPicker } from '../components/VersionPicker';
import { useCreditDistribution } from '../hooks/useReports';

const BUCKET_COLUMNS: TableColumnsType<CreditBucket> = [
  { title: 'Nhóm', dataIndex: 'label', key: 'label' },
  {
    title: 'Số HP',
    dataIndex: 'courseCount',
    key: 'count',
    align: 'right',
    width: 80,
  },
  {
    title: 'Bắt buộc',
    dataIndex: 'compulsory',
    key: 'compulsory',
    align: 'right',
    width: 90,
  },
  {
    title: 'Tự chọn',
    dataIndex: 'elective',
    key: 'elective',
    align: 'right',
    width: 130,
  },
  {
    title: 'Tổng',
    dataIndex: 'total',
    key: 'total',
    align: 'right',
    width: 80,
  },
];

function BucketCard({ title, rows }: { title: string; rows: CreditBucket[] }) {
  return (
    <Card title={title} size="small">
      <Table
        rowKey="key"
        size="small"
        columns={BUCKET_COLUMNS}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
    </Card>
  );
}

function DistributionResult({ data }: { data: CreditDistribution }) {
  const { totals } = data;
  const mismatch = totals.required !== totals.declaredTotal;
  return (
    <Flex vertical gap="middle">
      <SummaryStrip
        items={[
          { label: 'Bắt buộc (TC)', value: totals.compulsory },
          { label: 'Tự chọn được mở (TC)', value: totals.electiveOffered },
          {
            label: 'Yêu cầu tốt nghiệp (TC)',
            value: totals.required,
            tone: mismatch ? 'warning' : 'default',
          },
          { label: 'Tổng công bố (TC)', value: totals.declaredTotal },
        ]}
      />
      {totals.requiredIsPartial || mismatch ? (
        <Alert
          type="warning"
          showIcon
          title="Số tín chỉ yêu cầu chưa khớp tổng công bố"
          description={
            <ul style={{ margin: 0, paddingInlineStart: 20 }}>
              {mismatch ? (
                <li>
                  Bắt buộc cộng tối thiểu các nhóm tự chọn là {totals.required}{' '}
                  TC, tổng công bố của phiên bản là {totals.declaredTotal} TC.
                </li>
              ) : null}
              {totals.requiredIsPartial ? (
                <li>
                  Có nhóm tự chọn chưa khai báo tối thiểu tín chỉ nên chưa tính
                  được vào yêu cầu.
                </li>
              ) : null}
            </ul>
          }
        />
      ) : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} xxl={12}>
          <BucketCard title="Theo khối kiến thức" rows={data.byBlock} />
        </Col>
        <Col xs={24} xxl={12}>
          <BucketCard title="Theo loại học phần" rows={data.byCourseType} />
        </Col>
        <Col xs={24} xxl={12}>
          <BucketCard title="Theo học kỳ" rows={data.bySemester} />
        </Col>
        <Col xs={24} xxl={12}>
          <Card title="Nhóm tự chọn" size="small">
            <Table
              rowKey="groupCode"
              size="small"
              dataSource={data.electiveGroups}
              pagination={false}
              locale={{ emptyText: 'Không có nhóm tự chọn' }}
              scroll={{ x: 'max-content' }}
              columns={[
                { title: 'Mã nhóm', dataIndex: 'groupCode', key: 'code' },
                { title: 'Tên nhóm', dataIndex: 'groupName', key: 'name' },
                {
                  title: 'Tối thiểu TC',
                  key: 'min',
                  align: 'right',
                  render: (_, group) => formatEmpty(group.minCredits),
                },
                {
                  title: 'TC được mở',
                  dataIndex: 'offeredCredits',
                  key: 'offered',
                  align: 'right',
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </Flex>
  );
}

// MH-61 — US-106: credits by block, semester and course type; an elective minimum is a requirement, not a semester load.
export default function CreditDistributionPage() {
  const { message } = App.useApp();
  const [pick, setPick] = useState({ programId: '', versionId: '' });
  const [downloading, setDownloading] = useState(false);
  const distribution = useCreditDistribution(pick.versionId);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadCreditDistribution(pick.versionId);
    } catch (error) {
      message.error(errorMessage(error, 'Không tải được file phân bổ.'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Flex vertical gap="middle">
      <PageHeader
        title="Phân bổ tín chỉ"
        subtitle="Tín chỉ của một phiên bản theo khối kiến thức, học kỳ và loại học phần."
        actions={
          <Button
            disabled={!distribution.data}
            loading={downloading}
            onClick={() => void download()}
          >
            Xuất Excel
          </Button>
        }
      />
      <FilterBar>
        <VersionPicker label="Chương trình" {...pick} onChange={setPick} />
      </FilterBar>
      {distribution.isError ? (
        <Alert
          type="error"
          showIcon
          title={errorMessage(distribution.error, 'Không đọc được phân bổ.')}
        />
      ) : null}
      {!pick.versionId ? (
        <EmptyState description="Chọn một phiên bản chương trình để xem phân bổ." />
      ) : distribution.data ? (
        <DistributionResult data={distribution.data} />
      ) : distribution.isLoading ? (
        <Card loading />
      ) : null}
    </Flex>
  );
}
