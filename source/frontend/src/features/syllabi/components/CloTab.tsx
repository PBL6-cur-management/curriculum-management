import { PlusOutlined } from '@ant-design/icons';
import { closestCenter, DndContext } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { App, Button, Flex, Popconfirm, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import { useState } from 'react';
import {
  DragHandle,
  SortableRow,
} from '../../../shared/components/SortableRow';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { Clo } from '../api/syllabi';
import {
  ADD_CLO,
  cloDeleteConfirm,
  NO_CLOS,
} from '../constants/syllabusLabels';
import { useCloReorder } from '../hooks/useCloReorder';
import { useDeleteClo } from '../hooks/useSyllabus';
import type { EditorTabProps } from '../types';
import { CloFormModal } from './CloFormModal';

export function CloTab({ courseId, syllabus }: EditorTabProps) {
  const { message } = App.useApp();
  const [editing, setEditing] = useState<Clo | 'new' | null>(null);
  const remove = useDeleteClo(courseId);
  const { sensors, onDragEnd, shown, isSaving } = useCloReorder(
    courseId,
    syllabus.id,
    syllabus.clos,
  );
  const columns: TableColumnsType<Clo> = [
    { key: 'drag', width: 40, render: () => <DragHandle /> },
    { title: 'Mã', dataIndex: 'cloCode', width: 90 },
    { title: 'Mô tả', dataIndex: 'description' },
    {
      title: 'Mô tả (tiếng Anh)',
      dataIndex: 'englishDescription',
      render: (value: string | null) => value ?? '—',
    },
    {
      title: 'Mức nhận thức',
      dataIndex: 'cognitiveLevel',
      width: 130,
      render: (value: string | null) => value ?? '—',
    },
    {
      title: 'Thao tác',
      width: 130,
      render: (_value, clo) => (
        <Flex gap={4}>
          <Button type="link" size="small" onClick={() => setEditing(clo)}>
            Sửa
          </Button>
          <Popconfirm
            title={`Xóa ${clo.cloCode}?`}
            description={cloDeleteConfirm(
              clo.linkedPrograms,
              clo.assessmentLinkCount,
            )}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={() =>
              remove.mutateAsync(clo.id).catch((reason: unknown) => {
                void message.error(errorMessage(reason, 'Không xóa được CLO.'));
              })
            }
          >
            <Button type="link" size="small" danger>
              Xóa
            </Button>
          </Popconfirm>
        </Flex>
      ),
    },
  ];
  return (
    <Flex vertical gap="small">
      <Flex justify="end">
        <Button icon={<PlusOutlined />} onClick={() => setEditing('new')}>
          {ADD_CLO}
        </Button>
      </Flex>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={shown.map((clo) => clo.id)}
          strategy={verticalListSortingStrategy}
        >
          <Table<Clo>
            size="small"
            rowKey="id"
            pagination={false}
            loading={isSaving}
            columns={columns}
            dataSource={shown}
            locale={{ emptyText: NO_CLOS }}
            components={{ body: { row: SortableRow } }}
          />
        </SortableContext>
      </DndContext>
      {editing !== null && (
        <CloFormModal
          courseId={courseId}
          syllabusId={syllabus.id}
          clo={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Flex>
  );
}
