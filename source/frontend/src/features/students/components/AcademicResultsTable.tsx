import { useState } from 'react';
import { Alert, Button, Select, Space } from 'antd';
import { DEFAULT_PAGE_SIZE } from '../../../shared/api/pagination';
import { DataTable, StatusTag } from '../../../shared/design-system';
import type { AcademicResult, StudentContext } from '../api/students';
import { useStudentResults, useStudentSemesters } from '../hooks/useStudents';
import {
  RESULT_STATUS_COLORS,
  RESULT_STATUS_LABELS,
  STUDENT_SOURCE_LABELS,
} from '../constants/studentLabels';

interface AcademicResultsTableProps {
  studentId: string;
  context: StudentContext;
}
export function AcademicResultsTable({
  studentId,
  context,
}: AcademicResultsTableProps) {
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    resultSemesterId: undefined as string | undefined,
  });
  const semesters = useStudentSemesters();
  const results = useStudentResults(studentId, { ...context, ...filters });
  if (results.isError)
    return (
      <Alert
        type="error"
        showIcon
        title="Không tải được kết quả học tập trong chương trình và học kỳ đã chọn."
        action={<Button onClick={() => void results.refetch()}>Thử lại</Button>}
      />
    );
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <Select
        aria-label="Học kỳ của kết quả"
        placeholder="Tất cả học kỳ kết quả"
        allowClear
        style={{ minWidth: 220 }}
        value={filters.resultSemesterId}
        options={semesters.data?.map((semester) => ({
          value: semester.id,
          label: semester.semesterCode,
        }))}
        onChange={(resultSemesterId) =>
          setFilters((current) => ({ ...current, page: 1, resultSemesterId }))
        }
      />
      <DataTable<AcademicResult>
        rowKey="id"
        dataSource={results.data?.items ?? []}
        total={results.data?.total ?? 0}
        page={filters.page}
        pageSize={filters.pageSize}
        loading={results.isPending || results.isFetching}
        onPageChange={(page, pageSize) =>
          setFilters((current) => ({
            ...current,
            page: pageSize !== current.pageSize ? 1 : page,
            pageSize,
          }))
        }
        scroll={{ x: 1000 }}
        emptyText="Chưa có kết quả học tập trong phạm vi đã chọn."
        columns={[
          {
            title: 'Học phần',
            render: (_, result) =>
              `${result.course.courseCode} — ${result.course.courseName}`,
          },
          {
            title: 'Học kỳ',
            render: (_, result) => result.semester.semesterCode,
          },
          { title: 'Điểm 10', render: (_, result) => result.score10 ?? '—' },
          { title: 'Điểm 4', render: (_, result) => result.score4 ?? '—' },
          {
            title: 'Điểm chữ',
            render: (_, result) => result.letterGrade ?? '—',
          },
          {
            title: 'Trạng thái nguồn',
            render: (_, result) => (
              <StatusTag
                status={result.status}
                colorMap={RESULT_STATUS_COLORS}
                labelMap={RESULT_STATUS_LABELS}
              />
            ),
          },
          {
            title: 'Nguồn dữ liệu',
            render: (_, result) => STUDENT_SOURCE_LABELS[result.dataSource],
          },
        ]}
      />
    </Space>
  );
}
