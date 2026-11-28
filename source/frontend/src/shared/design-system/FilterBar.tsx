// Molecule: Hàng bộ lọc của trang danh sách, tự xuống dòng ở màn hẹp, khoảng cách đồng nhất.
//
//   <FilterBar>
//     <Input.Search ... />
//     <Select ... />
//   </FilterBar>

import { Flex } from 'antd';
import type { ReactNode } from 'react';
import { palette, radius } from './tokens.js';

interface FilterBarProps {
  children: ReactNode;
  /** Nội dung căn phải, ví dụ số kết quả hoặc nút xóa lọc */
  extra?: ReactNode;
}

export function FilterBar({ children, extra }: FilterBarProps) {
  return (
    <Flex
      justify="space-between"
      align="center"
      wrap
      gap="small"
      style={{
        background: palette.white,
        border: `1px solid ${palette.slate200}`,
        borderRadius: radius.md,
        padding: '10px 14px',
      }}
    >
      <Flex wrap gap="small" align="center">
        {children}
      </Flex>
      {extra}
    </Flex>
  );
}
