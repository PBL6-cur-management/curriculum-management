import { Collapse, Flex, Result, Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { generatePath, Link, useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { ApiError } from '../../../shared/api/client';
import { RequestDraftBanner } from '../../../shared/change-requests/RequestDraftBanner';
import { versionLabel } from '../../../shared/constants/versionLabels';
import type { CloRef, ProgramCloPloMatrix } from '../api/outcomes';
import { ProgramCloPloFilters } from '../components/ProgramCloPloFilters';
import {
  NO_CLOS_IN_REVISION,
  NO_SYLLABUS_FOR_COURSE,
} from '../constants/outcomeLabels';
import { useCloPloFilters } from '../hooks/useCloPloFilters';
import { useProgramCloPlo } from '../hooks/useOutcomes';
import { PageHeader, PageSkeleton } from '../../../shared/design-system';

function ProgramCloPloView({
  matrix,
  programId,
}: {
  matrix: ProgramCloPloMatrix;
  programId: string;
}) {
  const { filters, setFilters, semesters, rows, plos } =
    useCloPloFilters(matrix);
  const columnsFor = (
    linked: ReadonlySet<string>,
    mapped: ReadonlySet<string>,
  ): TableColumnsType<CloRef> => [
    {
      title: 'CLO',
      width: 320,
      render: (_value, clo) => `${clo.cloCode} — ${clo.description}`,
    },
    ...plos.map((plo) => ({
      key: plo.id,
      width: 80,
      title: plo.ploCode,
      render: (_value: unknown, clo: CloRef) =>
        linked.has(`${clo.id}:${plo.id}`) ? (
          <span aria-label={`${clo.cloCode} gắn ${plo.ploCode}`}>✓</span>
        ) : mapped.has(plo.id) ? null : (
          <Typography.Text type="secondary">·</Typography.Text>
        ),
    })),
  ];
  return (
    <Flex vertical gap="middle">
      <ProgramCloPloFilters
        semesters={semesters}
        plos={matrix.plos}
        value={filters}
        onChange={setFilters}
      />
      <Collapse
        items={rows.map((row) => ({
          key: row.itemId,
          label: `HK${row.plannedSemester} · ${row.course.courseCode} — ${row.course.courseName}${row.revisionNumber ? ` · đề cương bản ${row.revisionNumber}` : ''}`,
          extra: (
            <Link
              to={generatePath(ROUTES.itemCloPlo, {
                programId,
                versionId: matrix.version.id,
                itemId: row.itemId,
              })}
              onClick={(event) => event.stopPropagation()}
            >
              Xem / sửa
            </Link>
          ),
          children:
            row.revisionNumber === null ? (
              <Typography.Text type="secondary">
                {NO_SYLLABUS_FOR_COURSE}
              </Typography.Text>
            ) : row.clos.length === 0 ? (
              <Typography.Text type="secondary">
                {NO_CLOS_IN_REVISION}
              </Typography.Text>
            ) : (
              <Table<CloRef>
                size="small"
                rowKey="id"
                pagination={false}
                columns={columnsFor(
                  new Set(row.links.map((l) => `${l.cloId}:${l.ploId}`)),
                  new Set(row.mappedPloIds),
                )}
                dataSource={row.clos}
              />
            ),
        }))}
      />
    </Flex>
  );
}

export function ProgramCloPloPage() {
  const { programId = '', versionId = '' } = useParams();
  const { data, isPending, error } = useProgramCloPlo(versionId);
  if (isPending) return <PageSkeleton />;
  if (!data) {
    if (error instanceof ApiError && error.status === 403)
      return <Result status="403" title="Bạn không có quyền xem ma trận này" />;
    return (
      <Result status="404" title="Không tìm thấy phiên bản chương trình" />
    );
  }
  const { version } = data;
  return (
    <Flex vertical gap="middle">
      <PageHeader
        title={
          <>
            Ma trận CLO–PLO — {version.programName} ({versionLabel(version)})
          </>
        }
        subtitle="Dấu ✓ là CLO đã gắn PLO; dấu chấm là PLO mà học phần chưa đóng góp. Bấm “Xem / sửa” để đổi liên kết của một học phần."
      />
      <RequestDraftBanner request={version.sourceRequest} />
      <ProgramCloPloView matrix={data} programId={programId} />
    </Flex>
  );
}
