import { Button, Table } from 'antd';
import { StatusTag } from '../../../shared/design-system';
import type { StudentEnrollment } from '../api/students';
import {
  ENROLLMENT_STATUS_COLORS,
  ENROLLMENT_STATUS_LABELS,
  ENROLLMENT_TYPE_LABELS,
} from '../constants/studentLabels';

interface EnrollmentHistoryTableProps {
  enrollments: StudentEnrollment[];
  canManage: boolean;
  onTransfer: (enrollment: StudentEnrollment) => void;
}
export function EnrollmentHistoryTable({
  enrollments,
  canManage,
  onTransfer,
}: EnrollmentHistoryTableProps) {
  return (
    <Table<StudentEnrollment>
      rowKey="id"
      pagination={false}
      dataSource={enrollments}
      scroll={{ x: 1200 }}
      locale={{
        emptyText:
          'Chưa có ghi danh. Cần gán chương trình hoặc kiểm tra danh sách nhập.',
      }}
      columns={[
        {
          title: 'Chương trình',
          render: (_, enrollment) =>
            `${enrollment.program.programCode} — ${enrollment.program.programName}`,
        },
        {
          title: 'Loại',
          render: (_, enrollment) =>
            ENROLLMENT_TYPE_LABELS[enrollment.enrollmentType],
        },
        {
          title: 'Khóa',
          render: (_, enrollment) => enrollment.cohort.cohortCode,
        },
        {
          title: 'Ghi danh đã lưu',
          render: (_, enrollment) => enrollment.appliedVersion.versionNumber,
        },
        { title: 'Phiên bản nhập học', dataIndex: 'admissionVersionId' },
        {
          title: 'Bắt đầu',
          render: (_, enrollment) => enrollment.fromSemester.semesterCode,
        },
        {
          title: 'Kết thúc (không gồm)',
          render: (_, enrollment) =>
            enrollment.untilSemester?.semesterCode ?? 'Chưa kết thúc',
        },
        {
          title: 'Cách áp dụng',
          render: (_, enrollment) =>
            enrollment.isException ? 'Ngoại lệ' : 'Theo khóa',
        },
        {
          title: 'Căn cứ / số quyết định',
          render: (_, enrollment) => enrollment.basisDecision ?? '—',
        },
        {
          title: 'Trạng thái',
          render: (_, enrollment) => (
            <StatusTag
              status={enrollment.status}
              colorMap={ENROLLMENT_STATUS_COLORS}
              labelMap={ENROLLMENT_STATUS_LABELS}
            />
          ),
        },
        ...(canManage
          ? [
              {
                title: 'Thao tác',
                render: (_: unknown, enrollment: StudentEnrollment) =>
                  enrollment.status === 'ACTIVE' ? (
                    <Button onClick={() => onTransfer(enrollment)}>
                      Chuyển chương trình
                    </Button>
                  ) : (
                    'Ghi danh đã đóng'
                  ),
              },
            ]
          : []),
      ]}
    />
  );
}
