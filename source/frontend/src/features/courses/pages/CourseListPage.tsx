import { useCallback, useState } from 'react';
import { Button, Flex, Result, Table, Tag } from 'antd';
import type { TableColumnsType, TableProps } from 'antd';
import { Link, generatePath, useNavigate } from 'react-router';
import { ROUTES } from '../../../routes';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from '../../../shared/api/pagination';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { useCan } from '../../../shared/auth/useCan';
import type {
  CourseQuery,
  CourseStatus,
  CourseSummary,
  CourseType,
} from '../api/courses';
import { CourseFilters } from '../components/CourseFilters';
import { CourseStatusTag } from '../components/CourseStatusTag';
import {
  COURSE_TYPE_LABELS,
  FOREIGN_COURSE_LABEL,
} from '../constants/courseLabels';
import { useCourseList } from '../hooks/useCourses';
import { formatEmpty, PageHeader } from '../../../shared/design-system';

const INITIAL_QUERY: CourseQuery = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  sort: 'courseCode',
  order: 'asc',
};
const SORT_KEYS = ['courseCode', 'courseName', 'credits', 'updatedAt'] as const;

type CourseSorter = Parameters<
  NonNullable<TableProps<CourseSummary>['onChange']>
>[2];

// Maps AntD's sorter ('ascend' | 'descend' | none) to the API's sort and order,
// falling back to code ascending, and keeps the page and page size.
export function toCourseQuery(
  query: CourseQuery,
  pagination: { current?: number; pageSize?: number },
  sorter: CourseSorter,
): CourseQuery {
  const single = Array.isArray(sorter) ? sorter[0] : sorter;
  const key = SORT_KEYS.find((candidate) => candidate === single?.columnKey);
  const sorted = key !== undefined && single?.order !== undefined;
  return {
    ...query,
    page: pagination.current ?? query.page,
    pageSize: pagination.pageSize ?? query.pageSize,
    sort: sorted ? key : INITIAL_QUERY.sort,
    order: sorted && single?.order === 'descend' ? 'desc' : 'asc',
  };
}

function sortOrderOf(query: CourseQuery, key: (typeof SORT_KEYS)[number]) {
  if (query.sort !== key) return null;
  return query.order === 'desc' ? 'descend' : 'ascend';
}

export function CourseListPage() {
  const [query, setQuery] = useState<CourseQuery>(INITIAL_QUERY);
  const { data, isFetching, isError } = useCourseList(query);
  const canEdit = useCan(PERMISSIONS.courseEdit);
  const navigate = useNavigate();
  const applyFilters = useCallback(
    (filters: Partial<CourseQuery>) =>
      setQuery((current) => ({ ...current, ...filters, page: 1 })),
    [],
  );
  const columns: TableColumnsType<CourseSummary> = [
    {
      title: 'Mã',
      dataIndex: 'courseCode',
      key: 'courseCode',
      sorter: true,
      sortOrder: sortOrderOf(query, 'courseCode'),
      render: (code: string, course) => (
        <Link to={generatePath(ROUTES.courseDetail, { courseId: course.id })}>
          {code}
        </Link>
      ),
    },
    {
      title: 'Tên học phần',
      dataIndex: 'courseName',
      key: 'courseName',
      sorter: true,
      sortOrder: sortOrderOf(query, 'courseName'),
      render: (name: string, course) => (
        <>
          {name}
          {course.isForeign && <Tag>{FOREIGN_COURSE_LABEL}</Tag>}
        </>
      ),
    },
    {
      title: 'Tín chỉ',
      dataIndex: 'credits',
      key: 'credits',
      sorter: true,
      sortOrder: sortOrderOf(query, 'credits'),
      align: 'right',
    },
    {
      title: 'Loại',
      dataIndex: 'courseType',
      render: (type: CourseType) => COURSE_TYPE_LABELS[type],
    },
    { title: 'Khoa phụ trách', dataIndex: ['ownerFaculty', 'unitName'] },
    {
      title: 'Nhóm phụ trách',
      dataIndex: ['ownerGroup', 'groupName'],
      render: (name?: string) => formatEmpty(name, 'Chưa gán'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (status: CourseStatus) => <CourseStatusTag status={status} />,
    },
  ];
  if (isError)
    return <Result status="error" title="Không thể tải danh mục học phần" />;
  return (
    <Flex vertical gap="middle">
      <PageHeader
        title="Danh mục học phần"
        actions={
          <>
            {canEdit && (
              <Button
                type="primary"
                onClick={() => void navigate(ROUTES.courseNew)}
              >
                Thêm học phần
              </Button>
            )}
          </>
        }
      />
      <CourseFilters value={query} onChange={applyFilters} />
      <Table<CourseSummary>
        rowKey="id"
        columns={columns}
        dataSource={data?.items ?? []}
        loading={isFetching}
        locale={{ emptyText: 'Chưa có học phần' }}
        pagination={{
          current: query.page,
          pageSize: query.pageSize,
          total: data?.total ?? 0,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          showSizeChanger: true,
          showTotal: (total) => `${total} học phần`,
        }}
        onChange={(pagination, _filters, sorter) =>
          setQuery((current) => toCourseQuery(current, pagination, sorter))
        }
      />
    </Flex>
  );
}
