import { useEffect } from 'react';
import { Alert, App, Button, Flex, Form, Input, Select, Space } from 'antd';
import { generatePath, useNavigate, useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { useCan } from '../../../shared/auth/useCan';
import {
  applyFieldErrors,
  errorMessage,
} from '../../../shared/forms/applyFieldErrors';
import { OrgUnitSelect } from '../../../shared/org-units/OrgUnitSelect';
import { useSubjectGroups } from '../../../shared/subject-groups/useSubjectGroups';
import type {
  CourseDetail,
  CourseType,
  UpdateCourseRequest,
} from '../api/courses';
import { ProgramsUsingList } from '../../../shared/courses/ProgramsUsingList';
import { COURSE_TYPE_LABELS } from '../constants/courseLabels';
import {
  useCourse,
  useCreateCourse,
  useUpdateCourse,
} from '../hooks/useCourses';
import { COURSE_RULES } from '../schema/courseRules';
import { PageHeader, PageSkeleton } from '../../../shared/design-system';

interface CourseFormValues {
  courseCode: string;
  courseName: string;
  englishName?: string;
  credits: string;
  courseType: CourseType;
  ownerFacultyId: string;
  ownerGroupId?: string | null;
}

const TYPE_OPTIONS = (Object.keys(COURSE_TYPE_LABELS) as CourseType[]).map(
  (value) => ({ value, label: COURSE_TYPE_LABELS[value] }),
);

function toFormValues(course: CourseDetail): CourseFormValues {
  return {
    courseCode: course.courseCode,
    courseName: course.courseName,
    englishName: course.englishName ?? undefined,
    credits: course.credits,
    courseType: course.courseType,
    ownerFacultyId: course.ownerFaculty.id,
    ownerGroupId: course.ownerGroup?.id ?? null,
  };
}

export function CourseFormPage() {
  const { courseId } = useParams();
  const editing = courseId !== undefined;
  const { message } = App.useApp();
  const { data: course, isPending } = useCourse(courseId ?? '', editing);
  const [form] = Form.useForm<CourseFormValues>();
  const facultyId = Form.useWatch('ownerFacultyId', form);
  const canPickGroup = useCan(PERMISSIONS.subjectGroupView);
  const { data: groups = [] } = useSubjectGroups(
    { facultyId, status: 'ACTIVE' },
    canPickGroup && Boolean(facultyId),
  );
  const create = useCreateCourse();
  const update = useUpdateCourse();
  const navigate = useNavigate();
  useEffect(() => {
    if (course) form.setFieldsValue(toFormValues(course));
  }, [course, form]);

  const groupOptions = groups.map((group) => ({
    value: group.id,
    label: `${group.groupCode} — ${group.groupName}`,
  }));
  const current = course?.ownerGroup;
  if (
    current &&
    course.ownerFaculty.id === facultyId &&
    !groupOptions.some((option) => option.value === current.id)
  )
    groupOptions.push({
      value: current.id,
      label: `${current.groupCode} — ${current.groupName}`,
    });

  const onFinish = (values: CourseFormValues) => {
    const onSuccess = (saved: CourseDetail) =>
      void navigate(generatePath(ROUTES.courseDetail, { courseId: saved.id }));
    const onError = (error: unknown) => {
      if (!applyFieldErrors(form, error))
        void message.error(errorMessage(error, 'Không lưu được học phần.'));
    };
    if (editing) {
      // ownerGroupId is sent only when the field is rendered: a hidden field would clear the group.
      const body: UpdateCourseRequest = {
        courseName: values.courseName,
        englishName: values.englishName ?? null,
        credits: values.credits,
        courseType: values.courseType,
        ownerFacultyId: values.ownerFacultyId,
        ...(canPickGroup ? { ownerGroupId: values.ownerGroupId ?? null } : {}),
      };
      update.mutate({ courseId, body }, { onSuccess, onError });
    } else {
      create.mutate(
        {
          courseCode: values.courseCode,
          courseName: values.courseName,
          englishName: values.englishName,
          credits: values.credits,
          courseType: values.courseType,
          ownerFacultyId: values.ownerFacultyId,
          ...(values.ownerGroupId ? { ownerGroupId: values.ownerGroupId } : {}),
        },
        { onSuccess, onError },
      );
    }
  };

  if (editing && isPending) return <PageSkeleton />;
  return (
    <Flex vertical gap="middle">
      <PageHeader
        title={
          <>
            {editing
              ? `Sửa học phần ${course?.courseCode ?? ''}`
              : 'Thêm học phần'}
          </>
        }
      />
      {course &&
        (course.programsUsing.length > 0 ? (
          <Alert
            type="warning"
            showIcon
            title="Học phần đang được dùng ở các chương trình sau"
            description={<ProgramsUsingList programs={course.programsUsing} />}
          />
        ) : (
          <ProgramsUsingList programs={[]} />
        ))}
      <Form<CourseFormValues>
        form={form}
        layout="vertical"
        onFinish={onFinish}
        style={{ maxWidth: 640 }}
      >
        <Form.Item
          name="courseCode"
          label="Mã học phần"
          rules={COURSE_RULES.courseCode}
          normalize={(value: string) => value.toUpperCase()}
        >
          <Input disabled={editing} />
        </Form.Item>
        <Form.Item
          name="courseName"
          label="Tên tiếng Việt"
          rules={COURSE_RULES.courseName}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="englishName"
          label="Tên tiếng Anh"
          rules={COURSE_RULES.englishName}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="credits"
          label="Số tín chỉ"
          rules={COURSE_RULES.credits}
        >
          <Input inputMode="decimal" placeholder="Ví dụ 3 hoặc 2.5" />
        </Form.Item>
        <Form.Item
          name="courseType"
          label="Loại học phần"
          rules={COURSE_RULES.courseType}
        >
          <Select options={TYPE_OPTIONS} placeholder="Chọn loại học phần" />
        </Form.Item>
        <Form.Item
          name="ownerFacultyId"
          label="Khoa phụ trách"
          rules={COURSE_RULES.ownerFacultyId}
        >
          <OrgUnitSelect
            types={['FACULTY']}
            allowClear={false}
            onChange={() => form.setFieldValue('ownerGroupId', null)}
          />
        </Form.Item>
        {canPickGroup && (
          <Form.Item
            name="ownerGroupId"
            label="Nhóm phụ trách"
            extra="Để trống với học phần của khoa khác."
          >
            <Select
              allowClear
              placeholder="Chọn nhóm chuyên môn"
              options={groupOptions}
            />
          </Form.Item>
        )}
        <Space>
          <Button
            type="primary"
            htmlType="submit"
            loading={create.isPending || update.isPending}
          >
            Lưu
          </Button>
          <Button
            onClick={() =>
              void navigate(
                course
                  ? generatePath(ROUTES.courseDetail, { courseId: course.id })
                  : ROUTES.courses,
              )
            }
          >
            Hủy
          </Button>
        </Space>
      </Form>
    </Flex>
  );
}
