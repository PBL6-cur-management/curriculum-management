import { useEffect, useState } from 'react';
import { DatePicker, Flex, Input, Result, Select, Typography } from 'antd';
import dayjs from 'dayjs';
import type { TableColumnsType } from 'antd';
import { Link, generatePath } from 'react-router';
import { ROUTES } from '../../../routes';
import { DEFAULT_PAGE_SIZE } from '../../../shared/api/pagination';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import { useUrlQuery } from '../../../shared/hooks/useUrlQuery';
import { OrgUnitSelect } from '../../../shared/org-units/OrgUnitSelect';
import type {
  DegreeLevel,
  ProgramQuery,
  ProgramStatus,
  ProgramSummary,
} from '../api/programs';
import { CohortLinks } from '../components/CohortLinks';
import { ProgramStatusTag } from '../components/ProgramStatusTag';
import {
  ALL_STATUSES_LABEL,
  DEGREE_LEVEL_LABELS,
  PROGRAM_COLUMN_LABELS,
  PROGRAM_FILTER_LABELS,
  PROGRAM_STATUS_LABELS,
} from '../constants/programLabels';
import { ReleasedVersionLinks } from '../components/ReleasedVersionLinks';
import { useProgramList } from '../hooks/usePrograms';
import { DataTable, PageHeader } from '../../../shared/design-system';

export const PROGRAM_SEARCH_DEBOUNCE_MS = 300;
const ALL_STATUSES = 'ALL';
const NO_DIRECTOR_LABEL = 'Chưa gán';

const levelOptions = (Object.keys(DEGREE_LEVEL_LABELS) as DegreeLevel[]).map(
  (value) => ({ value, label: DEGREE_LEVEL_LABELS[value] }),
);
const statusOptions = [
  { value: ALL_STATUSES, label: ALL_STATUSES_LABEL },
  ...(Object.keys(PROGRAM_STATUS_LABELS) as ProgramStatus[]).map((value) => ({
    value,
    label: PROGRAM_STATUS_LABELS[value],
  })),
];

const INITIAL_QUERY: ProgramQuery = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  status: 'ACTIVE',
};
const QUERY_KINDS = {
  page: 'number',
  pageSize: 'number',
  releaseYear: 'number',
  intakeYear: 'number',
} as const;
const FACULTY_UNIT_TYPES = ['FACULTY'] as const;
const YEAR_PICKER_FORMAT = 'YYYY';
const yearToPicker = (year?: number) =>
  year === undefined ? null : dayjs(`${year}-01-01`);

