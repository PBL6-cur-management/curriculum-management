import { Alert, Button, Card, Popconfirm, Table, App } from 'antd';
import type { TableColumnsType } from 'antd';
import { useState } from 'react';
import { Link, generatePath } from 'react-router';
import { ROUTES } from '../../../routes';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { useCan } from '../../../shared/auth/useCan';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { CourseRelation, RelatedCourse } from '../api/courseRelations';
import type { CourseDetail } from '../api/courses';
import { CreateRequestButton } from '../../../shared/change-requests/CreateRequestButton';
import { relationLabel, type RelationSide } from '../constants/relationLabels';
import {
  useCourseRelations,
  useDeleteCourseRelation,
} from '../hooks/useCourseRelations';
import { AddRelationModal } from './AddRelationModal';
import { CourseStatusTag } from './CourseStatusTag';
import { MinScoreCell } from './MinScoreCell';

interface CourseRelationsSectionProps {
  course: CourseDetail;
}

interface RelationRow {
  relation: CourseRelation;
  label: string;
  other: RelatedCourse;
}

function toRelationRow(
  relation: CourseRelation,
  courseId: string,
): RelationRow {
  const side: RelationSide =
    relation.sourceCourse.id === courseId ? 'source' : 'target';
  return {
    relation,
    label: relationLabel(relation.relationType, side),
    other: side === 'source' ? relation.targetCourse : relation.sourceCourse,
  };
}

export function CourseRelationsSection({
  course,
}: CourseRelationsSectionProps) {
  const {
    data: relations = [],
    isPending,
    error,
  } = useCourseRelations(course.id);
  const [adding, setAdding] = useState(false);
  const canAdd =
    useCan(PERMISSIONS.courseRelationEdit) && course.status !== 'CANCELLED';
  const { message } = App.useApp();
  const remove = useDeleteCourseRelation();
  const rows = relations.map((relation) => toRelationRow(relation, course.id));

  const columns: TableColumnsType<RelationRow> = [
    { title: 'Quan hệ', dataIndex: 'label' },
    {
      title: 'Học phần',
      render: (_value, { other }) => (
        <>
          <Link to={generatePath(ROUTES.courseDetail, { courseId: other.id })}>
            {other.courseCode} — {other.courseName}
          </Link>{' '}
          <CourseStatusTag status={other.status} />
        </>
      ),
    },
    {
      title: 'Ngưỡng điểm',
      render: (_value, { relation }) => <MinScoreCell relation={relation} />,
    },
    {
      title: 'Thao tác',
      render: (_value, { relation }) => {
        if (relation.editPath === 'VIA_REQUEST')
          return (
            <CreateRequestButton
              size="small"
              prefill={{
                type: 'COURSE_RELATION',
                targetType: 'COURSE',
                targetId: course.id,
              }}
            />
          );
        if (relation.editPath === null) return null;
        return (
          <Popconfirm
            title="Xóa quan hệ này?"
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={() =>
              remove.mutateAsync(relation.id).catch((reason: unknown) => {
                void message.error(
                  errorMessage(reason, 'Không xóa được quan hệ.'),
                );
              })
            }
          >
            <Button type="link" danger size="small">
              Xóa
            </Button>
          </Popconfirm>
        );
      },
    },
  ];

  return (
    <Card
      title="Quan hệ học phần"
      extra={
        canAdd && <Button onClick={() => setAdding(true)}>Thêm quan hệ</Button>
      }
    >
      {error ? (
        <Alert
          type="error"
          showIcon
          title={errorMessage(error, 'Không tải được quan hệ học phần.')}
        />
      ) : (
        <Table
          rowKey={(row) => row.relation.id}
          loading={isPending}
          columns={columns}
          dataSource={rows}
          pagination={false}
          locale={{ emptyText: 'Chưa có quan hệ nào' }}
        />
      )}
      {adding && (
        <AddRelationModal course={course} onClose={() => setAdding(false)} />
      )}
    </Card>
  );
}
