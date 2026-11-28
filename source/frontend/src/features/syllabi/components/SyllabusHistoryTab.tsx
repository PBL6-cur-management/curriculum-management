import { Button, Drawer, Result, Skeleton, Table, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { useState } from 'react';
import type { SyllabusHistoryItem } from '../api/syllabi';
import {
  NO_HISTORY,
  REQUEST_COPY_TAB_LABEL,
  SYLLABUS_STATUS_COLORS,
  SYLLABUS_STATUS_LABELS,
  type SyllabusLanguage,
} from '../constants/syllabusLabels';
import { useSyllabusHistory, useSyllabusRevision } from '../hooks/useSyllabus';
import { formatDate } from '../utils/formatDateTime';
import { SyllabusSections } from './SyllabusSections';

interface SyllabusHistoryTabProps {
  courseId: string;
  language: SyllabusLanguage;
}

export function SyllabusHistoryTab({
  courseId,
  language,
}: SyllabusHistoryTabProps) {
  const { data = [], isPending, isError } = useSyllabusHistory(courseId);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const revision = useSyllabusRevision(courseId, viewingId);

  if (isError)
    return <Result status="error" title="Không tải được lịch sử phiên bản" />;

  const viewingItem = data.find((item) => item.id === viewingId) ?? null;
  const drawerTitle = viewingItem
    ? viewingItem.revisionNumber !== null
      ? `${SYLLABUS_STATUS_LABELS[viewingItem.status]} — bản ${viewingItem.revisionNumber}`
      : REQUEST_COPY_TAB_LABEL
    : 'Chi tiết phiên bản đề cương';

  const columns: TableColumnsType<SyllabusHistoryItem> = [
    {
      title: 'Phiên bản',
      dataIndex: 'revisionNumber',
      render: (revisionNumber: number | null) =>
        revisionNumber !== null
          ? `Bản ${revisionNumber}`
          : REQUEST_COPY_TAB_LABEL,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (status: SyllabusHistoryItem['status']) => (
        <Tag color={SYLLABUS_STATUS_COLORS[status]}>
          {SYLLABUS_STATUS_LABELS[status]}
        </Tag>
      ),
    },
    {
      title: 'Học kỳ hiệu lực',
      dataIndex: 'effectiveSemester',
      render: (semester: SyllabusHistoryItem['effectiveSemester']) =>
        semester?.semesterCode ?? '—',
    },
    {
      title: 'Số văn bản',
      dataIndex: 'documentNumber',
      render: (doc: string | null) => doc ?? '—',
    },
    {
      title: 'Ngày ký',
      dataIndex: 'signedDate',
      render: (iso: string | null) => (iso ? formatDate(iso) : '—'),
    },
    {
      title: 'Ngày ban hành',
      dataIndex: 'publishedAt',
      render: (iso: string | null) => (iso ? formatDate(iso) : '—'),
    },
    {
      title: 'Tệp đính kèm',
      dataIndex: 'attachmentCount',
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_value, row) => (
        <Button
          type="link"
          size="small"
          onClick={() => setViewingId(row.id)}
        >
          Xem chi tiết
        </Button>
      ),
    },
  ];

  return (
    <>
      <Table<SyllabusHistoryItem>
        rowKey="id"
        size="small"
        loading={isPending}
        columns={columns}
        dataSource={data}
        pagination={false}
        locale={{ emptyText: NO_HISTORY }}
      />
      <Drawer
        open={viewingId !== null}
        title={drawerTitle}
        width={900}
        onClose={() => setViewingId(null)}
        destroyOnHidden
      >
        {revision.isPending ? (
          <Skeleton active />
        ) : revision.isError || !revision.data ? (
          <Result status="error" title="Không tải được phiên bản đề cương" />
        ) : (
          <SyllabusSections syllabus={revision.data} language={language} />
        )}
      </Drawer>
    </>
  );
}
