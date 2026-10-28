import { Alert } from 'antd';
import type { AssessmentWarning } from '../api/syllabi';
import { cloWarningText } from '../constants/gradeFormulaLabels';

interface AssessmentCoverageAlertProps {
  warnings: readonly AssessmentWarning[];
}

export function AssessmentCoverageAlert({
  warnings,
}: AssessmentCoverageAlertProps) {
  if (warnings.length === 0) return null;
  return (
    <Alert
      type="warning"
      showIcon
      title={cloWarningText(warnings.map((warning) => warning.cloCode))}
    />
  );
}
