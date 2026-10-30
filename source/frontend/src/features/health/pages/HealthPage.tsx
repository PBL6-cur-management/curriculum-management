import { ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Spin, Tag, Flex } from 'antd';
import {
  type DependencyStatus,
  fetchHealth,
  type Health,
  healthQueryKey,
} from '../api/health';
import { PageHeader } from '../../../shared/design-system';

type Dependency = Exclude<keyof Health, 'status'>;

const DEPENDENCY_LABELS: Record<Dependency, string> = {
  database: 'Cơ sở dữ liệu',
  redis: 'Hàng đợi (Redis)',
};

const STATUS_TAGS: Record<DependencyStatus, { color: string; text: string }> = {
  up: { color: 'success', text: 'Hoạt động' },
  down: { color: 'error', text: 'Mất kết nối' },
};

export function HealthPage() {
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: healthQueryKey,
    queryFn: fetchHealth,
  });

  return (
    <Flex vertical gap="middle">
      <PageHeader
        title="Trạng thái hệ thống"
        actions={
          <Button
            icon={<ReloadOutlined />}
            loading={isFetching}
            onClick={() => void refetch()}
          >
            Kiểm tra lại
          </Button>
        }
      />
      <Card>
        {isPending ? (
          <Spin />
        ) : isError ? (
          <Alert
            type="error"
            showIcon
            title="Không kết nối được máy chủ ứng dụng"
          />
        ) : (
          <Descriptions
            bordered
            column={1}
            items={(Object.keys(DEPENDENCY_LABELS) as Dependency[]).map(
              (key) => ({
                key,
                label: DEPENDENCY_LABELS[key],
                children: (
                  <Tag color={STATUS_TAGS[data[key]].color}>
                    {STATUS_TAGS[data[key]].text}
                  </Tag>
                ),
              }),
            )}
          />
        )}
      </Card>
    </Flex>
  );
}
