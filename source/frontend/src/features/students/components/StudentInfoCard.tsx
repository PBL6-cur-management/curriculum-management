import { Card, Descriptions } from 'antd';
import { generatePath, Link } from 'react-router';
import { ROUTES } from '../../../routes';
import { StatusTag } from '../../../shared/design-system';
import type { StudentDetail } from '../api/students';
import {
  STUDENT_SOURCE_LABELS,
  STUDENT_STATUS_COLORS,
  STUDENT_STATUS_LABELS,
} from '../constants/studentLabels';

interface StudentInfoCardProps {
  student: StudentDetail;
  canViewAccount: boolean;
}
export function StudentInfoCard({
  student,
  canViewAccount,
}: StudentInfoCardProps) {
  return (
    <Card title="Hồ sơ sinh viên">
      <Descriptions
        column={{ xs: 1, sm: 2, md: 3 }}
        items={[
          { key: 'code', label: 'Mã sinh viên', children: student.studentCode },
          { key: 'name', label: 'Họ tên', children: student.fullName },
          { key: 'cohort', label: 'Khóa', children: student.cohort.cohortCode },
          { key: 'major', label: 'Mã ngành', children: student.major },
          {
            key: 'status',
            label: 'Trạng thái',
            children: (
              <StatusTag
                status={student.status}
                colorMap={STUDENT_STATUS_COLORS}
                labelMap={STUDENT_STATUS_LABELS}
              />
            ),
          },
          {
            key: 'source',
            label: 'Nguồn dữ liệu',
            children: STUDENT_SOURCE_LABELS[student.dataSource],
          },
          {
            key: 'admission',
            label: 'Học kỳ nhập học',
            children: student.admissionSemester.semesterCode,
          },
          {
            key: 'effective',
            label: 'Học kỳ trạng thái',
            children: student.statusSemester.semesterCode,
          },
          {
            key: 'account',
            label: 'Tài khoản',
            children:
              student.userId && canViewAccount ? (
                <Link
                  to={generatePath(ROUTES.userDetail, {
                    userId: student.userId,
                  })}
                >
                  Xem tài khoản
                </Link>
              ) : (
                '—'
              ),
          },
        ]}
      />
    </Card>
  );
}
