// Molecule: Empty state với message rõ ràng và optional action.
// Hơn AntD Empty thuần: enforce directive copy (không generic) và có action button.
//
// Ví dụ dùng:
//   <EmptyState description="Chưa có thành viên nào" />
//   <EmptyState
//     description="Chưa có tài khoản nào"
//     actionLabel="Thêm tài khoản"
//     onAction={() => setCreating(true)}
//   />

import { Button, Empty } from 'antd';

interface EmptyStateProps {
  /** Mô tả trạng thái rỗng — phải specific: "Chưa có [entity]" */
  description: string;
  /** Label của nút hành động (verb + noun: "Thêm tài khoản") */
  actionLabel?: string;
  /** Handler khi nhấn nút hành động */
  onAction?: () => void;
}

export function EmptyState({
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <Empty description={description} image={Empty.PRESENTED_IMAGE_SIMPLE}>
      {actionLabel && onAction && (
        <Button type="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Empty>
  );
}
