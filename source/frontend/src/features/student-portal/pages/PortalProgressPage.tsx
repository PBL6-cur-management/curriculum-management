import { Alert, Card, Flex, Progress, Skeleton, Typography } from 'antd';
import { SummaryStrip } from '../../../shared/design-system';
import { GraduationError } from '../../graduation/components/GraduationError';
import { displayCredits } from '../../graduation/components/graduationPresentation';
import { AcademicResultsTable } from '../../students/components/AcademicResultsTable';
import type { PortalContext } from '../api/portal';
import { PortalContextGate } from '../components/PortalContextBar';
import { usePortalGraduation } from '../hooks/usePortal';

function Progression({ context }: { context: PortalContext }) {
  const live = usePortalGraduation(context);
  if (live.isPending) return <Skeleton active paragraph={{ rows: 4 }} />;
  if (live.isError)
    return (
      <GraduationError error={live.error} onRetry={() => void live.refetch()} />
    );
  const outcome = live.data;
  if (outcome.status !== 'REVIEWED') {
    // A policy or data gap is not zero credits: say so instead of drawing an empty bar.
    return (
      <Alert
        type="warning"
        showIcon
        title="Chưa tính được tiến độ"
        description={`${outcome.error.message} Liên hệ Phòng Đào tạo nếu cần kiểm tra.`}
      />
    );
  }
  const credits = outcome.result.credits;
  const required = Number(credits.requiredTotal);
  const percent =
    required > 0
      ? Math.min(
          100,
          Math.round((Number(credits.recognizedTotal) / required) * 100),
        )
      : 0;
  return (
    <Card size="small">
      <Flex vertical gap="small">
        <Progress percent={percent} aria-label="Tỷ lệ tín chỉ đã tích lũy" />
        <SummaryStrip
          label="Tín chỉ"
          items={[
            {
              label: 'Đã tích lũy',
              value: displayCredits(credits.recognizedTotal),
            },
            { label: 'Yêu cầu', value: displayCredits(credits.requiredTotal) },
            {
              label: 'Còn thiếu',
              value: displayCredits(credits.missingTotal),
              tone: Number(credits.missingTotal) > 0 ? 'warning' : 'default',
            },
            { label: 'Bắt buộc', value: displayCredits(credits.compulsory) },
            { label: 'Tự chọn', value: displayCredits(credits.elective) },
          ]}
        />
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          Cùng cách tính với Phòng Đào tạo khi xét tốt nghiệp; mỗi học phần chỉ
          được tính một lần.
        </Typography.Text>
      </Flex>
    </Card>
  );
}

// MH-57: recognised credits from the shared graduation engine, then every attempt as recorded.
export function PortalProgressPage() {
  return (
    <PortalContextGate>
      {(context) => (
        <Flex vertical gap="middle">
          <Typography.Title level={4} style={{ margin: 0 }}>
            Tiến độ học tập
          </Typography.Title>
          <Progression context={context} />
          <Typography.Title level={5} style={{ margin: 0 }}>
            Kết quả các lần học
          </Typography.Title>
          <AcademicResultsTable
            studentId={context.studentId}
            context={{
              programId: context.programId,
              semesterId: context.semesterId,
            }}
          />
        </Flex>
      )}
    </PortalContextGate>
  );
}
