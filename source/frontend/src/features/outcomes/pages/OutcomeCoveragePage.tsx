import { Alert, Flex, Result, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { generatePath, Link, useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { ApiError } from '../../../shared/api/client';
import { versionLabel } from '../../../shared/constants/versionLabels';
import type { components } from '../../../shared/api/schema';
import { CoverageSection } from '../components/CoverageSection';
import { GROUP_FILTER_NOTE } from '../constants/outcomeLabels';
import { useOutcomeCoverage } from '../hooks/useOutcomes';
import {
  PageHeader,
  PageSkeleton,
  SummaryStrip,
} from '../../../shared/design-system';

type PloGap = components['schemas']['PloHeaderDto'];
type CloGap = components['schemas']['CloGapDto'];
type CourseGap = components['schemas']['CourseGapDto'];

export function OutcomeCoveragePage() {
  const { programId = '', versionId = '' } = useParams();
  const { data, isPending, error } = useOutcomeCoverage(versionId);
  if (isPending) return <PageSkeleton />;
  if (!data) {
    if (error instanceof ApiError && error.status === 403)
      return <Result status="403" title="Bạn không có quyền xem báo cáo này" />;
    return (
      <Result status="404" title="Không tìm thấy phiên bản chương trình" />
    );
  }
  const params = { programId, versionId };
  const fixIn = (route: string, label: string) => ({
    title: 'Xử lý',
    width: 170,
    render: () => <Link to={generatePath(route, params)}>{label}</Link>,
  });
  const ploColumns: TableColumnsType<PloGap> = [
    { title: 'PLO', dataIndex: 'ploCode', width: 90 },
    { title: 'Mô tả', dataIndex: 'description' },
    fixIn(ROUTES.coursePloMatrix, 'Ma trận học phần–PLO'),
  ];
  const cloColumns: TableColumnsType<CloGap> = [
    {
      title: 'Học phần',
      render: (_value, row) => `${row.courseCode} — ${row.courseName}`,
    },
    { title: 'CLO', dataIndex: 'cloCode', width: 90 },
    { title: 'Mô tả', dataIndex: 'cloDescription' },
    {
      title: 'Xử lý',
      width: 170,
      render: (_value, row) => (
        <Link
          to={generatePath(ROUTES.itemCloPlo, {
            ...params,
            itemId: row.itemId,
          })}
        >
          Ma trận CLO–PLO
        </Link>
      ),
    },
  ];
  const courseColumns: TableColumnsType<CourseGap> = [
    { title: 'HK', dataIndex: 'plannedSemester', width: 60 },
    {
      title: 'Học phần',
      render: (_value, row) => `${row.courseCode} — ${row.courseName}`,
    },
    fixIn(ROUTES.coursePloMatrix, 'Ma trận học phần–PLO'),
  ];
  return (
    <Flex vertical gap="large">
      <PageHeader
        title={
          <>
            Kiểm tra phủ chuẩn đầu ra — {data.version.programName} (
            {versionLabel(data.version)})
          </>
        }
        subtitle="Chỉ để theo dõi: thiếu sót không chặn việc lưu."
      />
      <SummaryStrip
        label="Thiếu sót chuẩn đầu ra"
        items={[
          {
            label: 'PLO chưa có học phần',
            value: data.plosWithoutCourse.length,
            tone: data.plosWithoutCourse.length ? 'warning' : 'success',
          },
          {
            label: 'CLO chưa gắn PLO',
            value: data.closWithoutPlo.length,
            tone: data.closWithoutPlo.length ? 'warning' : 'success',
          },
          {
            label: 'Học phần chưa gắn PLO',
            value: data.coursesWithoutPlo.length,
            tone: data.coursesWithoutPlo.length ? 'warning' : 'success',
          },
          {
            label: 'Học phần chưa có đề cương',
            value: data.coursesWithoutSyllabus,
          },
        ]}
      />
      {data.filteredToGroups && (
        <Alert type="info" showIcon title={GROUP_FILTER_NOTE} />
      )}
      <CoverageSection
        title="PLO chưa có học phần"
        rows={data.plosWithoutCourse}
        rowKey={(row) => row.id}
        columns={ploColumns}
      />
      <CoverageSection
        title="CLO chưa gắn PLO"
        rows={data.closWithoutPlo}
        rowKey={(row) => `${row.itemId}:${row.cloId}`}
        columns={cloColumns}
      />
      <CoverageSection
        title="Học phần chưa gắn PLO"
        rows={data.coursesWithoutPlo}
        rowKey={(row) => row.itemId}
        columns={courseColumns}
      />
      <Typography.Text type="secondary">
        {`Học phần chưa có đề cương (không xét CLO): ${data.coursesWithoutSyllabus}`}
      </Typography.Text>
    </Flex>
  );
}