export function ProgramListPage() {
  // Filters and page live in the URL so the back link from a program returns here unchanged.
  const [query, setQuery] = useUrlQuery(INITIAL_QUERY, QUERY_KINDS);
  const filters = {
    facultyId: query.facultyId,
    degreeLevel: query.degreeLevel,
    releaseYear: query.releaseYear,
    intakeYear: query.intakeYear,
    status: query.status,
  };
  const [search, setSearch] = useState(query.q ?? '');
  const q = useDebouncedValue(search.trim(), PROGRAM_SEARCH_DEBOUNCE_MS);
  useEffect(() => {
    setQuery((current) =>
      (current.q ?? '') === q
        ? current
        : { ...current, q: q || undefined, page: 1 },
    );
  }, [q, setQuery]);
  const { data, isFetching, isError } = useProgramList(query);
  const applyFilters = (next: typeof filters) =>
    setQuery((current) => ({ ...current, ...next, page: 1 }));
  const columns: TableColumnsType<ProgramSummary> = [
    {
      title: 'Chương trình',
      key: 'program',
      render: (_value, row) => (
        <Link to={generatePath(ROUTES.programDetail, { programId: row.id })}>
          <Flex vertical>
            <Typography.Text strong>{row.programName}</Typography.Text>
            <Typography.Text
              type="secondary"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {row.programCode}
            </Typography.Text>
          </Flex>
        </Link>
      ),
    },
    { title: PROGRAM_COLUMN_LABELS.MAJOR, dataIndex: 'majorName' },
    {
      title: PROGRAM_COLUMN_LABELS.MAJOR_CODE,
      dataIndex: 'majorCode',
      render: (code: string) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{code}</span>
      ),
    },
    {
      title: PROGRAM_FILTER_LABELS.DEGREE_LEVEL,
      dataIndex: 'degreeLevel',
      render: (level: DegreeLevel) => DEGREE_LEVEL_LABELS[level],
    },
    {
      title: PROGRAM_COLUMN_LABELS.VERSIONS,
      render: (_value, row) => (
        <ReleasedVersionLinks
          programId={row.id}
          versions={row.releasedVersions}
        />
      ),
    },
    {
      title: PROGRAM_COLUMN_LABELS.COHORTS,
      render: (_value, row) => (
        <CohortLinks programId={row.id} versions={row.releasedVersions} />
      ),
    },
    {
      title: PROGRAM_COLUMN_LABELS.FACULTY,
      render: (_value, row) => row.faculty.unitName,
    },
    {
      title: 'Giám đốc CTĐT',
      render: (_value, row) =>
        row.directors.length ? (
          row.directors.map((user) => user.fullName).join(', ')
        ) : (
          <Typography.Text type="warning">{NO_DIRECTOR_LABEL}</Typography.Text>
        ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (status: ProgramStatus) => <ProgramStatusTag status={status} />,
    },
  ];
  if (isError)
    return (
      <Result status="error" title="Không thể tải danh sách chương trình" />
    );
  return (
    <Flex vertical gap="middle">
      <PageHeader title="Chương trình đào tạo" />
      <Flex wrap gap="small">
        <Input.Search
          allowClear
          placeholder="Tìm theo mã hoặc tên chương trình"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ width: 280 }}
        />
        <div style={{ minWidth: 200 }}>
          <OrgUnitSelect
            types={FACULTY_UNIT_TYPES}
            placeholder={PROGRAM_FILTER_LABELS.FACULTY}
            value={filters.facultyId}
            onChange={(facultyId) =>
              applyFilters({ ...filters, facultyId: facultyId ?? undefined })
            }
          />
        </div>
        <Select
          allowClear
          aria-label={PROGRAM_FILTER_LABELS.DEGREE_LEVEL}
          placeholder={PROGRAM_FILTER_LABELS.DEGREE_LEVEL}
          style={{ minWidth: 140 }}
          value={filters.degreeLevel}
          options={levelOptions}
          onChange={(degreeLevel?: DegreeLevel) =>
            applyFilters({ ...filters, degreeLevel })
          }
        />
        <DatePicker
          picker="year"
          allowClear
          format={YEAR_PICKER_FORMAT}
          placeholder={PROGRAM_FILTER_LABELS.RELEASE_YEAR}
          aria-label={PROGRAM_FILTER_LABELS.RELEASE_YEAR}
          value={yearToPicker(filters.releaseYear)}
          onChange={(date) =>
            applyFilters({ ...filters, releaseYear: date?.year() })
          }
        />
        <DatePicker
          picker="year"
          allowClear
          format={YEAR_PICKER_FORMAT}
          placeholder={PROGRAM_FILTER_LABELS.INTAKE_YEAR}
          aria-label={PROGRAM_FILTER_LABELS.INTAKE_YEAR}
          value={yearToPicker(filters.intakeYear)}
          onChange={(date) =>
            applyFilters({ ...filters, intakeYear: date?.year() })
          }
        />
        <Select
          aria-label="Trạng thái"
          style={{ minWidth: 160 }}
          value={filters.status ?? ALL_STATUSES}
          options={statusOptions}
          onChange={(status: string) =>
            applyFilters({
              ...filters,
              status:
                status === ALL_STATUSES ? undefined : (status as ProgramStatus),
            })
          }
        />
      </Flex>
      <DataTable<ProgramSummary>
        rowKey="id"
        columns={columns}
        dataSource={data?.items ?? []}
        total={data?.total ?? 0}
        page={query.page ?? 1}
        pageSize={query.pageSize}
        loading={isFetching}
        scroll={{ x: 'max-content' }}
        emptyText="Không có chương trình khớp bộ lọc"
        onPageChange={(page, pageSize) =>
          setQuery((current) => ({ ...current, page, pageSize }))
        }
      />
    </Flex>
  );
}
