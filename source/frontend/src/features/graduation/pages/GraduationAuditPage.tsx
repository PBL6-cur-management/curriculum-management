import { Skeleton } from 'antd';
import { Link, useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { DetailPageLayout, PageHeader } from '../../../shared/design-system';
import { useGraduationAudit } from '../hooks/useGraduation';
import { GraduationAuditSummary } from '../components/GraduationAuditSummary';
import { GraduationError } from '../components/GraduationError';
import { GraduationResultView } from '../components/GraduationResultView';
import { GraduationReauditPanel } from '../components/GraduationReauditPanel';

export function GraduationAuditPage() {
  const { auditId = '' } = useParams();
  const audit = useGraduationAudit(auditId);
  const context = audit.isError ? undefined : audit.data?.result.context;
  return (
    <DetailPageLayout>
      <PageHeader
        title="Lần xét tốt nghiệp đã lưu"
        actions={
          <Link
            to={
              context
                ? `${ROUTES.graduation}?${new URLSearchParams({ studentId: context.studentId, programId: context.programId, semesterId: context.semesterId })}`
                : ROUTES.graduation
            }
          >
            Xét từng sinh viên
          </Link>
        }
      />
      {audit.isPending ? (
        <Skeleton active />
      ) : audit.isError ? (
        <GraduationError
          error={audit.error}
          onRetry={() => void audit.refetch()}
        />
      ) : (
        <>
          <GraduationAuditSummary audit={audit.data} />
          <GraduationResultView result={audit.data.result} />
          <GraduationReauditPanel
            key={audit.data.contextId}
            lookup={{
              studentId: audit.data.result.context.studentId,
              programId: audit.data.result.context.programId,
              semesterId: audit.data.result.context.semesterId,
            }}
          />
        </>
      )}
    </DetailPageLayout>
  );
}
