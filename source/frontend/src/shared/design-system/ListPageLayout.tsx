// Template: Layout chuẩn cho trang danh sách.
// Dùng khi trang gồm: header (title + action) + filter bar + table.
//
// Ví dụ dùng:
//   <ListPageLayout
//     header={<PageHeader title="Tài khoản" actions={<Button>Thêm</Button>} />}
//     filters={
//       <>
//         <Input.Search ... />
//         <Select ... />
//       </>
//     }
//     table={<DataTable ... />}
//   />

import { Flex } from 'antd';
import { FilterBar } from './FilterBar.js';
import type { ReactNode } from 'react';

interface ListPageLayoutProps {
  /** PageHeader component (title + action buttons) */
  header: ReactNode;
  /** Filter controls — tự đặt trong FilterBar */
  filters: ReactNode;
  /** DataTable hoặc Table component */
  table: ReactNode;
}

export function ListPageLayout({
  header,
  filters,
  table,
}: ListPageLayoutProps) {
  return (
    <Flex vertical gap="middle">
      {header}
      <FilterBar>{filters}</FilterBar>
      {table}
    </Flex>
  );
}
