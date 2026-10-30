import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Input,
  Progress,
  Select,
  Skeleton,
} from 'antd';
import { generatePath, Link, useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { DEFAULT_PAGE_SIZE } from '../../../shared/api/pagination';
import {
  DataTable,
  DetailPageLayout,
  ListPageLayout,
  PageHeader,
  StatusTag,
} from '../../../shared/design-system';
import type {
  GraduationBatchItem,
  GraduationExportFilters,
} from '../schema/graduation';
import {
  BATCH_COLORS,
  BATCH_LABELS,
  CONCLUSION_COLORS,
  CONCLUSION_LABELS,
  ITEM_COLORS,
  ITEM_LABELS,
} from '../constants/graduationLabels';
import {
  useDebouncedGraduationSearch,
  useDownloadGraduationBatch,
  useGraduationBatch,
  useGraduationCohorts,
  useGraduationItems,
  useGraduationPrograms,
  useGraduationSemesters,
} from '../hooks/useGraduation';
import { GraduationError } from '../components/GraduationError';
import { displayTime } from '../components/graduationPresentation';

export function GraduationBatchPage() {
  const { batchId = '' } = useParams();
  const batch = useGraduationBatch(batchId);
  const semesters = useGraduationSemesters();
  const programs = useGraduationPrograms(batch.data?.filters.semesterId ?? '');
  const cohorts = useGraduationCohorts();
  const [page, setPage] = useState({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  const [search, setSearch] = useState('');
  const committedSearch = useDebouncedGraduationSearch(search);
  const [filters, setFilters] = useState<Omit<GraduationExportFilters, 'q'>>(
    {},
  );
  const committed = {
    ...filters,
    ...(committedSearch ? { q: committedSearch } : {}),
  };
  const items = useGraduationItems(batchId, { ...committed, ...page });
  const download = useDownloadGraduationBatch(batchId);
  const canExport =
    batch.data?.status === 'COMPLETED' ||
    batch.data?.status === 'COMPLETED_WITH_ERRORS';
  const header = (
    <PageHeader
      title="Chi tiết đợt xét tốt nghiệp"
      actions={<Link to={ROUTES.graduationBatches}>Danh sách đợt xét</Link>}
    />
  );
  if (batch.isPending)
    return (
      <DetailPageLayout>
        {header}
        <Skeleton active />
      </DetailPageLayout>
    );
  if (batch.isError)
    return (
      <DetailPageLayout>
        {header}
        <GraduationError
          error={batch.error}
          onRetry={() => void batch.refetch()}
        />
      </DetailPageLayout>
    );
  const data = batch.data;
  const semester = semesters.data?.find(
    (option) => option.id === data.filters.semesterId,
  );
  const program = programs.data?.find(
    (option) => option.id === data.filters.programId,
  );
  const cohort = cohorts.data?.find(
    (option) => option.id === data.filters.cohortId,
  );
  return (
    <DetailPageLayout>
      {header}
      <Card
        title={
          <StatusTag
            status={data.status}
            labelMap={BATCH_LABELS}
            colorMap={BATCH_COLORS}
          />
        }
      >
        <Descriptions
          column={{ xs: 1, md: 2 }}
          items={[
            {
              key: 'semester',
              label: 'Học kỳ xét',
              children:
                semester?.semesterCode ?? 'Không còn trong danh sách học kỳ',
            },
            {
              key: 'program',
              label: 'Chương trình đã chọn',
              children: data.filters.programId
                ? program
                  ? `${program.programCode} — ${program.programName}`
                  : 'Không còn trong danh sách chương trình được phép xem'
                : 'Tất cả chương trình trong phạm vi',
            },
            {
              key: 'cohort',
              label: 'Khóa đã chọn',
              children: data.filters.cohortId
                ? (cohort?.cohortCode ?? 'Không còn trong danh sách khóa')
                : 'Tất cả khóa',
            },
            {
              key: 'counts',
              label: 'Sinh viên / lượt chương trình',
              children: `${data.studentCount} / ${data.enrollmentCount}`,
            },
            {
              key: 'processed',
              label: 'Đã xử lý',
              children: `${data.processedCount} / ${data.enrollmentCount}`,
            },
            {
              key: 'conclusions',
              label: 'Đủ / chưa đủ / lỗi dữ liệu',
              children: `${data.eligibleCount} / ${data.notEligibleCount} / ${data.errorCount}`,
            },
            {
              key: 'created',
              label: 'Tạo lúc',
              children: displayTime(data.createdAt),
            },
            {
              key: 'started',
              label: 'Bắt đầu',
              children: displayTime(data.startedAt),
            },
            {
              key: 'finished',
              label: 'Kết thúc',
              children: displayTime(data.finishedAt),
            },
          ]}
        />
        <div role="status" aria-live="polite" aria-atomic="true">
          Đã xử lý {data.processedCount} trên {data.enrollmentCount} lượt chương
          trình.
        </div>
        <Progress
          percent={
            data.enrollmentCount
              ? Math.floor((data.processedCount / data.enrollmentCount) * 100)
              : 0
          }
          status={data.status === 'FAILED' ? 'exception' : undefined}
        />
      </Card>
      {[semesters, programs, cohorts].map(
        (query, index) =>
          query.isError && (
            <GraduationError
              key={index}
              error={query.error}
              onRetry={() => void query.refetch()}
            />
          ),
      )}
      {data.failure && (
        <Alert
          type="error"
          showIcon
          title="Đợt xét bị gián đoạn"
          description={`${data.failure.code} — ${data.failure.message}. Các lượt đã xử lý vẫn được giữ lại. Tạo đợt xét mới là thao tác chủ động riêng.`}
        />
      )}
      <Alert
        type="info"
        title="Kết quả tại thời điểm đợt xét; lần xét mới hơn xem trong hồ sơ sinh viên"
        description="Tải lại trang để tiếp tục theo dõi đợt xét đã lưu. Lỗi dữ liệu không phải kết luận chưa đủ điều kiện."
      />
      <ListPageLayout
        header={
          <PageHeader
            title="Kết quả từng lượt chương trình"
            actions={
              <Button
                disabled={
                  !canExport || search !== committedSearch || download.isPending
                }
                loading={download.isPending}
                onClick={() => download.mutate(committed)}
              >
                Xuất Excel
              </Button>
            }
          />
        }
        filters={
          <>
            <Input.Search
              aria-label="Tìm kết quả"
              placeholder="Tìm mã hoặc tên sinh viên"
              value={search}
              allowClear
              onChange={(event) => {
                setSearch(event.target.value);
                setPage((current) => ({ ...current, page: 1 }));
              }}
            />
            <Select
              aria-label="Kết luận"
              placeholder="Tất cả kết luận"
              allowClear
              value={filters.conclusion}
              options={Object.entries(CONCLUSION_LABELS).map(
                ([value, label]) => ({ value, label }),
              )}
              onChange={(conclusion: GraduationExportFilters['conclusion']) => {
                setFilters((current) => ({
                  ...current,
                  conclusion,
                  outcome: conclusion ? 'REVIEWED' : current.outcome,
                }));
                setPage((current) => ({ ...current, page: 1 }));
              }}
            />
            <Select
              aria-label="Trạng thái lượt xét"
              placeholder="Tất cả lượt xét"
              allowClear
              value={filters.outcome}
              options={Object.entries(ITEM_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
              onChange={(outcome: GraduationExportFilters['outcome']) => {
                setFilters((current) => ({
                  ...current,
                  outcome,
                  conclusion:
                    outcome && outcome !== 'REVIEWED'
                      ? undefined
                      : current.conclusion,
                }));
                setPage((current) => ({ ...current, page: 1 }));
              }}
            />
          </>
        }
        table={
          items.isError ? (
            <GraduationError
              error={items.error}
              onRetry={() => void items.refetch()}
            />
          ) : (
            <DataTable<GraduationBatchItem>
              rowKey="id"
              dataSource={items.data?.items ?? []}
              total={items.data?.total ?? 0}
              page={page.page}
              pageSize={page.pageSize}
              onPageChange={(next, pageSize) =>
                setPage({ page: next, pageSize })
              }
              loading={items.isPending}
              emptyText="Không có lượt xét phù hợp bộ lọc hiện tại"
              scroll={{ x: 'max-content' }}
              columns={[
                {
                  title: 'Sinh viên',
                  render: (_, item) => `${item.studentCode} — ${item.fullName}`,
                },
                {
                  title: 'Chương trình',
                  render: (_, item) =>
                    `${item.programCode} — ${item.programName}`,
                },
                {
                  title: 'Trạng thái',
                  render: (_, item) => (
                    <StatusTag
                      status={item.status}
                      labelMap={ITEM_LABELS}
                      colorMap={ITEM_COLORS}
                    />
                  ),
                },
                {
                  title: 'Kết luận',
                  render: (_, item) =>
                    item.status === 'REVIEWED' && item.conclusion ? (
                      <StatusTag
                        status={item.conclusion}
                        labelMap={CONCLUSION_LABELS}
                        colorMap={CONCLUSION_COLORS}
                      />
                    ) : (
                      'Chưa có kết luận'
                    ),
                },
                {
                  title: 'Hạng mục còn thiếu',
                  render: (_, item) => item.shortfallCount ?? '—',
                },
                {
                  title: 'Lỗi dữ liệu',
                  render: (_, item) =>
                    item.error
                      ? `${item.error.code} — ${item.error.message}`
                      : '—',
                },
                {
                  title: 'Lần xét đã lưu',
                  render: (_, item) =>
                    item.status === 'REVIEWED' && item.auditId ? (
                      <Link
                        to={generatePath(ROUTES.graduationAudit, {
                          auditId: item.auditId,
                        })}
                      >
                        Xem lần xét
                      </Link>
                    ) : (
                      '—'
                    ),
                },
              ]}
            />
          )
        }
      />
      {download.isError && <GraduationError error={download.error} />}
    </DetailPageLayout>
  );
}
