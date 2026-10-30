import { useState } from 'react';
import { Card } from 'antd';
import { generatePath, Link } from 'react-router';
import { ROUTES } from '../../../routes';
import { DEFAULT_PAGE_SIZE } from '../../../shared/api/pagination';
import { DataTable, StatusTag } from '../../../shared/design-system';
import type { GraduationAudit, GraduationLookup } from '../schema/graduation';
import {
  CONCLUSION_COLORS,
  CONCLUSION_LABELS,
  FRESHNESS_LABELS,
  TRIGGER_LABELS,
} from '../constants/graduationLabels';
import { useGraduationHistory } from '../hooks/useGraduation';
import { GraduationError } from './GraduationError';
import { displayTime } from './graduationPresentation';

interface GraduationHistoryTableProps {
  lookup: GraduationLookup;
}
export function GraduationHistoryTable({
  lookup,
}: GraduationHistoryTableProps) {
  const [params, setParams] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const history = useGraduationHistory(lookup, params);
  return (
    <Card title="Lịch sử các lần xét">
      {history.isError ? (
        <GraduationError
          error={history.error}
          onRetry={() => void history.refetch()}
        />
      ) : (
        <DataTable<GraduationAudit>
          rowKey="id"
          loading={history.isPending}
          dataSource={history.data?.items ?? []}
          total={history.data?.total ?? 0}
          page={params.page}
          pageSize={params.pageSize}
          onPageChange={(page, pageSize) => setParams({ page, pageSize })}
          emptyText="Chưa lưu lần xét nào cho chương trình và học kỳ này"
          scroll={{ x: 'max-content' }}
          columns={[
            {
              title: 'Thời điểm',
              render: (_, audit) => (
                <Link
                  to={generatePath(ROUTES.graduationAudit, {
                    auditId: audit.id,
                  })}
                >
                  {displayTime(audit.auditedAt)}
                </Link>
              ),
            },
            {
              title: 'Người xét',
              render: (_, audit) => audit.auditedBy?.fullName ?? 'Hệ thống',
            },
            {
              title: 'Nguồn',
              render: (_, audit) => TRIGGER_LABELS[audit.trigger],
            },
            {
              title: 'Phiên bản',
              render: (_, audit) => audit.result.context.versionNumber,
            },
            {
              title: 'Kết luận',
              render: (_, audit) => (
                <StatusTag
                  status={audit.result.conclusion}
                  labelMap={CONCLUSION_LABELS}
                  colorMap={CONCLUSION_COLORS}
                />
              ),
            },
            {
              title: 'Độ mới',
              render: (_, audit) => FRESHNESS_LABELS[audit.freshness],
            },
          ]}
        />
      )}
    </Card>
  );
}
