import { Alert, Descriptions } from 'antd';
import { generatePath, Link } from 'react-router';
import { ROUTES } from '../../../routes';
import type { GraduationAudit } from '../schema/graduation';
import {
  FRESHNESS_LABELS,
  TRIGGER_LABELS,
} from '../constants/graduationLabels';
import { displayGpa, displayTime } from './graduationPresentation';

interface GraduationAuditSummaryProps {
  audit: GraduationAudit;
}
export function GraduationAuditSummary({ audit }: GraduationAuditSummaryProps) {
  const hasGpa =
    audit.result.cumulativeGpa !== undefined ||
    audit.result.minGraduationGpa !== undefined;
  return (
    <>
      <Alert
        type={audit.freshness === 'CURRENT' ? 'info' : 'warning'}
        showIcon
        title={FRESHNESS_LABELS[audit.freshness]}
        description="Lần xét đã lưu phản ánh dữ liệu tại thời điểm xét; không thay thế quyết định công nhận tốt nghiệp."
      />
      <Descriptions
        items={[
          {
            key: 'time',
            label: 'Đã lưu lúc',
            children: (
              <Link
                to={generatePath(ROUTES.graduationAudit, { auditId: audit.id })}
              >
                {displayTime(audit.auditedAt)}
              </Link>
            ),
          },
          {
            key: 'actor',
            label: 'Người xét',
            children: audit.auditedBy?.fullName ?? 'Hệ thống',
          },
          {
            key: 'trigger',
            label: 'Nguồn',
            children: TRIGGER_LABELS[audit.trigger],
          },
          ...(hasGpa
            ? [
                {
                  key: 'gpa',
                  label: 'GPA khi lưu',
                  children: displayGpa(
                    audit.result.cumulativeGpa,
                    audit.result.minGraduationGpa,
                  ),
                },
              ]
            : []),
        ]}
      />
    </>
  );
}
