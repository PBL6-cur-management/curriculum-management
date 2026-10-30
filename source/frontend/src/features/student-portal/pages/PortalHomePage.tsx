import { Card, Descriptions, Flex, Typography } from 'antd';
import { Link, useLocation } from 'react-router';
import { formatEmpty } from '../../../shared/design-system';
import { PortalContextGate } from '../components/PortalContextBar';
import { PORTAL_NAV } from '../components/StudentLayout';
import {
  ENROLLMENT_TYPE_LABELS,
  STUDENT_STATUS_LABELS,
} from '../constants/portalLabels';

// MH-55: who I am and which program version applies to me; every other screen is one tap away.
export function PortalHomePage() {
  const { search } = useLocation();
  return (
    <PortalContextGate>
      {(_, me, program) => (
        <Flex vertical gap="middle">
          <Typography.Title level={3} style={{ margin: 0 }}>
            {me.student!.fullName}
          </Typography.Title>
          <Card size="small">
            <Descriptions
              column={1}
              size="small"
              items={[
                {
                  key: 'code',
                  label: 'Mã sinh viên',
                  children: me.student!.studentCode,
                },
                {
                  key: 'cohort',
                  label: 'Khóa',
                  children: me.student!.cohortCode,
                },
                {
                  key: 'status',
                  label: 'Tình trạng',
                  children: STUDENT_STATUS_LABELS[me.student!.status],
                },
                {
                  key: 'program',
                  label: ENROLLMENT_TYPE_LABELS[program.enrollmentType],
                  children: `${program.programCode} — ${program.programName}`,
                },
                {
                  key: 'version',
                  label: 'Phiên bản áp dụng',
                  children: formatEmpty(program.versionNumber),
                },
                {
                  key: 'decision',
                  label: 'Quyết định',
                  children: formatEmpty(program.decisionNumber),
                },
              ]}
            />
          </Card>
          <Flex vertical gap="small">
            {PORTAL_NAV.slice(1).map((item) => (
              <Link key={item.to} to={{ pathname: item.to, search }}>
                <Card size="small" hoverable>
                  <Typography.Text strong>{item.label}</Typography.Text>
                </Card>
              </Link>
            ))}
          </Flex>
        </Flex>
      )}
    </PortalContextGate>
  );
}
