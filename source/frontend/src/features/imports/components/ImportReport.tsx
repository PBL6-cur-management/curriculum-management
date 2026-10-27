import {
  Alert,
  Card,
  Flex,
  Spin,
  Table,
  Tag,
  Typography,
  type TableColumnsType,
} from 'antd';
import type { components } from '../../../shared/api/schema';
import { EmptyState } from '../../../shared/design-system';
import type { ImportBatch } from '../api/imports';
import {
  IMPORT_SEVERITY_ALERT_TYPE,
  IMPORT_SEVERITY_LABELS,
  TRANSIENT_IMPORT_STATUSES,
} from '../constants/importLabels';
import { ImportStatusTag } from './ImportStatusTag';

interface ImportReportProps {
  batch: ImportBatch;
}
type ImportIssue = components['schemas']['ImportIssueDto'];
const issueColumns: TableColumnsType<ImportIssue> = [
  {
    title: 'Dòng',
    dataIndex: 'rowNumber',
    render: (row: number | null) => row ?? 'Toàn tệp',
  },
  {
    title: 'Mức',
    dataIndex: 'severity',
    filters: Object.entries(IMPORT_SEVERITY_LABELS).map(([value, text]) => ({
      value,
      text,
    })),
    onFilter: (value, issue) => issue.severity === value,
    render: (severity: ImportIssue['severity']) => (
      <Tag color={IMPORT_SEVERITY_ALERT_TYPE[severity]}>
        {IMPORT_SEVERITY_LABELS[severity]}
      </Tag>
    ),
  },
  {
    title: 'Cột',
    dataIndex: 'column',
    render: (column: string | null) => (column ? `Cột: ${column}` : '—'),
  },
  {
    title: 'Nội dung',
    render: (_, issue) =>
      `${issue.rowNumber === null ? 'Toàn tệp' : `Dòng ${issue.rowNumber}`}: ${IMPORT_SEVERITY_LABELS[issue.severity]} — ${issue.message}`,
  },
];
export function ImportReport({ batch }: ImportReportProps) {
  const transient = TRANSIENT_IMPORT_STATUSES.includes(batch.status);
  return (
    <Card
      title="Báo cáo nhập liệu"
      extra={<ImportStatusTag status={batch.status} />}
    >
      <Flex vertical gap="middle" aria-live="polite">
        <Typography.Text>{batch.fileName}</Typography.Text>
        {transient ? (
          <Spin tip="Đang xử lý tệp, vui lòng chờ">
            <div style={{ minHeight: 60 }} />
          </Spin>
        ) : (
          <Typography.Text>
            Tổng: {batch.totalRows} · Hợp lệ: {batch.successRows} · Lỗi:{' '}
            {batch.errorRows}
          </Typography.Text>
        )}
        {Boolean(batch.report?.formatErrors.length) && (
          <Alert
            type="error"
            showIcon
            title="Tệp không đúng định dạng"
            description={
              <ul>
                {batch.report?.formatErrors.map((issue, index) => (
                  <li
                    key={index}
                  >{`${issue.column ? `${issue.column}: ` : ''}${issue.message}`}</li>
                ))}
              </ul>
            }
          />
        )}
        {Boolean(batch.report?.issues.length) && (
          <Table<ImportIssue>
            rowKey={(_, index) => String(index)}
            columns={issueColumns}
            dataSource={batch.report?.issues}
            pagination={{
              pageSize: 50,
              showSizeChanger: false,
              hideOnSinglePage: true,
            }}
            scroll={{ x: 700 }}
          />
        )}
        {!transient &&
          batch.report &&
          !batch.report.formatErrors.length &&
          !batch.report.issues.length && (
            <EmptyState description="Tệp không có lỗi, cảnh báo hoặc lưu ý." />
          )}
        {!transient && !batch.report && (
          <Alert
            type="warning"
            showIcon
            title="Chưa có báo cáo cho lần nhập này."
          />
        )}
      </Flex>
    </Card>
  );
}
