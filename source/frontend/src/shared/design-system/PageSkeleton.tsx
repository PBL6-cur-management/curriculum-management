// Molecule: Khung chờ của cả trang: một vạch tiêu đề và nội dung. Thay cho <Skeleton active /> đứng trơ.

import { Flex, Skeleton } from 'antd';

interface PageSkeletonProps {
  /** Số đoạn nội dung, mặc định 2 */
  blocks?: number;
}

export function PageSkeleton({ blocks = 2 }: PageSkeletonProps) {
  return (
    <Flex vertical gap="large" aria-busy="true" aria-label="Đang tải">
      <Skeleton.Input active size="large" style={{ width: 320 }} />
      {Array.from({ length: blocks }, (_, index) => (
        <Skeleton key={index} active paragraph={{ rows: 4 }} title={false} />
      ))}
    </Flex>
  );
}
