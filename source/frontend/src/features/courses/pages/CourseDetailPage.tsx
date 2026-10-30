import { FileTextOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Result } from 'antd';
import { generatePath, Link, useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { ApiError } from '../../../shared/api/client';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { useCan } from '../../../shared/auth/useCan';
import { CourseEditButton } from '../components/CourseEditButton';
import { CourseInfoCard } from '../components/CourseInfoCard';
import { CourseRelationsSection } from '../components/CourseRelationsSection';
import { CourseStatusActions } from '../components/CourseStatusActions';
import { EquivalentCoursesCard } from '../components/EquivalentCoursesCard';
import { ProgramsUsingList } from '../../../shared/courses/ProgramsUsingList';
import { PROGRAMS_USING_TITLE, SYLLABUS_LINK } from '../constants/courseLabels';
import { useCourse } from '../hooks/useCourses';
import {
  BackLink,
  PageHeader,
  PageSkeleton,
} from '../../../shared/design-system';

export function CourseDetailPage() {
  const { courseId = '' } = useParams();
  const { data: course, isPending, error } = useCourse(courseId);
  const canViewSyllabus = useCan(PERMISSIONS.syllabusView);
  if (isPending) return <PageSkeleton />;
  if (!course) {
    if (error instanceof ApiError && error.status === 403)
      return (
        <Result status="403" title="Bạn không có quyền xem học phần này" />
      );
    return <Result status="404" title="Không tìm thấy học phần" />;
  }
  return (
    <Flex vertical gap="middle">
      <BackLink to={ROUTES.courses}>Danh mục học phần</BackLink>
      <PageHeader
        title={
          <>
            {course.courseCode} — {course.courseName}
          </>
        }
        actions={
          <>
            {canViewSyllabus && (
              <Link to={generatePath(ROUTES.syllabus, { courseId: course.id })}>
                <Button icon={<FileTextOutlined />}>{SYLLABUS_LINK}</Button>
              </Link>
            )}
            <CourseEditButton course={course} />
            {course.canChangeStatus && <CourseStatusActions course={course} />}
          </>
        }
      />
      <CourseInfoCard course={course} />
      <CourseRelationsSection course={course} />
      <EquivalentCoursesCard course={course} />
      <Card title={PROGRAMS_USING_TITLE}>
        <ProgramsUsingList programs={course.programsUsing} />
      </Card>
    </Flex>
  );
}
