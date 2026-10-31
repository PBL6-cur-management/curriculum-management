import { Alert, Card, Flex, Skeleton, Typography } from 'antd';
import {
  generatePath,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router';
import { ROUTES } from '../../../routes';
import { DetailPageLayout } from '../../../shared/design-system/DetailPageLayout';
import { PageHeader } from '../../../shared/design-system/PageHeader';
import { VersionComparisonSelectors } from '../components/VersionComparisonSelectors';
import {
  ReleaseQueryError,
  VersionComparisonSections,
} from '../components/VersionComparisonSections';
import { VersionStatusTag } from '../components/VersionStatusTag';
import { useVersionComparison, useVersionHistory } from '../hooks/useReleases';
import { comparisonPath } from '../utils/versionComparison';
import { BackLink } from '../../../shared/design-system';
import { formatDecisionNumber } from '../../../shared/releases/decisionNumber';

export function VersionComparisonPage() {
  const { programId = '' } = useParams();
  const [search] = useSearchParams();
  const before = search.get('beforeVersionId') ?? '';
  const after = search.get('afterVersionId') ?? '';
  const history = useVersionHistory(programId);
  const query = useVersionComparison(programId, before, after);
  const navigate = useNavigate();
  return (
    <DetailPageLayout>
      <BackLink to={generatePath(ROUTES.versionHistory, { programId })}>
        Lịch sử phiên bản
      </BackLink>
      <PageHeader title="So sánh phiên bản" />
      {history.error ? (
        <ReleaseQueryError
          error={history.error}
          retry={() => void history.refetch()}
        />
      ) : history.isPending ? (
        <Skeleton active />
      ) : (
        <VersionComparisonSelectors
          versions={history.data?.versions ?? []}
          beforeVersionId={before}
          afterVersionId={after}
          onCompare={(left, right) =>
            void navigate(comparisonPath(programId, left, right))
          }
        />
      )}
      {!before || !after ? (
        <Alert type="info" title="Chọn hai phiên bản đã ban hành để so sánh." />
      ) : query.error ? (
        <ReleaseQueryError
          error={query.error}
          retry={() => void query.refetch()}
        />
      ) : query.isPending ? (
        <Skeleton active />
      ) : (
        query.data && (
          <>
            <Flex gap="middle" wrap>
              {(['before', 'after'] as const).map((side) => {
                const version = query.data[side];
                return (
                  <Card
                    key={side}
                    size="small"
                    title={
                      side === 'before' ? 'Phiên bản trước' : 'Phiên bản sau'
                    }
                    style={{ flex: '1 1 260px' }}
                  >
                    <Typography.Text strong>
                      {version.versionNumber}
                    </Typography.Text>{' '}
                    <VersionStatusTag status={version.status} />
                    <div>{formatDecisionNumber(version.decisionNumber)}</div>
                    <div>
                      {version.effectiveSemester.semesterCode} ·{' '}
                      {version.effectiveSemester.startDate ??
                        'Chưa có ngày bắt đầu'}
                    </div>
                  </Card>
                );
              })}
            </Flex>
            <VersionComparisonSections
              programId={programId}
              beforeVersionId={before}
              afterVersionId={after}
              sections={query.data.sections}
            />
          </>
        )
      )}
    </DetailPageLayout>
  );
}
