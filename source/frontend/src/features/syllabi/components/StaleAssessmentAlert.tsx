import { Alert, Button } from 'antd';
import { RELOAD_DATA, STALE_FORM } from '../constants/gradeFormulaLabels';

interface StaleAssessmentAlertProps {
  loading: boolean;
  onReload: () => void;
}

export function StaleAssessmentAlert({
  loading,
  onReload,
}: StaleAssessmentAlertProps) {
  return (
    <Alert
      type="warning"
      showIcon
      title={STALE_FORM}
      action={
        <Button size="small" loading={loading} onClick={onReload}>
          {RELOAD_DATA}
        </Button>
      }
    />
  );
}
