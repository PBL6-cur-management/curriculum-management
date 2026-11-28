// Molecule: Header chuẩn cho mọi trang — title bên trái, actions bên phải.
// Thay thế pattern <Typography.Title level={2}> + <Space> lặp trong mỗi page.
//
// Ví dụ dùng:
//   <PageHeader
//     title="Tài khoản"
//     subtitle="Kiểm tra lúc 10:00"
//     actions={<Button type="primary" onClick={...}>Thêm tài khoản</Button>}
//   />

import { Flex, Typography } from 'antd';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  /** Tiêu đề trang, hiển thị ở bên trái (chuỗi, hoặc chuỗi kèm thẻ trạng thái) */
  title: ReactNode;
  /** Một dòng phụ dưới tiêu đề: thời điểm, phạm vi, phiên bản */
  subtitle?: ReactNode;
  /** Các nút hành động, hiển thị ở bên phải */
  actions?: ReactNode;
  /** Chế độ gọn dùng trong tab workspace đã có tiêu đề chính ở trên */
  compact?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  compact = false,
}: PageHeaderProps) {
  return (
    <Flex justify="space-between" align="center" wrap gap="small">
      <Flex vertical gap={2}>
        {compact ? (
          <Typography.Title
            level={4}
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              lineHeight: 1.4,
            }}
          >
            {title}
          </Typography.Title>
        ) : (
          <Typography.Title
            level={2}
            style={{
              margin: 0,
              fontSize: 22,
              lineHeight: 1.3,
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </Typography.Title>
        )}
        {subtitle && (
          <Typography.Text type="secondary">{subtitle}</Typography.Text>
        )}
      </Flex>
      {actions && (
        <Flex wrap gap={8} align="center">
          {actions}
        </Flex>
      )}
    </Flex>
  );
}
