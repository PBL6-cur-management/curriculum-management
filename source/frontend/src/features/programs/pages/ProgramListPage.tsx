import { useState } from 'react';
import { Button, Flex, Input, Result, Select, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { Link, generatePath, useNavigate } from 'react-router';
import { ROUTES } from '../../../routes';
import { DEFAULT_PAGE_SIZE } from '../../../shared/api/pagination';
import { PERMISSIONS } from '../../../shared/auth/permissions';
import { useCanEditSchoolWide } from '../../../shared/auth/useCan';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import type {
  DegreeLevel,
  ProgramQuery,
  ProgramStatus,
  ProgramSummary,
} from '../api/programs';
import { ProgramStatusTag } from '../components/ProgramStatusTag';
import {
  ALL_STATUSES_LABEL,
  DEGREE_LEVEL_LABELS,
  PROGRAM_STATUS_LABELS,
  versionLabel,
} from '../constants/programLabels';
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

export function ProgramListPage() {
  const [filters, setFilters] = useState<
    Pick<ProgramQuery, 'degreeLevel' | 'status'>
  >({ status: 'ACTIVE' });
  const [search, setSearch] = useState('');
  const [paging, setPaging] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const q = useDebouncedValue(search.trim(), PROGRAM_SEARCH_DEBOUNCE_MS);
  const query: ProgramQuery = { ...paging, ...filters, q: q || undefined };
  const { data, isFetching, isError } = useProgramList(query);
  const canCreate = useCanEditSchoolWide(PERMISSIONS.programEditInfo);
  const navigate = useNavigate();
  const applyFilters = (next: typeof filters) => {
    setFilters(next);
    setPaging((current) => ({ ...current, page: 1 }));
  };
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
    {
      title: 'Trình độ',
      dataIndex: 'degreeLevel',
      render: (level: DegreeLevel) => DEGREE_LEVEL_LABELS[level],
    },
    {
      title: 'Phiên bản hiện hành',
      render: (_value, row) => versionLabel(row.currentVersion),
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
      <PageHeader
        title="Chương trình đào tạo"
        actions={
          canCreate && (
            <Button
              type="primary"
              onClick={() => void navigate(ROUTES.programNew)}
            >
              Thêm chương trình
            </Button>
          )
        }
      />
      <Flex wrap gap="small">
        <Input.Search
          allowClear
          placeholder="Tìm theo mã hoặc tên chương trình"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPaging((current) => ({ ...current, page: 1 }));
          }}
          style={{ width: 280 }}
        />
        <Select
          allowClear
          placeholder="Trình độ"
          style={{ minWidth: 140 }}
          value={filters.degreeLevel}
          options={levelOptions}
          onChange={(degreeLevel?: DegreeLevel) =>
            applyFilters({ ...filters, degreeLevel })
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
        page={paging.page}
        pageSize={paging.pageSize}
        loading={isFetching}
        emptyText="Không có chương trình khớp bộ lọc"
        onPageChange={(page, pageSize) => setPaging({ page, pageSize })}
      />
    </Flex>
  );
}
