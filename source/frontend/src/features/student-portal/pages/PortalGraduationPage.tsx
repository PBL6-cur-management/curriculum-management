import { Alert, Flex, Skeleton, Typography } from 'antd';
import { GraduationError } from '../../graduation/components/GraduationError';
import { GraduationResultView } from '../../graduation/components/GraduationResultView';
import type { PortalContext } from '../api/portal';
import { PortalContextGate } from '../components/PortalContextBar';
import { usePortalGraduation } from '../hooks/usePortal';

function Review({ context }: { context: PortalContext }) {
  const live = usePortalGraduation(context);
  if (live.isPending) return <Skeleton active paragraph={{ rows: 6 }} />;
  if (live.isError)
    return (
      <GraduationError error={live.error} onRetry={() => void live.refetch()} />
    );
  const outcome = live.data;
  if (outcome.status !== 'REVIEWED') {
    return (
      <Alert
        type="warning"
        showIcon
        title="Chưa thể kết luận"
        description={`${outcome.error.message} Liên hệ Phòng Đào tạo để kiểm tra dữ liệu.`}
      />
    );
  }
  return <GraduationResultView result={outcome.result} />;
}

// MH-59: the same live evaluation the office uses, computed now and never saved from here.
export function PortalGraduationPage() {
  return (
    <PortalContextGate>
      {(context) => (
        <Flex vertical gap="middle">
          <Typography.Title level={4} style={{ margin: 0 }}>
            Tự kiểm tra điều kiện tốt nghiệp
          </Typography.Title>
          <Alert
            type="info"
            showIcon
            title="Kết quả tính tại thời điểm xem, chưa phải quyết định công nhận tốt nghiệp."
          />
          <Review context={context} />
        </Flex>
      )}
    </PortalContextGate>
  );
}
