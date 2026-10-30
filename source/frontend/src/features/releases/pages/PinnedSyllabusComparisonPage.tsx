import { Alert, Skeleton, Typography } from 'antd';
import { useParams, useSearchParams } from 'react-router';
import { DetailPageLayout } from '../../../shared/design-system/DetailPageLayout';
import { PageHeader } from '../../../shared/design-system/PageHeader';
import {
  ReleaseQueryError,
  VersionComparisonSections,
} from '../components/VersionComparisonSections';
import { usePinnedSyllabusComparison } from '../hooks/useReleases';
import { comparisonPath } from '../utils/versionComparison';
import { BackLink } from '../../../shared/design-system';

export function PinnedSyllabusComparisonPage() {
  const { programId = '', courseId = '' } = useParams();
  const [search] = useSearchParams();
  const before = search.get('beforeVersionId') ?? '';
  const after = search.get('afterVersionId') ?? '';
  const query = usePinnedSyllabusComparison(programId, courseId, before, after);
  return (
    <DetailPageLayout>
      <BackLink to={comparisonPath(programId, before, after)}>
        So sánh phiên bản
      </BackLink>
      <PageHeader title="Khác biệt đề cương đã ghim" />
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
            <Typography.Paragraph>
              {query.data.courseCode} · Bản trước: đề cương lần{' '}
              {query.data.before.revisionNumber} ({query.data.before.id}) · Bản
              sau: đề cương lần {query.data.after.revisionNumber} (
              {query.data.after.id})
            </Typography.Paragraph>
            <VersionComparisonSections
              programId={programId}
              beforeVersionId={before}
              afterVersionId={after}
              sections={query.data.sections.map((section) => ({
                key: section.entityType,
                title: section.title,
                rows: section.rows.map((row) => ({
                  ...row,
                  syllabusComparison: null,
                })),
              }))}
            />
          </>
        )
      )}
    </DetailPageLayout>
  );
}
