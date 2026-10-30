// Molecule: Hàng bộ lọc của trang danh sách, tự xuống dòng ở màn hẹp, khoảng cách đồng nhất.
//
//   <FilterBar>
//     <Input.Search ... />
//     <Select ... />
//   </FilterBar>

import { Flex } from 'antd';
import type { ReactNode } from 'react';

interface FilterBarProps {
  children: ReactNode;
  /** Nội dung căn phải, ví dụ số kết quả hoặc nút xóa lọc */
  extra?: ReactNode;
}

export function FilterBar({ children, extra }: FilterBarProps) {
  return (
    <Flex justify="space-between" align="center" wrap gap="small">
      <Flex wrap gap="small" align="center">
        {children}
      </Flex>
      {extra}
    </Flex>
  );
}
