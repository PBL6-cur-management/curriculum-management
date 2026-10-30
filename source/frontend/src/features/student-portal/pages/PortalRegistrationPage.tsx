import { Alert, Card, Flex, Segmented, Skeleton, Typography } from 'antd';
import { useState } from 'react';
import { StatusTag } from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { EligibilityItem } from '../../curriculum/api/registrationEligibility';
import type { PortalContext } from '../api/portal';
import { PortalContextGate } from '../components/PortalContextBar';
import {
  ELIGIBILITY_COLORS,
  ELIGIBILITY_LABELS,
} from '../constants/portalLabels';
import { usePortalEligibility } from '../hooks/usePortal';

type View = 'CANDIDATES' | 'BLOCKED';

function ItemCard({ item }: { item: EligibilityItem }) {
  return (
    <Card size="small">
      <Flex vertical gap={4}>
        <Flex justify="space-between" gap="small" align="start">
          <Typography.Text strong>
            {item.course.courseCode} — {item.course.courseName}
          </Typography.Text>
          {item.eligibility && (
            <StatusTag
              status={item.eligibility}
              labelMap={ELIGIBILITY_LABELS}
              colorMap={ELIGIBILITY_COLORS}
            />
          )}
        </Flex>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {item.credits} TC · Học kỳ {item.plannedSemester} theo chương trình
        </Typography.Text>
        {item.requiredConcurrentCourses.length > 0 && (
          <Typography.Text style={{ fontSize: 13 }}>
            Phải đăng ký cùng:{' '}
            {item.requiredConcurrentCourses
              .map((course) => course.courseCode)
              .join(', ')}
          </Typography.Text>
        )}
        {item.reasons.length > 0 && (
          <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13 }}>
            {item.reasons.map((reason, index) => (
              <li key={`${reason.code}-${index}`}>{reason.message}</li>
            ))}
          </ul>
        )}
      </Flex>
    </Card>
  );
}

function Advice({ context }: { context: PortalContext }) {
  const [view, setView] = useState<View>('CANDIDATES');
  const answer = usePortalEligibility(context);
  if (answer.isPending) return <Skeleton active paragraph={{ rows: 6 }} />;
  if (answer.isError) {
    return (
      <Alert
        type="error"
        showIcon
        title={errorMessage(answer.error, 'Không tải được tư vấn đăng ký.')}
      />
    );
  }
  const open = answer.data.items.filter((item) => !item.completed);
  const candidates = open.filter((item) => item.eligibility !== 'INELIGIBLE');
  const blocked = open.filter((item) => item.eligibility === 'INELIGIBLE');
  const shown = view === 'CANDIDATES' ? candidates : blocked;
  return (
    <Flex vertical gap="small">
      <Segmented<View>
        block
        value={view}
        onChange={setView}
        options={[
          {
            value: 'CANDIDATES',
            label: `Có thể đăng ký (${candidates.length})`,
          },
          { value: 'BLOCKED', label: `Chưa đủ điều kiện (${blocked.length})` },
        ]}
      />
      {shown.length === 0 ? (
        <Alert type="info" title="Không có học phần nào trong mục này." />
      ) : (
        shown.map((item) => <ItemCard key={item.itemId} item={item} />)
      )}
    </Flex>
  );
}

// MH-58: advice only. Registering happens in the school's registration system, not here.
export function PortalRegistrationPage() {
  return (
    <PortalContextGate>
      {(context) => (
        <Flex vertical gap="middle">
          <Typography.Title level={4} style={{ margin: 0 }}>
            Tư vấn đăng ký học phần
          </Typography.Title>
          <Alert
            type="info"
            showIcon
            title="Chỉ để tham khảo theo điều kiện tiên quyết, học trước và song hành. Đăng ký thật thực hiện trên hệ thống của Trường; không bảo đảm lớp được mở."
          />
          <Advice context={context} />
        </Flex>
      )}
    </PortalContextGate>
  );
}
