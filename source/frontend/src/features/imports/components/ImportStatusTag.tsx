import { StatusTag } from '../../../shared/design-system';
import type { ImportStatus } from '../api/imports';
import {
  IMPORT_STATUS_COLORS,
  IMPORT_STATUS_LABELS,
} from '../constants/importLabels';

interface ImportStatusTagProps {
  status: ImportStatus;
}
export function ImportStatusTag({ status }: ImportStatusTagProps) {
  return (
    <StatusTag
      status={status}
      colorMap={IMPORT_STATUS_COLORS}
      labelMap={IMPORT_STATUS_LABELS}
    />
  );
}
