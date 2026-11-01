import { Alert, Button } from 'antd';
import { generatePath, Link, useSearchParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { useMe } from '../../../shared/auth/useMe';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from '../../../shared/api/pagination';
import {
  DataTable,
  ListPageLayout,
  PageHeader,
  StatusTag,
} from '../../../shared/design-system';
import { StudentFilters } from '../components/StudentFilters';
import type { StudentListParams, StudentSummary } from '../api/students';
import {
  STUDENT_SOURCE_LABELS,
  STUDENT_STATUS_COLORS,
  STUDENT_STATUS_LABELS,
} from '../constants/studentLabels';
import { useStudents, useStudentSemesters } from '../hooks/useStudents';
import { currentSemester } from '../constants/currentSemester';

export function StudentListPage() {
  const [search, setSearch] = useSearchParams();
  const { data: me } = useMe();
  const canImport =
    me?.roles.some((role) => role.roleCode === 'R1') &&
    me.permissions.includes('data.importExcel');
  const rawPage = Number(search.get('page') ?? 1);
  const rawSize = Number(search.get('pageSize') ?? DEFAULT_PAGE_SIZE);
  const params: StudentListParams = {
    semesterId: search.get('semesterId') || undefined,
    programId: search.get('programId') || undefined,
    cohortId: search.get('cohortId') || undefined,
    q: search.get('q') || undefined,
    status: (
      Object.keys(STUDENT_STATUS_LABELS) as StudentSummary['status'][]
    ).find((status) => status === search.get('status')),
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize: PAGE_SIZE_OPTIONS.includes(rawSize) ? rawSize : DEFAULT_PAGE_SIZE,
  };
  // SearchInput already waits for typing to stop; the URL value is final.
  const students = useStudents(params);
  const semesters = useStudentSemesters();
  // A profile is read as of a semester: links carry the chosen one, else the current one.
  const linkSemester =
    params.semesterId || currentSemester(semesters.data ?? [])?.id;
  const profileSearch = (() => {
    const next = new URLSearchParams(search);
    if (linkSemester) next.set('semesterId', linkSemester);
    return next.toString();
  })();
  function change(
    values: Record<string, string | undefined>,
    resetPage = true,
  ) {
    const next = new URLSearchParams(search);
    if (resetPage) next.delete('page');
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearch(next, { replace: true });
  }
  return (
    <ListPageLayout
      header={
        <PageHeader
          title="Sinh viên"
          actions={
            canImport ? (
              <Link to={`${ROUTES.imports}?type=STUDENT_LIST`}>
                Nhập từ Excel
              </Link>
            ) : undefined
          }
        />
      }
      filters={<StudentFilters params={params} onChange={change} />}
      table={
        students.isError ? (
          <Alert
            type="error"
            showIcon
            title="Không tải được sinh viên trong phạm vi của bạn."
            action={
              <Button onClick={() => void students.refetch()}>Thử lại</Button>
            }
          />
        ) : (
          <DataTable<StudentSummary>
            rowKey="id"
            dataSource={students.data?.items ?? []}
            total={students.data?.total ?? 0}
            page={params.page!}
            pageSize={params.pageSize}
            loading={students.isPending || students.isFetching}
            scroll={{ x: 900 }}
            emptyText="Chưa có sinh viên khớp bộ lọc. Hãy đổi bộ lọc hoặc nhập danh sách sinh viên."
            onPageChange={(page, pageSize) =>
              change(
                {
                  page: String(pageSize !== params.pageSize ? 1 : page),
                  pageSize: String(pageSize),
                },
                false,
              )
            }
            columns={[
              {
                title: 'Mã sinh viên',
                dataIndex: 'studentCode',
                render: (code: string, student) => (
                  <Link
                    to={`${generatePath(ROUTES.studentDetail, { studentId: student.id })}?${profileSearch}`}
                  >
                    {code}
                  </Link>
                ),
              },
              { title: 'Họ tên', dataIndex: 'fullName' },
              {
                title: 'Khóa',
                render: (_, student) => student.cohort.cohortCode,
              },
              { title: 'Mã ngành', dataIndex: 'major' },
              {
                title: 'Trạng thái',
                render: (_, student) => (
                  <StatusTag
                    status={student.status}
                    colorMap={STUDENT_STATUS_COLORS}
                    labelMap={STUDENT_STATUS_LABELS}
                  />
                ),
              },
              {
                title: 'Nguồn dữ liệu',
                render: (_, student) =>
                  STUDENT_SOURCE_LABELS[student.dataSource],
              },
            ]}
          />
        )
      }
    />
  );
}
