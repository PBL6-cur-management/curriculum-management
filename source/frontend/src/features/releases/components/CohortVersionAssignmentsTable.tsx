import { Button, Table } from 'antd';
import { generatePath, Link } from 'react-router';
import { ROUTES } from '../../../routes';
import type { CohortVersionAssignment } from '../api/releases';
import { VersionStatusTag } from './VersionStatusTag';
import { formatDecisionNumber } from '../../../shared/releases/decisionNumber';

interface CohortVersionAssignmentsTableProps {
  programId: string;
  assignments: CohortVersionAssignment[];
  onEdit: (id: string) => void;
}
export function CohortVersionAssignmentsTable({
  programId,
  assignments,
  onEdit,
}: CohortVersionAssignmentsTableProps) {
  return (
    <Table<CohortVersionAssignment>
      rowKey="id"
      size="small"
      pagination={false}
      dataSource={assignments}
      scroll={{ x: 760 }}
      locale={{ emptyText: 'Chương trình chưa được gán cho khóa nào.' }}
      columns={[
        { title: 'Khóa', render: (_, row) => row.cohort.cohortCode },
        {
          title: 'Phiên bản',
          render: (_, row) => (
            <>
              <Link
                to={generatePath(ROUTES.versionDetail, {
                  programId,
                  versionId: row.version.id,
                })}
              >
                {row.version.versionNumber}
              </Link>{' '}
              <VersionStatusTag status={row.version.status} />
            </>
          ),
        },
        {
          title: 'Số quyết định',
          render: (_, row) => formatDecisionNumber(row.version.decisionNumber),
        },
        {
          title: 'Từ học kỳ / ngày bắt đầu',
          render: (_, row) =>
            `${row.fromSemester.semesterCode} · ${row.fromSemester.startDate ?? 'Chưa có ngày bắt đầu'}`,
        },
        {
          title: 'Thao tác',
          render: (_, row) => (
            <Button onClick={() => onEdit(row.id)}>Sửa học kỳ áp dụng</Button>
          ),
        },
      ]}
    />
  );
}
