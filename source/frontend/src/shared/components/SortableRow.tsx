import { HolderOutlined } from '@ant-design/icons';
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from 'antd';
import {
  createContext,
  useContext,
  useMemo,
  type CSSProperties,
  type HTMLAttributes,
} from 'react';

interface RowContextValue {
  setActivatorNodeRef?: (element: HTMLElement | null) => void;
  listeners?: DraggableSyntheticListeners;
  attributes?: DraggableAttributes;
}

const RowContext = createContext<RowContextValue>({});

// The grip in the first column. Pointer drag and keyboard drag (space to lift, arrows, space to drop) both start here;
// the drag attributes (role, tabIndex, aria-*) belong on this button, not on the row, which must stay a table row for assistive tech.
export function DragHandle() {
  const { setActivatorNodeRef, listeners, attributes } = useContext(RowContext);
  return (
    <Button
      type="text"
      size="small"
      icon={<HolderOutlined />}
      aria-label="Kéo để đổi thứ tự"
      style={{ cursor: 'grab' }}
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
    />
  );
}

interface SortableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  // AntD puts the table's rowKey here, which is the sortable id. Rows AntD draws itself (the empty-table
  // placeholder, expanded rows) have none.
  'data-row-key'?: string;
}

export function SortableRow(props: SortableRowProps) {
  // Only data rows are sortable. A row without a key would get id `undefined`, and dnd-kit compares it with
  // `active?.id` (also `undefined` while nothing is dragged), so it would count as "dragging" forever.
  if (!props['data-row-key']) return <tr {...props} />;
  return <SortableDataRow {...props} data-row-key={props['data-row-key']} />;
}

function SortableDataRow(props: SortableRowProps & { 'data-row-key': string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props['data-row-key'] });
  const style: CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    // Above the sibling rows of its own table only; never above modals, popups or the sticky header.
    ...(isDragging ? { position: 'relative', zIndex: 1 } : {}),
  };
  const context = useMemo(
    () => ({ setActivatorNodeRef, listeners, attributes }),
    [setActivatorNodeRef, listeners, attributes],
  );
  return (
    <RowContext.Provider value={context}>
      <tr {...props} ref={setNodeRef} style={style} />
    </RowContext.Provider>
  );
}
