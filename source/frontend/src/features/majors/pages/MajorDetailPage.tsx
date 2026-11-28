import {
  App,
  Breadcrumb,
  Button,
  Flex,
  Result,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { withQuery } from '../../../shared/api/client';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { useCan } from '../../../shared/auth/useCan';
import { PageHeader, PageSkeleton } from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { MajorStatus } from '../api/majors';
import { MajorDetailTabs } from '../components/MajorDetailTabs';
import { MajorFormModal } from '../components/MajorFormModal';
import { MajorKpiStrip } from '../components/MajorKpiStrip';
import {
  DEGREE_GROUP_SHORT_LABELS,
  MAJOR_STATUS_COLORS,
  MAJOR_STATUS_LABELS,
} from '../constants/majorLabels';
import { useMajorOverview, useSetMajorStatus } from '../hooks/useMajors';

export function MajorDetailPage() {
  const { majorId = '' } = useParams();
  const { message } = App.useApp();
  const canManage = useCan(PERMISSIONS.programEditInfo);
  const [editOpen, setEditOpen] = useState(false);

  const overviewQuery = useMajorOverview(majorId);
  const statusMutation = useSetMajorStatus();

  if (overviewQuery.isPending) {
    return <PageSkeleton blocks={3} />;
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <Result
        status="error"
        title="Không tải được thông tin ngành đào tạo"
        subTitle={errorMessage(
          overviewQuery.error,
          'Ngành đào tạo không tồn tại hoặc bạn không có quyền truy cập.',
        )}
        extra={
          <Space>
            <Link to={ROUTES.majors}>
              <Button type="primary">Quay lại danh mục ngành</Button>
            </Link>
            <Button onClick={() => void overviewQuery.refetch()}>
              Thử lại
            </Button>
          </Space>
        }
      />
    );
  }

  const overview = overviewQuery.data;
  const { major, stats } = overview;

  const handleStatusToggle = () => {
    const next: MajorStatus = major.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    statusMutation.mutate(
      { majorId: major.id, status: next },
      {
        onSuccess: () => void message.success('Đã cập nhật trạng thái ngành.'),
        onError: (err) =>
          void message.error(
            errorMessage(err, 'Không đổi được trạng thái ngành.'),
          ),
      },
    );
  };

  return (
    <Flex vertical gap="middle">
      <Breadcrumb
        items={[
          { title: <Link to={ROUTES.majors}>Ngành đào tạo</Link> },
          { title: `${major.majorCode} — ${major.majorName}` },
        ]}
      />

      <PageHeader
        title={major.majorName}
        subtitle={
          <Space wrap size={[8, 4]}>
            <Typography.Text code>{major.majorCode}</Typography.Text>
            {major.englishName && (
              <Typography.Text type="secondary">
                {major.englishName}
              </Typography.Text>
            )}
            {major.degreeGroup && (
              <Tag>
                {DEGREE_GROUP_SHORT_LABELS[major.degreeGroup] ??
                  major.degreeGroup}
              </Tag>
            )}
            {major.faculty ? (
              <Link
                to={withQuery(ROUTES.programs, { facultyId: major.faculty.id })}
              >
                {major.faculty.unitName}
              </Link>
            ) : (
              <Typography.Text type="secondary">
                Toàn trường / Chưa gán khoa
              </Typography.Text>
            )}
            <Tag color={MAJOR_STATUS_COLORS[major.status]}>
              {MAJOR_STATUS_LABELS[major.status]}
            </Tag>
          </Space>
        }
        actions={
          <Space wrap size="small">
            <Link
              to={withQuery(ROUTES.programs, {
                majorId: major.id,
                status: 'ALL',
              })}
            >
              <Button>Xem DS CTĐT</Button>
            </Link>
            <Link to={ROUTES.reportComparison}>
              <Button>So sánh CTĐT</Button>
            </Link>
            {canManage && (
              <>
                <Button type="primary" onClick={() => setEditOpen(true)}>
                  Sửa ngành
                </Button>
                <Button
                  loading={statusMutation.isPending}
                  onClick={handleStatusToggle}
                >
                  {major.status === 'ACTIVE' ? 'Ngừng' : 'Mở lại'}
                </Button>
              </>
            )}
          </Space>
        }
      />

      <MajorKpiStrip stats={stats} />
      <MajorDetailTabs overview={overview} />

      <MajorFormModal
        open={editOpen}
        editing={major}
        onClose={() => setEditOpen(false)}
      />
    </Flex>
  );
}
