import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { render, screen } from '@testing-library/react';
import { Table } from 'antd';
import { describe, expect, it } from 'vitest';
import { SortableRow } from './SortableRow';

interface Row {
  id: string;
  name: string;
}

function SortableTable({ rows }: { rows: Row[] }) {
  return (
    <DndContext>
      <SortableContext items={rows.map((row) => row.id)}>
        <Table<Row>
          rowKey="id"
          dataSource={rows}
          columns={[{ title: 'Tên', dataIndex: 'name' }]}
          components={{ body: { row: SortableRow } }}
          pagination={false}
        />
      </SortableContext>
    </DndContext>
  );
}

describe('SortableRow', () => {
  // Regression: the empty-table placeholder row has no key, was taken for the dragged row and got z-index 9999,
  // covering modals and dropdowns opened over an empty sortable table.
  it('leaves the empty-table placeholder row out of the stacking order', () => {
    const { container } = render(<SortableTable rows={[]} />);
    const placeholder = container.querySelector<HTMLElement>(
      '.ant-table-placeholder',
    );
    expect(placeholder).not.toBeNull();
    expect(placeholder?.style.zIndex).toBe('');
    expect(placeholder?.style.position).toBe('');
  });

  it('keeps data rows sortable without lifting them while nothing is dragged', () => {
    render(<SortableTable rows={[{ id: 'a', name: 'Học phần A' }]} />);
    const row = screen.getByText('Học phần A').closest('tr');
    expect(row).toHaveAttribute('data-row-key', 'a');
    expect(row?.style.zIndex).toBe('');
  });
});
