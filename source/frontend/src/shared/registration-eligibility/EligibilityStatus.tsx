import { Button, Space, Typography } from 'antd';
import { StatusTag } from '../design-system';
import {
  ELIGIBILITY_COLORS,
  hasConsistentEligibilityState,
  type EligibilityItemView,
} from './eligibilityLabels';

export function EligibilityStatus({
  item,
  onShowReasons,
}: {
  item: EligibilityItemView;
  onShowReasons?: () => void;
}) {
  const status = item.completed ? 'COMPLETED' : item.eligibility;
  if (!status || !hasConsistentEligibilityState(item))
    return (
      <Typography.Text type="danger">
        Dữ liệu điều kiện không hợp lệ; hãy tính lại.
      </Typography.Text>
    );
  return (
    <Space wrap size="small">
      <StatusTag
        status={status}
        colorMap={ELIGIBILITY_COLORS}
        labelMap={{ [status]: item.statusText }}
      />
      {item.reasons.length > 0 && (
        <Button
          type="link"
          size="small"
          aria-label={`Xem lý do ${item.course.courseCode}`}
          onClick={onShowReasons}
        >
          Xem lý do
        </Button>
      )}
    </Space>
  );
}
