// Molecule: Dải số liệu tóm tắt (nhãn + giá trị), số dùng chữ số đều cột.
// Dùng cho tổng tín chỉ, số lượng theo trạng thái, số mục chờ duyệt.
//
//   <SummaryStrip items={[
//     { label: 'Chờ duyệt', value: 12 },
//     { label: 'Quá hạn', value: 2, tone: 'warning' },
//   ]} />

import { Flex, Typography } from 'antd';
import type { ReactNode } from 'react';

export interface SummaryItem {
  label: string;
  value: ReactNode;
  /** warning/danger chỉ khi số liệu cần người dùng xử lý */
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

interface SummaryStripProps {
  items: SummaryItem[];
  /** aria-label cho cả dải, mặc định "Tóm tắt" */
  label?: string;
}

const TONE_TYPE = {
  default: undefined,
  success: 'success',
  warning: 'warning',
  danger: 'danger',
} as const;

export function SummaryStrip({ items, label = 'Tóm tắt' }: SummaryStripProps) {
  return (
    <Flex
      role="group"
      aria-label={label}
      wrap
      gap={32}
      style={{
        padding: '12px 16px',
        borderRadius: 12,
        background: 'var(--ctdt-color-fill-quaternary)',
      }}
    >
      {items.map((item) => (
        <Flex key={item.label} vertical gap={2}>
          <Typography.Text type="secondary">{item.label}</Typography.Text>
          <Typography.Text
            strong
            type={TONE_TYPE[item.tone ?? 'default']}
            style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }}
          >
            {item.value}
          </Typography.Text>
        </Flex>
      ))}
    </Flex>
  );
}
