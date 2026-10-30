import { Alert, Button, Flex } from 'antd';
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

// Errors first (they block submit and release), then warnings; INFO ones are reminders.
export function CurriculumWarningsPanel({
  warnings,
}: CurriculumWarningsPanelProps) {
  if (warnings.length === 0) return null;
  const ordered = [...warnings].sort(
    (left, right) => RANK[left.severity] - RANK[right.severity],
  );
  return (
    <Flex vertical gap="small" role="list" aria-label="Cảnh báo của khung">
      {ordered.map((warning, index) => (
        <Alert
          key={`${warning.code}-${warning.itemId ?? warning.semester}-${index}`}
          role="listitem"
          type={ALERT_TYPE[warning.severity]}
          showIcon
          title={warning.message}
          action={
            warning.itemId ? (
              <Button
                size="small"
                type="link"
                onClick={() => scrollToItem(warning.itemId!)}
              >
                Xem
              </Button>
            ) : undefined
          }
        />
      ))}
    </Flex>
  );
}
