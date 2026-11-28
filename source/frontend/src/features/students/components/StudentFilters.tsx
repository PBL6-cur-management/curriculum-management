import { Alert, Button, Select } from 'antd';
import { SearchInput } from '../../../shared/design-system';
import { semesterLabel } from '../../../shared/releases/semesters';
import {
  useStudentCohorts,
  useStudentPrograms,
  useStudentSemesters,
} from '../hooks/useStudents';
import {
  STUDENT_SEARCH_DEBOUNCE_MS,
  STUDENT_STATUS_LABELS,
} from '../constants/studentLabels';
import type { StudentListParams } from '../api/students';

interface StudentFiltersProps {
  params: StudentListParams;
  onChange: (values: Record<string, string | undefined>) => void;
  /** On a single student profile, only semester & program context selectors are relevant. */
  contextOnly?: boolean;
  /** When viewing a specific student, restrict or prioritize their enrolled programs. */
  enrolledPrograms?: Array<{
    id: string;
    programCode: string;
    programName: string;
  }>;
}
export function StudentFilters({
  params,
  onChange,
  contextOnly = false,
  enrolledPrograms,
}: StudentFiltersProps) {
  const semesters = useStudentSemesters();
  const cohorts = useStudentCohorts();
  const programs = useStudentPrograms(params.semesterId);
  const programOptions =
    enrolledPrograms && enrolledPrograms.length > 0
      ? enrolledPrograms.map((program) => ({
          value: program.id,
          label: `${program.programCode} — ${program.programName}`,
        }))
      : programs.data?.map((program) => ({
          value: program.id,
          label: `${program.programCode} — ${program.programName}`,
        }));
  return (
    <>
      <Select
        aria-label="Học kỳ"
        placeholder="Mọi học kỳ"
        allowClear
        value={params.semesterId || undefined}
        style={{ minWidth: 220 }}
        loading={semesters.isPending}
        options={semesters.data?.map((semester) => ({
          value: semester.id,
          label: semesterLabel(semester),
          disabled: !semester.startDate,
        }))}
        onChange={(value) =>
          onChange({ semesterId: value, programId: undefined })
        }
      />
      <Select
        aria-label="Chương trình"
        placeholder="Chương trình"
        allowClear={!contextOnly}
        showSearch
        optionFilterProp="label"
        value={params.programId || undefined}
        style={{ minWidth: 260 }}
        loading={!enrolledPrograms?.length && programs.isFetching}
        options={programOptions}
        onChange={(value) => onChange({ programId: value })}
      />
      {!contextOnly && (
        <>
          <Select
            aria-label="Khóa"
            placeholder="Khóa"
            allowClear
            value={params.cohortId}
            style={{ minWidth: 130 }}
            options={cohorts.data?.map((cohort) => ({
              value: cohort.id,
              label: cohort.cohortCode,
            }))}
            onChange={(value) => onChange({ cohortId: value })}
          />
          <Select
            aria-label="Trạng thái sinh viên"
            placeholder="Trạng thái"
            allowClear
            value={params.status}
            style={{ minWidth: 160 }}
            options={Object.entries(STUDENT_STATUS_LABELS).map(
              ([value, label]) => ({ value, label }),
            )}
            onChange={(value) => onChange({ status: value })}
          />
          <SearchInput
            ariaLabel="Tìm sinh viên"
            placeholder="Mã sinh viên hoặc họ tên"
            value={params.q}
            style={{ width: 280 }}
            delayMs={STUDENT_SEARCH_DEBOUNCE_MS}
            onCommit={(q) => onChange({ q })}
          />
        </>
      )}
      {[semesters, cohorts, programs].some((query) => query.isError) && (
        <Alert
          type="error"
          showIcon
          title="Không tải được bộ lọc sinh viên. Hãy thử lại."
          action={
            <Button
              onClick={() => {
                void semesters.refetch();
                void cohorts.refetch();
                void programs.refetch();
              }}
            >
              Thử lại
            </Button>
          }
        />
      )}
    </>
  );
}
