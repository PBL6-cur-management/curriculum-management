import { Tag, Tooltip } from 'antd';
import type { ProgramStatus } from '../api/programs';
import { PROGRAM_TAG_DISPLAY } from '../constants/programLabels';

interface ProgramStatusTagProps {
  status: ProgramStatus;
  hasReleasedVersion?: boolean;
}

export function ProgramStatusTag({
  status,
  hasReleasedVersion = true,
}: ProgramStatusTagProps) {
  const display =
    status === 'INACTIVE'
      ? PROGRAM_TAG_DISPLAY.INACTIVE
      : hasReleasedVersion
        ? PROGRAM_TAG_DISPLAY.ACTIVE
        : PROGRAM_TAG_DISPLAY.DRAFT_ONLY;
  return (
    <Tooltip title={display.tooltip}>
      <Tag color={display.color}>{display.label}</Tag>
    </Tooltip>
  );
}
