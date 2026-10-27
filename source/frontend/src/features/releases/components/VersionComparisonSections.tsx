import {
  Alert,
  Button,
  Card,
  Collapse,
  Flex,
  Result,
  Tag,
  Typography,
} from 'antd';
import { Link } from 'react-router';
import { ApiError } from '../../../shared/api/client';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { VersionComparison } from '../api/releases';
import { COMPARISON_OPERATIONS } from '../constants/releaseLabels';
import { comparisonPath } from '../utils/versionComparison';
import { ComparisonFieldsTable } from './ComparisonFieldsTable';

interface VersionComparisonSectionsProps {
  programId: string;
  beforeVersionId: string;
  afterVersionId: string;
  sections: (Omit<VersionComparison['sections'][number], 'key'> & {
    key: string;
  })[];
}
export function ReleaseQueryError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  if (
    error instanceof ApiError &&
    (error.status === 403 || error.status === 404)
  )
    return (
      <Result
        status={error.status === 403 ? '403' : '404'}
        title={
          error.status === 403
            ? 'Bạn không có quyền xem dữ liệu này'
            : 'Không tìm thấy dữ liệu được yêu cầu'
        }
        extra={<Button onClick={retry}>Thử lại</Button>}
      />
    );
  return (
    <Alert
      type="error"
      showIcon
      title={errorMessage(error, 'Không tải được dữ liệu. Vui lòng thử lại.')}
      action={<Button onClick={retry}>Thử lại</Button>}
    />
  );
}
export function VersionComparisonSections({
  sections,
  programId,
  beforeVersionId,
  afterVersionId,
}: VersionComparisonSectionsProps) {
  return (
    <Collapse
      defaultActiveKey={sections.map((section) => section.key)}
      items={sections.map((section) => ({
        key: section.key,
        label: section.title,
        children:
          section.rows.length === 0 ? (
            <Typography.Text>Không thay đổi</Typography.Text>
          ) : (
            <Flex vertical gap="middle">
              {COMPARISON_OPERATIONS.map((operation) => {
                const rows = section.rows.filter(
                  (row) => row.change === operation.change,
                );
                return rows.length === 0 ? null : (
                  <section
                    key={operation.change}
                    aria-label={`${section.title} — ${operation.label}`}
                  >
                    <Tag color={operation.color}>
                      {operation.label} ({rows.length})
                    </Tag>
                    {rows.map((row) => (
                      <Card key={row.itemKey} size="small" title={row.label}>
                        <ComparisonFieldsTable fields={row.fields} />
                        {row.syllabusComparison && (
                          <Link
                            to={comparisonPath(
                              programId,
                              beforeVersionId,
                              afterVersionId,
                              row.syllabusComparison.courseId,
                            )}
                          >
                            Xem khác biệt đề cương
                          </Link>
                        )}
                      </Card>
                    ))}
                  </section>
                );
              })}
            </Flex>
          ),
      }))}
    />
  );
}
