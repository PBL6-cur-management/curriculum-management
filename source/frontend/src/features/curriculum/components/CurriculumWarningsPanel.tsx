import { Alert, Button, Flex, Typography } from 'antd';
import { useState } from 'react';
import type { CurriculumWarning } from '../api/curriculum';

interface CurriculumWarningsPanelProps {
  warnings: CurriculumWarning[];
}

export const itemElementId = (itemId: string) => `curriculum-item-${itemId}`;

function scrollToItem(itemId: string) {
  document
    .getElementById(itemElementId(itemId))
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

const ALERT_TYPE = { ERROR: 'error', HIGH: 'warning', INFO: 'info' } as const;
const RANK = { ERROR: 0, HIGH: 1, INFO: 2 } as const;
const SEVERITY_LABEL = {
  ERROR: 'lỗi',
  HIGH: 'cảnh báo',
  INFO: 'nhắc nhở',
} as const;
// Up to this many warnings are listed straight away; more stay folded so the frame stays in view.
const OPEN_LIMIT = 3;

// One panel for every warning of the frame: errors first (they block submit and release), then
// warnings, then reminders. A long list folds behind a count instead of pushing the table off-screen.
export function CurriculumWarningsPanel({
  warnings,
}: CurriculumWarningsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  if (warnings.length === 0) return null;
  const ordered = [...warnings].sort(
    (left, right) => RANK[left.severity] - RANK[right.severity],
  );
  const worst = ordered[0].severity;
  const counts = (Object.keys(RANK) as (keyof typeof RANK)[])
    .map((severity) => ({
      severity,
      count: ordered.filter((warning) => warning.severity === severity).length,
    }))
    .filter(({ count }) => count > 0)
    .map(({ severity, count }) => `${count} ${SEVERITY_LABEL[severity]}`)
    .join(', ');
  const foldable = ordered.length > OPEN_LIMIT;
  const open = !foldable || expanded;
  return (
    <Alert
      type={ALERT_TYPE[worst]}
      showIcon
      title={`Khung có ${counts}`}
      action={
        foldable ? (
          <Button
            size="small"
            type="link"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Thu gọn' : 'Xem chi tiết'}
          </Button>
        ) : undefined
      }
      description={
        open ? (
          <Flex
            vertical
            gap={4}
            role="list"
            aria-label="Cảnh báo của khung"
            style={{ marginTop: 4 }}
          >
            {ordered.map((warning, index) => (
              <Flex
                key={`${warning.code}-${warning.itemId ?? warning.semester}-${index}`}
                role="listitem"
                align="baseline"
                justify="space-between"
                gap={12}
              >
                <Typography.Text>
                  {ordered.some((other) => other.severity !== worst) && (
                    <Typography.Text strong>
                      {SEVERITY_LABEL[warning.severity]}:{' '}
                    </Typography.Text>
                  )}
                  {warning.message}
                </Typography.Text>
                {warning.itemId && (
                  <Button
                    size="small"
                    type="link"
                    onClick={() => scrollToItem(warning.itemId!)}
                  >
                    Xem
                  </Button>
                )}
              </Flex>
            ))}
          </Flex>
        ) : undefined
      }
    />
  );
}
