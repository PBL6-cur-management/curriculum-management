import { CheckOutlined } from '@ant-design/icons';
import { closestCenter, DndContext } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Space, Table, Tag, Tooltip } from 'antd';
import type { TableColumnsType } from 'antd';
import { generatePath, Link } from 'react-router';
import { ROUTES } from '../../../routes';
import {
  DragHandle,
  SortableRow,
} from '../../../shared/components/SortableRow';
import type { Curriculum, CurriculumItem } from '../api/curriculum';
import {
  ELECTIVE_KIND_LABELS,
  HT_DA_LABEL,
  NO_SYLLABUS_TAG,
  SYLLABUS_LINK,
  TQ_DA_LABEL,
} from '../constants/curriculumLabels';
import { useSemesterReorder } from '../hooks/useSemesterReorder';
import { CurriculumItemActions } from './CurriculumItemActions';
import { itemElementId } from './CurriculumWarningsPanel';
import { RequisiteTags } from './RequisiteTags';
import { EligibilityStatus } from '../../../shared/registration-eligibility/EligibilityStatus';
import type { EligibilityByItemId } from '../../../shared/registration-eligibility/eligibilityLabels';
import { VERSION_ID_PARAM } from '../../../shared/releases/versionParams';
import { ELIGIBILITY_COLUMN_TITLE } from '../constants/curriculumLabels';

interface CurriculumTableProps {
  studentMode?: boolean;
  eligibilityByItemId?: EligibilityByItemId;
  onShowEligibility?: (itemId: string) => void;
  curriculum: Curriculum;
  items: CurriculumItem[];
  // Drag is off while a filter hides rows, or when the caller may not reorder.
  sortable: boolean;
  onEdit: (item: CurriculumItem) => void;
  onRequisites: (item: CurriculumItem) => void;
  // Row to highlight, from the consistency result's `focus` parameter.
  focusId?: string | null;
}

const flag = (on: boolean) => (on ? <CheckOutlined aria-label="Có" /> : null);

export function CurriculumTable({
  curriculum,
  items,
  sortable,
  onEdit,
  onRequisites,
  focusId,
  studentMode = false,
  eligibilityByItemId,
  onShowEligibility,
}: CurriculumTableProps) {
  const { sensors, onDragEnd, isSaving } = useSemesterReorder(curriculum);
  const columns: TableColumnsType<CurriculumItem> = [
    ...(studentMode
      ? [
          {
            title: ELIGIBILITY_COLUMN_TITLE,
            key: 'eligibility',
            render: (_value: unknown, item: CurriculumItem) => {
              const answer = eligibilityByItemId?.get(item.id);
              return answer ? (
                <EligibilityStatus
                  item={answer}
                  onShowReasons={() => onShowEligibility?.(item.id)}
                />
              ) : (
                <span>Chưa có kết quả; hãy tính lại.</span>
              );
            },
          },
        ]
      : []),
    ...(sortable
      ? [{ key: 'drag', width: 40, render: () => <DragHandle /> }]
      : []),
    { title: 'TT', dataIndex: 'displayOrder', width: 56 },
    { title: 'Mã HP', render: (_value, item) => item.course.courseCode },
    {
      title: 'Tên học phần',
      render: (_value, item) => (
        <Space size={4} wrap>
          {item.course.courseName}
          {!item.hasSyllabus && <Tag color="warning">{NO_SYLLABUS_TAG}</Tag>}
        </Space>
      ),
    },
    {
      title: 'TC',
      align: 'right',
      render: (_value, item) => item.course.credits,
    },
    { title: 'Học kỳ', dataIndex: 'plannedSemester', align: 'center' },
    {
      title: 'Khối',
      render: (_value, item) =>
        item.blockSymbol && (
          <Tooltip title={item.blockName ?? undefined}>
            <span>{item.blockSymbol}</span>
          </Tooltip>
        ),
    },
    {
      title: 'Loại',
      render: (_value, item) => (
        <>
          {item.isElective
            ? ELECTIVE_KIND_LABELS.elective
            : ELECTIVE_KIND_LABELS.compulsory}{' '}
          {item.electiveGroup && <Tag>{item.electiveGroup.groupCode}</Tag>}
        </>
      ),
    },
    {
      title: HT_DA_LABEL,
      align: 'center',
      render: (_value, item) => flag(item.htDa),
    },
    {
      title: TQ_DA_LABEL,
      align: 'center',
      render: (_value, item) => flag(item.tqDa),
    },
    {
      title: 'Điểm học',
      align: 'right',
      render: (_value, item) => item.minStudiedScore,
    },
    {
      title: 'Điểm chuyển',
      align: 'right',
      render: (_value, item) => item.minTransferScore,
    },
    {
      title: 'Điều kiện',
      render: (_value, item) => <RequisiteTags item={item} />,
    },
    { title: 'Ghi chú', dataIndex: 'note' },
    {
      title: 'Thao tác',
      render: (_value, item) => (
        <Space size={0} wrap>
          <Link
            to={`${generatePath(ROUTES.syllabus, { courseId: item.course.id })}${studentMode ? `?${new URLSearchParams({ [VERSION_ID_PARAM]: curriculum.version.id })}` : ''}`}
          >
            {SYLLABUS_LINK}
          </Link>
          {!studentMode && (
            <CurriculumItemActions
              versionId={curriculum.version.id}
              item={item}
              onEdit={onEdit}
              onRequisites={onRequisites}
            />
          )}
        </Space>
      ),
    },
  ];
  const table = (
    <Table<CurriculumItem>
      size="small"
      rowKey="id"
      pagination={false}
      loading={isSaving}
      columns={columns}
      dataSource={items}
      scroll={{ x: 'max-content' }}
      components={sortable ? { body: { row: SortableRow } } : undefined}
      rowClassName={(item) =>
        item.id === focusId ? 'ant-table-row-selected' : ''
      }
      onRow={(item) => ({ id: itemElementId(item.id) })}
    />
  );
  if (!sortable) return table;
  // One context for the whole table: a drop onto a row of another semester is ignored by the reorder hook.
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        {table}
      </SortableContext>
    </DndContext>
  );
}
