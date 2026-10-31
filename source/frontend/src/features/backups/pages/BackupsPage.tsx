import {
  Alert,
  Button,
  Descriptions,
  Flex,
  Input,
  Result,
  Select,
  Skeleton,
  Tabs,
  type TableColumnsType,
} from 'antd';
import { useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import { DEFAULT_PAGE_SIZE } from '../../../shared/api/pagination';
import {
  DataTable,
  ListPageLayout,
  PageHeader,
  StatusTag,
} from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type {
  BackupListParams,
  BackupRun,
  BackupStatus,
  DrillListParams,
  RestoreDrill,
} from '../api/backups';
import {
  BACKUP_DEFAULT_PAGE,
  BACKUP_STATE_COLORS,
  BACKUP_STATE_LABELS,
  CHECK_LABELS,
  DRILL_STATUS_COLORS,
  DRILL_STATUS_LABELS,
  NO_RECORD,
  RECOVERY_TIME_LABEL,
  RUN_STATUS_COLORS,
  RUN_STATUS_LABELS,
  SORT_OPTIONS,
} from '../constants/backupLabels';
import {
  useBackups,
  useBackupStatus,
  useRestoreDrills,
} from '../hooks/useBackups';
import {
  formatBackupBytes,
  formatBackupTime,
  formatRecoveryMs,
} from '../utils/format';

const SEARCH_MAX = 100;
const RESTORE_NOTICE =
  'Phục hồi chỉ được thực hiện bằng quy trình vận hành trên môi trường tách biệt. Trang này không cho phép phục hồi hoặc tải bản sao dữ liệu.';
const OPERATOR_OBLIGATION =
  'Nơi lưu khác ổ đĩa và bản sao hằng tuần là nghĩa vụ vận hành của đơn vị triển khai; hệ thống không tự xác nhận điều này.';

// What the operator has to do about each state; never implies the data is protected when it is not.
const STATE_ADVICE: Partial<Record<BackupStatus['state'], string>> = {
  DISABLED:
    'Sao lưu đang tắt. Dữ liệu chưa được bảo vệ cho đến khi quản trị viên đặt BACKUP_ENABLED và thư mục sao lưu trên ổ đĩa khác.',
  OVERDUE:
    'Bản sao lưu theo lịch chưa hoàn thành. Kiểm tra tiến trình nền và dung lượng thư mục sao lưu.',
  FAILED:
    'Lần sao lưu gần nhất thất bại. Xử lý nguyên nhân bên dưới rồi theo dõi lần sao lưu kế tiếp.',
};

function isForbidden(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}

function PanelError({
  error,
  fallback,
  onRetry,
}: {
  error: unknown;
  fallback: string;
  onRetry: () => void;
}) {
  if (isForbidden(error))
    return (
      <Result
        status="403"
        title="Bạn không có quyền xem sao lưu và phục hồi."
      />
    );
  return (
    <Alert
      type="error"
      showIcon
      title={errorMessage(error, fallback)}
      action={<Button onClick={onRetry}>Tải lại</Button>}
    />
  );
}

const failureText = (failure: BackupRun['failure']) =>
  failure ? `${failure.code}: ${failure.message}` : null;

const runColumns: TableColumnsType<BackupRun> = [
  { title: 'Lịch sao lưu', dataIndex: 'scheduledFor' },
  {
    title: 'Trạng thái',
    dataIndex: 'status',
    render: (status: BackupRun['status']) => (
      <StatusTag
        status={status}
        colorMap={RUN_STATUS_COLORS}
        labelMap={RUN_STATUS_LABELS}
      />
    ),
  },
  {
    title: 'Thời điểm chụp / hoàn tất',
    render: (_, run) =>
      `${formatBackupTime(run.snapshotAt)} / ${formatBackupTime(run.completedAt)}`,
  },
  { title: 'Lần thử', dataIndex: 'attempt', align: 'right' },
  {
    title: 'Dung lượng CSDL',
    dataIndex: 'databaseBytes',
    align: 'right',
    render: (value: string | null) => formatBackupBytes(value),
  },
  {
    title: 'Tệp đính kèm',
    align: 'right',
    render: (_, run) =>
      `${run.fileCount ?? NO_RECORD} tệp · ${formatBackupBytes(run.fileBytes)}`,
  },
  {
    title: 'Phiên bản đã ban hành',
    dataIndex: 'releasedVersionCount',
    align: 'right',
    render: (value: number | null) => value ?? NO_RECORD,
  },
  {
    title: 'Thời gian chạy',
    dataIndex: 'durationMs',
    align: 'right',
    render: (value: number | null) => formatRecoveryMs(value),
  },
];

const drillColumns: TableColumnsType<RestoreDrill> = [
  { title: 'Bản sao lưu nguồn', dataIndex: 'backupId' },
  { title: 'Bậc triển khai', dataIndex: 'tier' },
  { title: 'Người thực hiện', dataIndex: 'operator' },
  {
    title: 'Trạng thái',
    dataIndex: 'status',
    render: (status: RestoreDrill['status']) => (
      <StatusTag
        status={status}
        colorMap={DRILL_STATUS_COLORS}
        labelMap={DRILL_STATUS_LABELS}
      />
    ),
  },
  {
    title: 'Bắt đầu / kết thúc',
    render: (_, drill) =>
      `${formatBackupTime(drill.startedAt)} / ${formatBackupTime(drill.completedAt)}`,
  },
  {
    title: RECOVERY_TIME_LABEL,
    dataIndex: 'recoveryMs',
    align: 'right',
    render: (value: number | null) => formatRecoveryMs(value),
  },
  {
    title: 'Nghiệm thu',
    dataIndex: 'acceptedAt',
    render: (value: string | null) => formatBackupTime(value),
  },
];

function RunDetail({ run }: { run: BackupRun }) {
  return (
    <Descriptions size="small" column={2} bordered>
      <Descriptions.Item label="Mã bản sao lưu">{run.id}</Descriptions.Item>
      <Descriptions.Item label="Bắt đầu">
        {formatBackupTime(run.startedAt)}
      </Descriptions.Item>
      <Descriptions.Item label="Dung lượng tệp đính kèm">
        {formatBackupBytes(run.fileBytes)}
      </Descriptions.Item>
      <Descriptions.Item label="Lỗi" span={2}>
        {failureText(run.failure) ?? 'Không có'}
      </Descriptions.Item>
    </Descriptions>
  );
}

function DrillDetail({ drill }: { drill: RestoreDrill }) {
  return (
    <Flex vertical gap="small">
      <Descriptions size="small" column={2} bordered>
        <Descriptions.Item label="Mã diễn tập">{drill.id}</Descriptions.Item>
        <Descriptions.Item label="Phiên bản đã ban hành khôi phục được">
          {drill.releasedVersionCount ?? NO_RECORD}
        </Descriptions.Item>
        <Descriptions.Item label="Phục hồi CSDL">
          {formatRecoveryMs(drill.databaseRestoreMs)}
        </Descriptions.Item>
        <Descriptions.Item label="Phục hồi tệp">
          {formatRecoveryMs(drill.filesRestoreMs)}
        </Descriptions.Item>
        <Descriptions.Item label="Kiểm tra tự động">
          {formatRecoveryMs(drill.verificationMs)}
        </Descriptions.Item>
        <Descriptions.Item label="Ghi chú nghiệm thu">
          {drill.acceptanceNote ?? NO_RECORD}
        </Descriptions.Item>
        <Descriptions.Item label="Lỗi" span={2}>
          {failureText(drill.failure) ?? 'Không có'}
        </Descriptions.Item>
      </Descriptions>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {drill.checks.map((check) => (
          <li key={check.code}>
            {check.passed ? 'Đạt' : 'Không đạt'} — {CHECK_LABELS[check.code]}:{' '}
            {check.message}
          </li>
        ))}
      </ul>
    </Flex>
  );
}

function SummaryPanel({ status }: { status: BackupStatus }) {
  return (
    <Flex vertical gap="small">
      {STATE_ADVICE[status.state] && (
        <Alert
          type={status.state === 'FAILED' ? 'error' : 'warning'}
          showIcon
          title={STATE_ADVICE[status.state]}
          description={failureText(status.lastFailure) ?? undefined}
        />
      )}
      <Descriptions size="small" column={{ xs: 1, md: 2, xl: 3 }} bordered>
        <Descriptions.Item label="Trạng thái">
          <StatusTag
            status={status.state}
            colorMap={BACKUP_STATE_COLORS}
            labelMap={BACKUP_STATE_LABELS}
          />
        </Descriptions.Item>
        <Descriptions.Item label="Lịch">
          {status.schedule} ({status.timeZone})
        </Descriptions.Item>
        <Descriptions.Item label="Lịch gần nhất đến hạn">
          {status.dueSlot}
        </Descriptions.Item>
        <Descriptions.Item label="Số bản đang lưu">
          {status.retainedCount} / {status.retentionCount}
        </Descriptions.Item>
        <Descriptions.Item label="Sao lưu thành công gần nhất">
          {formatBackupTime(status.lastSuccessfulAt)}
        </Descriptions.Item>
        <Descriptions.Item label="Bậc diễn tập đã nghiệm thu">
          {status.lastAcceptedTier ?? NO_RECORD}
        </Descriptions.Item>
        <Descriptions.Item label={RECOVERY_TIME_LABEL}>
          {formatRecoveryMs(status.lastRecoveryMs)}
        </Descriptions.Item>
        <Descriptions.Item label="Đang chạy">
          {status.currentRunId ?? 'Không'}
        </Descriptions.Item>
      </Descriptions>
    </Flex>
  );
}

function ListFilters<P extends { q?: string; sort?: 'newest' | 'oldest' }>({
  params,
  onChange,
  placeholder,
  extra,
}: {
  params: P;
  onChange: (next: P) => void;
  placeholder: string;
  extra: React.ReactNode;
}) {
  return (
    <>
      <Input.Search
        allowClear
        aria-label={placeholder}
        placeholder={placeholder}
        maxLength={SEARCH_MAX}
        defaultValue={params.q}
        style={{ maxWidth: 280 }}
        onSearch={(q) =>
          onChange({ ...params, q: q.trim() || undefined, page: 1 })
        }
      />
      {extra}
      <Select
        aria-label="Sắp xếp"
        value={params.sort ?? 'newest'}
        style={{ minWidth: 160 }}
        options={SORT_OPTIONS.map((option) => ({ ...option }))}
        onChange={(sort) => onChange({ ...params, sort, page: 1 })}
      />
    </>
  );
}

// MH-ops. Read-only evidence: nothing here starts, prunes, restores or downloads a backup.
export function BackupsPage() {
  const status = useBackupStatus();
  const [backupParams, setBackupParams] = useState<BackupListParams>({
    page: BACKUP_DEFAULT_PAGE,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [drillParams, setDrillParams] = useState<DrillListParams>({
    page: BACKUP_DEFAULT_PAGE,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const backups = useBackups(backupParams);
  const drills = useRestoreDrills(drillParams);

  if (isForbidden(status.error))
    return (
      <Result
        status="403"
        title="Bạn không có quyền xem sao lưu và phục hồi."
      />
    );

  const backupsTable = (
    <ListPageLayout
      header={<span />}
      filters={
        <ListFilters
          params={backupParams}
          onChange={setBackupParams}
          placeholder="Tìm theo mã hoặc lịch sao lưu"
          extra={
            <Select
              aria-label="Lọc trạng thái sao lưu"
              placeholder="Trạng thái"
              allowClear
              value={backupParams.status}
              style={{ minWidth: 200 }}
              options={Object.entries(RUN_STATUS_LABELS).map(
                ([value, label]) => ({ value, label }),
              )}
              onChange={(value) =>
                setBackupParams({ ...backupParams, status: value, page: 1 })
              }
            />
          }
        />
      }
      table={
        <>
          {backups.error && (
            <PanelError
              error={backups.error}
              fallback="Không đọc được danh mục sao lưu."
              onRetry={() => void backups.refetch()}
            />
          )}
          <DataTable
            rowKey="id"
            columns={runColumns}
            dataSource={backups.isError ? [] : (backups.data?.items ?? [])}
            total={backups.isError ? 0 : (backups.data?.total ?? 0)}
            page={backupParams.page ?? BACKUP_DEFAULT_PAGE}
            pageSize={backupParams.pageSize}
            loading={backups.isPending}
            onPageChange={(page, pageSize) =>
              setBackupParams({ ...backupParams, page, pageSize })
            }
            expandable={{
              expandedRowRender: (run) => <RunDetail run={run} />,
            }}
            emptyText="Chưa có bản sao lưu nào"
            scroll={{ x: 1000 }}
          />
        </>
      }
    />
  );

  const drillsTable = (
    <ListPageLayout
      header={<span />}
      filters={
        <ListFilters
          params={drillParams}
          onChange={setDrillParams}
          placeholder="Tìm theo mã hoặc người thực hiện"
          extra={
            <Select
              aria-label="Lọc trạng thái diễn tập"
              placeholder="Trạng thái"
              allowClear
              value={drillParams.status}
              style={{ minWidth: 240 }}
              options={Object.entries(DRILL_STATUS_LABELS).map(
                ([value, label]) => ({ value, label }),
              )}
              onChange={(value) =>
                setDrillParams({ ...drillParams, status: value, page: 1 })
              }
            />
          }
        />
      }
      table={
        <>
          {drills.error && (
            <PanelError
              error={drills.error}
              fallback="Không đọc được biên bản diễn tập phục hồi."
              onRetry={() => void drills.refetch()}
            />
          )}
          <DataTable
            rowKey="id"
            columns={drillColumns}
            dataSource={drills.isError ? [] : (drills.data?.items ?? [])}
            total={drills.isError ? 0 : (drills.data?.total ?? 0)}
            page={drillParams.page ?? BACKUP_DEFAULT_PAGE}
            pageSize={drillParams.pageSize}
            loading={drills.isPending}
            onPageChange={(page, pageSize) =>
              setDrillParams({ ...drillParams, page, pageSize })
            }
            expandable={{
              expandedRowRender: (drill) => <DrillDetail drill={drill} />,
            }}
            emptyText="Chưa có biên bản diễn tập phục hồi"
            scroll={{ x: 1000 }}
          />
        </>
      }
    />
  );

  return (
    <Flex vertical gap="middle">
      <PageHeader
        title="Sao lưu và diễn tập phục hồi"
        subtitle={RESTORE_NOTICE}
      />
      <Alert type="info" showIcon title={OPERATOR_OBLIGATION} />
      {status.isPending && <Skeleton active paragraph={{ rows: 3 }} />}
      {status.isError && (
        <PanelError
          error={status.error}
          fallback="Không đọc được trạng thái sao lưu."
          onRetry={() => void status.refetch()}
        />
      )}
      {status.data && <SummaryPanel status={status.data} />}
      <Tabs
        items={[
          { key: 'backups', label: 'Bản sao lưu', children: backupsTable },
          { key: 'drills', label: 'Diễn tập phục hồi', children: drillsTable },
        ]}
      />
    </Flex>
  );
}
