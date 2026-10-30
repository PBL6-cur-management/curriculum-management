import { Button, Flex, Result, Table, Typography } from 'antd';
import { useState } from 'react';
import { generatePath, Link, useNavigate, useParams } from 'react-router';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { useCan } from '../../../shared/auth/useCan';
import {
  comparisonPath,
  isIssuedVersion,
  VERSION_COMPARISON_SELECTION_SIZE,
} from '../utils/versionComparison';
import { ROUTES } from '../../../routes';
import { ApiError } from '../../../shared/api/client';
import { versionLabel } from '../../../shared/constants/versionLabels';
import type { VersionRef } from '../api/releases';
import { VersionStatusTag } from '../components/VersionStatusTag';
import { NO_VERSIONS } from '../constants/releaseLabels';
import { useVersionHistory } from '../hooks/useReleases';
import { formatDay } from '../utils/format';
import {
  BackLink,
  formatEmpty,
  PageHeader,
  PageSkeleton,
} from '../../../shared/design-system';

// MH-46: every version of a program, newest first, scoped like the program itself.
export function VersionHistoryPage() {
  const { programId = '' } = useParams();
  const canCompare = useCan(PERMISSIONS.versionCompare);
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const { data, isPending, error } = useVersionHistory(programId);
  if (isPending) return <PageSkeleton />;
  if (!data) {
    if (error instanceof ApiError && error.status === 403)
      return (
        <Result
          status="403"
          title="Bạn không có quyền xem lịch sử chương trình này"
        />
      );
    return <Result status="404" title="Không tìm thấy chương trình" />;
  }
  return (
    <Flex vertical gap="middle">
      <BackLink to={generatePath(ROUTES.programDetail, { programId })}>
        Chương trình
      </BackLink>
      <PageHeader title="Lịch sử phiên bản" />
      {canCompare && (
        <Button
          type="primary"
          disabled={selected.length !== VERSION_COMPARISON_SELECTION_SIZE}
          onClick={() =>
            void navigate(comparisonPath(programId, selected[0]!, selected[1]!))
          }
        >
          So sánh hai phiên bản
        </Button>
      )}
      <Typography.Text type="secondary">
        Các khóa có dòng gán cho phiên bản này; xem màn hình gán khóa để xác
        định theo học kỳ.
      </Typography.Text>
      <Table<VersionRef>
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={data.versions}
        rowSelection={
          canCompare
            ? {
                hideSelectAll: true,
                selectedRowKeys: selected,
                onChange: (keys) => {
                  if (keys.length <= VERSION_COMPARISON_SELECTION_SIZE)
                    setSelected(keys.map(String));
                },
                getCheckboxProps: (version) => ({
                  disabled:
                    !isIssuedVersion(version) ||
                    (selected.length === VERSION_COMPARISON_SELECTION_SIZE &&
                      !selected.includes(version.id)),
                  'aria-label': `Chọn phiên bản ${versionLabel(version)}`,
                }),
              }
            : undefined
        }
        locale={{ emptyText: NO_VERSIONS }}
        columns={[
          {
            title: 'Số phiên bản',
            key: 'number',
            render: (_: unknown, version) => (
              <Link
                to={generatePath(
                  version.status === 'DRAFT'
                    ? ROUTES.curriculum
                    : ROUTES.versionDetail,
                  { programId, versionId: version.id },
                )}
              >
                {versionLabel(version)}
              </Link>
            ),
          },
          {
            title: 'Trạng thái',
            key: 'status',
            render: (_: unknown, version) => (
              <VersionStatusTag status={version.status} />
            ),
          },
          {
            title: 'Số quyết định',
            dataIndex: 'decisionNumber',
            render: (value: string | null) => formatEmpty(value),
          },
          {
            title: 'Ngày ký',
            dataIndex: 'signedDate',
            render: (day: string | null) => formatDay(day),
          },
          {
            title: 'Học kỳ hiệu lực',
            key: 'semester',
            render: (_: unknown, version) =>
              formatEmpty(version.effectiveSemester?.semesterCode),
          },
          {
            title: 'Khóa áp dụng',
            key: 'cohorts',
            render: (_: unknown, version) =>
              formatEmpty(
                version.cohorts.map((cohort) => cohort.cohortCode).join(', '),
                'Chưa gán',
              ),
          },
          {
            title: 'Đề xuất gốc',
            key: 'origin',
            render: (_: unknown, version) =>
              version.originRequest ? (
                <Link
                  to={generatePath(ROUTES.changeRequestDetail, {
                    requestId: version.originRequest.id,
                  })}
                >
                  {version.originRequest.requestCode}
                </Link>
              ) : (
                'Ban hành trực tiếp'
              ),
          },
          {
            title: 'Đính chính',
            key: 'corrected',
            render: (_: unknown, version) =>
              version.correctedBy
                ? `Đã được đính chính bởi ${versionLabel(version.correctedBy)}`
                : formatEmpty(null, 'Không'),
          },
        ]}
      />
    </Flex>
  );
}
