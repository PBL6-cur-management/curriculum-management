import { Input } from 'antd';
import { useState } from 'react';
import { generatePath, Link, useSearchParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { DEFAULT_PAGE_SIZE } from '../../../shared/api/pagination';
import { DataTable } from '../../../shared/design-system/DataTable';
import { ListPageLayout } from '../../../shared/design-system/ListPageLayout';
import { PageHeader } from '../../../shared/design-system/PageHeader';
import { useAssignmentPrograms } from '../hooks/useReleases';
import { ReleaseQueryError } from './VersionComparisonSections';

export function CohortAssignmentProgramPicker() {
  const [search] = useSearchParams();
  const [query, setQuery] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    q: '',
  });
  const result = useAssignmentPrograms(query);
  return (
    <ListPageLayout
      header={<PageHeader title="Chọn chương trình để gán phiên bản" />}
      filters={
        <Input.Search
          aria-label="Tìm chương trình"
          placeholder="Mã hoặc tên chương trình"
          onSearch={(value) =>
            setQuery((current) => ({ ...current, q: value, page: 1 }))
          }
          enterButton="Tìm kiếm"
        />
      }
      table={
        result.error ? (
          <ReleaseQueryError
            error={result.error}
            retry={() => void result.refetch()}
          />
        ) : (
          <DataTable
            rowKey="id"
            loading={result.isPending}
            dataSource={result.data?.items ?? []}
            total={result.data?.total ?? 0}
            page={query.page}
            pageSize={query.pageSize}
            onPageChange={(page, pageSize) =>
              setQuery((current) => ({ ...current, page, pageSize }))
            }
            emptyText="Không tìm thấy chương trình phù hợp."
            columns={[
              { title: 'Mã chương trình', dataIndex: 'programCode' },
              { title: 'Tên chương trình', dataIndex: 'programName' },
              {
                title: 'Thao tác',
                key: 'action',
                render: (_, program) => (
                  <Link
                    to={`${generatePath(ROUTES.cohortVersionAssignments, { programId: program.id })}${search.has('cohortId') ? `?${new URLSearchParams({ cohortId: search.get('cohortId')! })}` : ''}`}
                  >
                    Gán phiên bản cho khóa
                  </Link>
                ),
              },
            ]}
          />
        )
      }
    />
  );
}
