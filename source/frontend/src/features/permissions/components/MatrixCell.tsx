import { LockOutlined } from '@ant-design/icons';
import { Flex, Typography, theme } from 'antd';
import type { CellKey } from '../constants/matrixLabels';
import {
  CELL_OPTIONS,
  LOCKED_REASON,
  NO_CELL_LABEL,
  NO_CELL_SHORT,
} from '../constants/matrixLabels';

interface MatrixCellProps {
  cellKey: CellKey;
  locked: boolean;
}

// Ô chỉ đọc: chấm hình dạng + chữ ngắn, đọc được không cần hover và không chỉ dựa vào màu.
export function MatrixCell({ cellKey, locked }: MatrixCellProps) {
  const { token } = theme.useToken();
  if (cellKey === 'none')
    return (
      <Flex
        align="center"
        gap={6}
        aria-label={`${NO_CELL_LABEL}${locked ? ` (${LOCKED_REASON})` : ''}`}
      >
        <Typography.Text type="secondary">{NO_CELL_SHORT}</Typography.Text>
        {locked && (
          <LockOutlined
            aria-hidden
            style={{ color: token.colorTextTertiary, fontSize: 12 }}
          />
        )}
      </Flex>
    );
  const option = CELL_OPTIONS.find((entry) => entry.key === cellKey)!;
  const direct = option.mode === 'DIRECT';
  const all = option.scope === 'ALL';
  const color = direct ? token.colorPrimary : token.colorWarning;
  return (
    <Flex
      align="center"
      gap={6}
      aria-label={`${option.label}${locked ? ` (${LOCKED_REASON})` : ''}`}
      title={option.label}
    >
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          flexShrink: 0,
          borderRadius: direct ? '50%' : 2,
          background: all ? color : 'transparent',
          border: `2px solid ${color}`,
          transform: direct ? undefined : 'rotate(45deg) scale(0.85)',
        }}
      />
      <Typography.Text style={{ fontSize: token.fontSizeSM }}>
        {option.short}
      </Typography.Text>
      {locked && (
        <LockOutlined
          aria-hidden
          style={{ color: token.colorTextTertiary, fontSize: 12 }}
        />
      )}
    </Flex>
  );
}

export function MatrixLegend() {
  return (
    <Flex wrap gap={20} align="center">
      {CELL_OPTIONS.map((option) => (
        <MatrixCell key={option.key} cellKey={option.key} locked={false} />
      ))}
      <Flex align="center" gap={6}>
        <Typography.Text type="secondary">{NO_CELL_SHORT}</Typography.Text>
        <Typography.Text style={{ fontSize: 12 }}>{NO_CELL_LABEL}</Typography.Text>
      </Flex>
      <Flex align="center" gap={6}>
        <LockOutlined aria-hidden />
        <Typography.Text style={{ fontSize: 12 }}>Bị khóa</Typography.Text>
      </Flex>
    </Flex>
  );
}
