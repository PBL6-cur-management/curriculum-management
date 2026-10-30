import { ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Result, Skeleton, Typography } from 'antd';
import { PageHeader } from '../../../shared/design-system';
import dayjs from 'dayjs';
import { useState } from 'react';
import { generatePath, Link, useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { ApiError } from '../../../shared/api/client';
import { versionLabel } from '../../../shared/constants/versionLabels';
import { AcceptMismatchModal } from '../components/AcceptMismatchModal';
import { CreditSummaryCard } from '../components/CreditSummaryCard';
import { IssueList } from '../components/IssueList';
import {
  BLOCKING_NOTE,
  CLEAN_RESULT_MESSAGE,
  RERUN_LABEL,
} from '../constants/consistencyLabels';
import { useConsistency } from '../hooks/useConsistency';

export function ConsistencyPage() {
  const { programId = '', versionId = '' } = useParams();
  const {
    data: report,
    isPending,
    isFetching,
    error,
    refetch,
  } = useConsistency(versionId);
  const [accepting, setAccepting] = useState(false);
  if (isPending) return <Skeleton active />;
  if (!report) {
    if (error instanceof ApiError && error.status === 403)
      return (
        <Result status="403" title="Bạn không có quyền xem kiểm tra này" />
      );
    return (
      <Result status="404" title="Không tìm thấy phiên bản chương trình" />
    );
  }
  const { version } = report;
  return (
    <Flex vertical gap="middle">
      <Link to={generatePath(ROUTES.curriculum, { programId, versionId })}>
        ← Khung chương trình {version.programCode}
      </Link>
      <PageHeader
        title={`Kiểm tra nhất quán — ${version.programCode} (${versionLabel(version)})`}
        actions={
          <Button
            icon={<ReloadOutlined />}
            loading={isFetching}
            onClick={() => void refetch()}
          >
            {RERUN_LABEL}
          </Button>
        }
      />
      <Typography.Text type="secondary">
        Kiểm tra lúc {dayjs(report.checkedAt).format('DD/MM/YYYY HH:mm:ss')}
      </Typography.Text>
      {!report.passes && (
        <Alert
          type="error"
          showIcon
          title={BLOCKING_NOTE}
          description={`${report.issues.length} vấn đề cần xử lý, liệt kê ngay dưới đây.`}
        />
      )}
      {report.issues.length === 0 ? (
        <Result status="success" title={CLEAN_RESULT_MESSAGE} />
      ) : (
        <IssueList
          issues={report.issues}
          programId={programId}
          versionId={versionId}
        />
      )}
      <CreditSummaryCard
        credits={report.credits}
        groups={report.groups}
        canAccept={report.canAcceptMismatch}
        onAccept={() => setAccepting(true)}
      />
      {accepting && (
        <AcceptMismatchModal
          versionId={versionId}
          gap={report.credits.gap}
          onClose={() => setAccepting(false)}
          onStale={() => void refetch()}
        />
      )}
    </Flex>
  );
}
