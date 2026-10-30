// Organism: Table wrapper chuẩn với pagination pattern đồng nhất.
// Thay thế pattern <Table> + pagination config lặp lại ở mọi list page.
//
// Ví dụ dùng:
//   <DataTable
//     rowKey="id"
//     columns={columns}
//     dataSource={data?.items ?? []}
//     total={data?.total ?? 0}
//     page={params.page}
//     pageSize={params.pageSize}
//     loading={isPending}
//     onPageChange={(page, pageSize) => setParams(p => ({ ...p, page, pageSize }))}
//   />

import { Table } from 'antd';
import type { TableColumnsType, TableProps } from 'antd';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../api/pagination.js';

interface DataTableProps<T> extends Omit<
  TableProps<T>,
  'pagination' | 'columns' | 'dataSource'
> {
  /** Column definitions */
  columns: TableColumnsType<T>;
  /** Data rows */
  dataSource: T[];
  /** Total item count (from API) */
  total: number;
  /** Current page (1-indexed) */
  page: number;
  /** Page size, defaults to DEFAULT_PAGE_SIZE */
  pageSize?: number;
  /** Loading state */
  loading?: boolean;
  /** Called when page or pageSize changes */
  onPageChange: (page: number, pageSize: number) => void;
  /** Empty state text — should be specific: "Chưa có [entity]" */
  emptyText?: string;
}

export function DataTable<T extends object>({
  columns,
  dataSource,
  total,
  page,
  pageSize = DEFAULT_PAGE_SIZE,
  loading,
  onPageChange,
  emptyText = 'Chưa có dữ liệu',
  ...rest
}: DataTableProps<T>) {
  return (
    <Table<T>
      columns={columns}
      dataSource={dataSource}
      loading={loading}
      locale={{ emptyText }}
      pagination={{
        current: page,
        pageSize,
        total,
        pageSizeOptions: PAGE_SIZE_OPTIONS,
        showSizeChanger: true,
        showTotal: (t) => `${t} kết quả`,
        onChange: onPageChange,
      }}
      {...rest}
    />
  );
}
