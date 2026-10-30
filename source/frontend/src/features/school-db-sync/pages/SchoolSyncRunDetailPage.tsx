import {
  Alert,
  App,
  Button,
  Card,
  Flex,
  Table,
  Typography,
  type TableColumnsType,
} from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { generatePath, Link, useNavigate, useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { DEFAULT_PAGE_SIZE } from '../../../shared/api/pagination';
import {
  BackLink,
  PageHeader,
  PageSkeleton,
  StatusTag,
  SummaryStrip,
  formatEmpty,
} from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { SyncConflict } from '../api/schoolSync';
import {
  CONFLICT_FIELD_LABELS,
  RUN_STATUS_COLORS,
  RUN_STATUS_LABELS,
  TRIGGER_LABELS,
} from '../constants/syncLabels';
import {
  useStartSyncRun,
  useSyncConflicts,
  useSyncRun,
} from '../hooks/useSchoolSync';

const formatTime = (iso: string) => dayjs(iso).format('DD/MM/YYYY HH:mm:ss');

function ValueList({ values }: { values: SyncConflict['before'] }) {
  return (
    <Flex vertical>
      {values.map((entry) => (
        <span key={entry.field}>
          {CONFLICT_FIELD_LABELS[entry.field] ?? entry.field}: {formatEmpty(entry.value, 'Trống')}
        </span>
      ))}
    </Flex>
  );
}

const conflictColumns: TableColumnsType<SyncConflict> = [
  {
    title: 'Bản ghi',
    render: (_, row) => (
      <Flex vertical>
        <span>{row.entityType === 'STUDENT' ? 'Hồ sơ sinh viên' : 'Kết quả học tập'}</span>
        <Typography.Text type="secondary">{row.recordKey.replaceAll('|', ' · ')}</Typography.Text>
      </Flex>
    ),
  },
  { title: 'Trước (Excel)', render: (_, row) => <ValueList values={row.before} /> },
  { title: 'Sau (CSDL Trường)', render: (_, row) => <ValueList values={row.after} /> },
];

export function SchoolSyncRunDetailPage() {
  const { runId = '' } = useParams();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const run = useSyncRun(runId);
  const retry = useStartSyncRun();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const conflicts = useSyncConflicts(
    runId,
    page,
    pageSize,
    run.data?.status === 'SUCCEEDED' && run.data.conflictCount > 0,
  );

  if (run.isPending) return <PageSkeleton />;
  if (run.isError || !run.data) {
    return (
      <Flex vertical gap="middle">
        <BackLink to={ROUTES.schoolSyncRuns}>Lịch sử đồng bộ</BackLink>
        <Alert type="error" showIcon title={errorMessage(run.error, 'Không tải được lần đồng bộ.')} />
      </Flex>
    );
  }
  const data = run.data;

  async function onRetry() {
    try {
      const started = await retry.mutateAsync({ runId: data.id, requestId: crypto.randomUUID() });
      void navigate(generatePath(ROUTES.schoolSyncRunDetail, { runId: started.id }));
    } catch (error) {
      void message.error(errorMessage(error, 'Không chạy lại được.'));
    }
  }

  return (
    <Flex vertical gap="middle">
      <BackLink to={ROUTES.schoolSyncRuns}>Lịch sử đồng bộ</BackLink>
      <PageHeader
        title={
          <Flex gap="small" align="center" wrap>
            Lần đồng bộ {formatTime(data.startedAt)}
            <StatusTag status={data.status} colorMap={RUN_STATUS_COLORS} labelMap={RUN_STATUS_LABELS} />
          </Flex>
        }
        subtitle={`${TRIGGER_LABELS[data.trigger]} · ${data.profile === 'SIMULATED_SQL_SERVER' ? 'Bản mô phỏng' : 'Máy chủ của Trường'}${data.snapshotVersion ? ` · Ảnh dữ liệu ${data.snapshotVersion}` : ''}`}
        actions={
          data.canRetry && (
            <Button type="primary" loading={retry.isPending} onClick={() => void onRetry()}>
              Chạy lại
            </Button>
          )
        }
      />
      {data.status === 'RUNNING' && (
        <Alert type="info" showIcon title={`Đang đồng bộ. Hạn chót ${formatTime(data.expiresAt)}; quá hạn thì lần này thất bại và không ghi gì.`} />
      )}
      {data.status === 'FAILED' && (
        <Alert type="error" showIcon title={formatEmpty(data.errorMessage, 'Thất bại, không rõ lý do.')} description="Không có thay đổi nào được ghi. Lịch tiếp theo hoặc nút Chạy lại sẽ thử lại." />
      )}
      {data.retryOfId && (
        <Typography.Text>
          Chạy lại của{' '}
          <Link to={generatePath(ROUTES.schoolSyncRunDetail, { runId: data.retryOfId })}>lần thất bại trước</Link>.
        </Typography.Text>
      )}
      <SummaryStrip
        label="Kết quả lần đồng bộ"
        items={[
          { label: 'Sinh viên', value: data.studentCount },
          { label: 'Kết quả học tập', value: data.resultCount },
          { label: 'Lớp học phần', value: data.classCount },
          { label: 'Có thay đổi', value: data.changedCount },
          { label: 'Xung đột với Excel', value: data.conflictCount, tone: data.conflictCount > 0 ? 'warning' : 'default' },
        ]}
      />
      {data.conflictCount > 0 && (
        <Card title="Xung đột với dữ liệu Excel" extra={<Typography.Text type="secondary">Dữ liệu Trường đã được chọn</Typography.Text>}>
          <Table<SyncConflict>
            rowKey="id"
            columns={conflictColumns}
            dataSource={conflicts.data?.items ?? []}
            loading={conflicts.isPending}
            pagination={{
              current: page,
              pageSize,
              total: conflicts.data?.total ?? 0,
              showTotal: (total) => `${total} xung đột`,
              onChange: (next, size) => {
                setPage(size !== pageSize ? 1 : next);
                setPageSize(size);
              },
            }}
            scroll={{ x: 720 }}
          />
        </Card>
      )}
    </Flex>
  );
}
