import { Space, Tag } from 'antd';
import { ESTIMATED_DATE_LABEL } from '../../../shared/releases/semesters';
import { formatDay } from '../utils/format';

interface SemesterStartDateProps {
  startDate: string | null;
  estimated: boolean;
  emptyLabel?: string;
}

// A start date plus, when the school calendar had none, a visible "estimated" tag (readable without hovering).
export function SemesterStartDate({
  startDate,
  estimated,
  emptyLabel = 'Chưa có',
}: SemesterStartDateProps) {
  if (!startDate) return <>{emptyLabel}</>;
  return (
    <Space size={4} wrap>
      <span>{formatDay(startDate)}</span>
      {estimated && <Tag>{ESTIMATED_DATE_LABEL}</Tag>}
    </Space>
  );
}
