import { Button, Flex, Table } from 'antd';
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
  onSelectTrack?: (enrollment: StudentEnrollment) => void;
}
export function EnrollmentHistoryTable({
  enrollments,
  canManage,
  onTransfer,
  onSelectTrack,
}: EnrollmentHistoryTableProps) {
  return (
    <Table<StudentEnrollment>
      rowKey="id"
      pagination={false}
      dataSource={enrollments}
      scroll={{ x: 1360 }}
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
          title: 'Định hướng / Chuyên ngành con',
          render: (_, enrollment) =>
            enrollment.track
              ? `${enrollment.track.trackCode} — ${enrollment.track.trackName}`
              : '—',
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
          render: (_, enrollment) => {
            const v = enrollment.appliedVersion as {
              versionNumber: string | null;
              decisionNumber?: string | null;
            };
            return v.decisionNumber
              ? `${v.versionNumber ?? '—'} (${v.decisionNumber})`
              : v.versionNumber;
          },
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
                    <Flex gap={8} wrap>
                      <Button onClick={() => onTransfer(enrollment)}>
                        Chuyển chương trình
                      </Button>
                      {onSelectTrack && (
                        <Button onClick={() => onSelectTrack(enrollment)}>
                          Chọn định hướng
                        </Button>
                      )}
                    </Flex>
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
