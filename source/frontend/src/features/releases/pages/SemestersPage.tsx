import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Result, Table, Typography } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router';
import { ROUTES } from '../../../routes';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { useCan } from '../../../shared/auth/useCan';
import { ApiError } from '../../../shared/api/client';
import type { Cohort, Semester } from '../../../shared/releases/semesters';
import {
  useCohorts,
  useSemesters,
} from '../../../shared/releases/useReleaseOptions';
import { CohortForm } from '../components/CohortForm';
import { SemesterForm } from '../components/SemesterForm';
import { formatDay } from '../utils/format';

type SemesterDialog = { semester?: Semester } | null;
type CohortDialog = { cohort?: Cohort } | null;

// MH-10 (US-071): terms and intakes a release names. There is no delete: a semester or cohort a version stands on
// must stay, and one nobody uses costs nothing. Reassigning cohorts is F-16.
export function SemestersPage() {
  const canAssign = useCan(PERMISSIONS.versionAssignCohort);
  const semesters = useSemesters();
  const cohorts = useCohorts();
  const [semesterDialog, setSemesterDialog] = useState<SemesterDialog>(null);
  const [cohortDialog, setCohortDialog] = useState<CohortDialog>(null);
  if (semesters.error instanceof ApiError && semesters.error.status === 403)
    return <Result status="403" title="Bạn không có quyền xem màn hình này" />;
  return (
    <Flex vertical gap="large">
      <Typography.Title level={2} style={{ margin: 0 }}>
        Học kỳ và khóa tuyển sinh
      </Typography.Title>
      {canAssign && (
        <Link to={ROUTES.cohortVersionAssignmentStart}>
          Gán phiên bản cho khóa
        </Link>
      )}
      <Card
        title="Học kỳ"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setSemesterDialog({})}
          >
            Thêm học kỳ
          </Button>
        }
      >
        <Table<Semester>
          rowKey="id"
          size="small"
          loading={semesters.isPending}
          dataSource={semesters.data ?? []}
          pagination={false}
          columns={[
            { title: 'Mã học kỳ', dataIndex: 'semesterCode' },
            { title: 'Năm học', dataIndex: 'academicYear' },
            { title: 'Học kỳ trong năm', dataIndex: 'termInYear' },
            {
              title: 'Ngày bắt đầu',
              dataIndex: 'startDate',
              render: (day: string | null) =>
                day ? formatDay(day) : 'Chưa có',
            },
            {
              title: '',
              key: 'actions',
              render: (_: unknown, semester) => (
                <Button
                  type="link"
                  aria-label={`Sửa học kỳ ${semester.semesterCode}`}
                  onClick={() => setSemesterDialog({ semester })}
                >
                  Sửa
                </Button>
              ),
            },
          ]}
        />
      </Card>
      <Card
        title="Khóa tuyển sinh"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCohortDialog({})}
          >
            Thêm khóa
          </Button>
        }
      >
        <Table<Cohort>
          rowKey="id"
          size="small"
          loading={cohorts.isPending}
          dataSource={cohorts.data ?? []}
          pagination={false}
          columns={[
            { title: 'Mã khóa', dataIndex: 'cohortCode' },
            { title: 'Năm tuyển sinh', dataIndex: 'intakeYear' },
            {
              title: '',
              key: 'actions',
              render: (_: unknown, cohort) => (
                <Button
                  type="link"
                  aria-label={`Sửa khóa ${cohort.cohortCode}`}
                  onClick={() => setCohortDialog({ cohort })}
                >
                  Sửa
                </Button>
              ),
            },
          ]}
        />
      </Card>
      {semesterDialog && (
        <SemesterForm
          semester={semesterDialog.semester}
          onClose={() => setSemesterDialog(null)}
        />
      )}
      {cohortDialog && (
        <CohortForm
          cohort={cohortDialog.cohort}
          onClose={() => setCohortDialog(null)}
        />
      )}
    </Flex>
  );
}
