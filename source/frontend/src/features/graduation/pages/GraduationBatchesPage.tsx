import { useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Card, Flex } from 'antd';
import { generatePath, Link, useNavigate } from 'react-router';
import { ROUTES } from '../../../routes';
import { ApiError } from '../../../shared/api/client';
import { useMe } from '../../../shared/auth/useMe';
import { DEFAULT_PAGE_SIZE } from '../../../shared/api/pagination';
import {
  DataTable,
  ListPageLayout,
  PageHeader,
  StatusTag,
} from '../../../shared/design-system';
import type {
  GraduationBatch,
  GraduationBatchFilter,
} from '../schema/graduation';
import {
  useCreateGraduationBatch,
  useGraduationBatches,
  usePreviewGraduationBatch,
} from '../hooks/useGraduation';
import { BATCH_COLORS, BATCH_LABELS } from '../constants/graduationLabels';
import { GraduationBatchFilters } from '../components/GraduationBatchFilters';
import { GraduationError } from '../components/GraduationError';
import { displayTime } from '../components/graduationPresentation';

export function GraduationBatchesPage() {
  const [filters, setFilters] = useState<GraduationBatchFilter>({
    semesterId: '',
  });
  const [page, setPage] = useState({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  const preview = usePreviewGraduationBatch();
  const create = useCreateGraduationBatch();
  const list = useGraduationBatches(page);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(
    null,
  );
  const requestKey = useRef<string | null>(null);
  const revision = useRef(0);
  const confirmation = useRef<ReturnType<
    ReturnType<typeof App.useApp>['modal']['confirm']
  > | null>(null);
  const { modal } = App.useApp();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const requireProgram = !me?.roles.some((role) => role.roleCode === 'R1');
  const validFilters = Boolean(
    filters.semesterId &&
    (requireProgram
      ? filters.programId
      : filters.programId || filters.cohortId),
  );
  useEffect(() => () => confirmation.current?.destroy(), []);
  function change(next: GraduationBatchFilter) {
    revision.current += 1;
    confirmation.current?.destroy();
    preview.reset();
    create.reset();
    requestKey.current = null;
    setConfirmationMessage(null);
    setFilters(next);
  }
  function confirm() {
    if (!preview.data || create.isPending) return;
    setConfirmationMessage(null);
    const expected = revision.current;
    const input = {
      ...filters,
      previewRevision: preview.data.previewRevision,
      requestKey: requestKey.current ?? crypto.randomUUID(),
    };
    requestKey.current = input.requestKey;
    confirmation.current = modal.confirm({
      title: 'Bắt đầu xét tốt nghiệp?',
      content: `Danh sách cố định gồm ${preview.data.studentCount} sinh viên, ${preview.data.enrollmentCount} lượt chương trình. Mỗi lượt được xét độc lập; không công nhận tốt nghiệp tự động.`,
      okText: 'Bắt đầu xét',
      cancelText: 'Hủy',
      onOk: async () => {
        if (expected !== revision.current) {
          confirmation.current?.destroy();
          setConfirmationMessage(
            'Bộ lọc đã thay đổi. Xem trước lại danh sách.',
          );
          return;
        }
        try {
          const batch = await create.mutateAsync(input);
          if (expected === revision.current)
            void navigate(
              generatePath(ROUTES.graduationBatch, { batchId: batch.id }),
            );
        } catch (error) {
          if (error instanceof ApiError && error.status === 409) {
            preview.reset();
            requestKey.current = null;
          }
        } finally {
          confirmation.current?.destroy();
        }
      },
    });
  }
  return (
    <ListPageLayout
      header={
        <PageHeader
          title="Xét tốt nghiệp hàng loạt"
          actions={<Link to={ROUTES.graduation}>Xét từng sinh viên</Link>}
        />
      }
      filters={
        <Card title="Phạm vi đợt xét">
          <GraduationBatchFilters
            onChange={change}
            requireProgram={requireProgram}
          />
          {!validFilters && (
            <Alert
              type="info"
              title={
                requireProgram
                  ? 'Chọn học kỳ và chương trình phụ trách để xét hàng loạt.'
                  : 'Chọn học kỳ và ít nhất một chương trình hoặc khóa tuyển sinh.'
              }
            />
          )}
          <Flex gap="small" wrap>
            <Button
              disabled={!validFilters || preview.isPending || create.isPending}
              loading={preview.isPending}
              onClick={() => {
                requestKey.current = null;
                setConfirmationMessage(null);
                create.reset();
                preview.mutate(filters);
              }}
            >
              Xem trước danh sách
            </Button>
            <Button
              type="primary"
              disabled={!preview.data?.enrollmentCount || create.isPending}
              loading={create.isPending}
              onClick={confirm}
            >
              Xác nhận đợt xét
            </Button>
          </Flex>
          {preview.isError && <GraduationError error={preview.error} />}
          {preview.data && (
            <Alert
              type="info"
              title={`${preview.data.studentCount} sinh viên · ${preview.data.enrollmentCount} lượt chương trình`}
              description="Sinh viên song ngành có thể có hai lượt xét. Danh sách sẽ được khóa tại lúc xác nhận; thay đổi phạm vi cần xem trước lại. Dữ liệu học tập được đọc khi xử lý từng lượt, không chụp nguyên khóa cùng lúc; lỗi một lượt không chặn các lượt còn lại."
            />
          )}
          {confirmationMessage && (
            <Alert type="warning" showIcon title={confirmationMessage} />
          )}
          {create.isError && <GraduationError error={create.error} />}
        </Card>
      }
      table={
        list.isError ? (
          <GraduationError
            error={list.error}
            onRetry={() => void list.refetch()}
          />
        ) : (
          <DataTable<GraduationBatch>
            rowKey="id"
            dataSource={list.data?.items ?? []}
            total={list.data?.total ?? 0}
            page={page.page}
            pageSize={page.pageSize}
            onPageChange={(next, pageSize) => setPage({ page: next, pageSize })}
            loading={list.isPending}
            emptyText="Bạn chưa tạo đợt xét tốt nghiệp nào"
            scroll={{ x: 'max-content' }}
            columns={[
              {
                title: 'Tạo lúc',
                render: (_, batch) => (
                  <Link
                    to={generatePath(ROUTES.graduationBatch, {
                      batchId: batch.id,
                    })}
                  >
                    {displayTime(batch.createdAt)}
                  </Link>
                ),
              },
              {
                title: 'Trạng thái',
                render: (_, batch) => (
                  <StatusTag
                    status={batch.status}
                    labelMap={BATCH_LABELS}
                    colorMap={BATCH_COLORS}
                  />
                ),
              },
              {
                title: 'Sinh viên / lượt chương trình',
                render: (_, batch) =>
                  `${batch.studentCount} / ${batch.enrollmentCount}`,
              },
              { title: 'Đã xử lý', dataIndex: 'processedCount' },
              {
                title: 'Đủ / chưa đủ / lỗi',
                render: (_, batch) =>
                  `${batch.eligibleCount} / ${batch.notEligibleCount} / ${batch.errorCount}`,
              },
            ]}
          />
        )
      }
    />
  );
}
