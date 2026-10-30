import { useState } from 'react';
import { Button, Card } from 'antd';
import { useMe } from '../../../shared/auth/useMe';
import { DataTable, StatusTag } from '../../../shared/design-system';
import { DEFAULT_PAGE_SIZE } from '../../../shared/api/pagination';
import type { GraduationLookup, GraduationTask } from '../schema/graduation';
import { TASK_COLORS, TASK_LABELS } from '../constants/graduationLabels';
import {
  graduationPollingBlocked,
  useGraduationTasks,
  useRetryGraduationTask,
} from '../hooks/useGraduation';
import { GraduationError } from './GraduationError';

interface GraduationReauditPanelProps {
  lookup: GraduationLookup;
}
export function GraduationReauditPanel({
  lookup,
}: GraduationReauditPanelProps) {
  const { data: me } = useMe();
  const allowed = Boolean(
    me?.roles.some((role) => role.roleCode === 'R1') &&
    me.permissions.includes('graduation.audit'),
  );
  const [page, setPage] = useState({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  const tasks = useGraduationTasks(lookup, page, allowed);
  const retry = useRetryGraduationTask(lookup);
  if (!allowed) return null;
  if (
    graduationPollingBlocked(tasks.error) ||
    graduationPollingBlocked(retry.error)
  )
    return <GraduationError error={tasks.error ?? retry.error!} />;
  return (
    <Card title="Tác vụ xét lại tự động">
      {tasks.isError && (
        <GraduationError
          error={tasks.error}
          onRetry={() => void tasks.refetch()}
        />
      )}
      {retry.isError && <GraduationError error={retry.error} />}
      <DataTable<GraduationTask>
        rowKey="id"
        dataSource={tasks.data?.items ?? []}
        total={tasks.data?.total ?? 0}
        page={page.page}
        pageSize={page.pageSize}
        onPageChange={(next, pageSize) => setPage({ page: next, pageSize })}
        loading={tasks.isPending}
        emptyText="Chưa có tác vụ xét lại cho ngữ cảnh này"
        columns={[
          {
            title: 'Trạng thái',
            render: (_, task) => (
              <StatusTag
                status={task.status}
                labelMap={TASK_LABELS}
                colorMap={TASK_COLORS}
              />
            ),
          },
          { title: 'Số lần xử lý', dataIndex: 'attempts' },
          { title: 'Mã lỗi', render: (_, task) => task.errorCode ?? '—' },
          {
            title: 'Thao tác',
            render: (_, task) =>
              task.status === 'FAILED' && (
                <Button
                  loading={retry.isPending && retry.variables === task.id}
                  disabled={retry.isPending}
                  onClick={() => retry.mutate(task.id)}
                >
                  Thử xét lại
                </Button>
              ),
          },
        ]}
      />
    </Card>
  );
}
