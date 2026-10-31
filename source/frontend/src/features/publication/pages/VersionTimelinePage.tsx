import { Alert, Card, Flex, Space, Tag, Timeline, Typography } from 'antd';
import { generatePath, Link, useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import {
  VERSION_STATUS_COLORS,
  VERSION_STATUS_LABELS,
  versionLabel,
} from '../../../shared/constants/versionLabels';
import {
  EmptyState,
  PageHeader,
  PageSkeleton,
} from '../../../shared/design-system';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { TimelineEvent } from '../api/publication';
import { useVersionTimeline } from '../hooks/usePublication';

const date = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('vi-VN') : 'Chưa có';

function EventBody({
  event,
  programId,
}: {
  event: TimelineEvent;
  programId: string;
}) {
  return (
    <Flex vertical gap={4}>
      <Space size="small" wrap>
        <Link
          to={generatePath(ROUTES.versionDetail, {
            programId,
            versionId: event.versionId,
          })}
        >
          <Typography.Text strong>
            Phiên bản {versionLabel(event)}
          </Typography.Text>
        </Link>
        <Tag color={VERSION_STATUS_COLORS[event.status]}>
          {VERSION_STATUS_LABELS[event.status]}
        </Tag>
        {event.correctionOf ? (
          <Tag color="purple">
            Đính chính {versionLabel(event.correctionOf)}
          </Tag>
        ) : null}
      </Space>
      <Typography.Text type="secondary">
        Hiệu lực từ {event.effectiveSemester?.semesterCode ?? 'chưa xác định'} ·
        QĐ {event.decisionNumber ?? 'chưa có'} · ban hành{' '}
        {date(event.publishedAt)}
      </Typography.Text>
      {event.assignments.length ? (
        <Space size={[4, 4]} wrap>
          <Typography.Text type="secondary">Áp dụng cho:</Typography.Text>
          {event.assignments.map((assignment) => (
            <Tag key={assignment.id}>
              {assignment.cohortCode} từ {assignment.fromSemester.semesterCode}
            </Tag>
          ))}
        </Space>
      ) : (
        <Typography.Text type="secondary">
          Chưa gán cho khóa tuyển sinh nào.
        </Typography.Text>
      )}
      {event.previousVersion ? (
        <Link
          to={`${generatePath(ROUTES.versionCompare, { programId })}?beforeVersionId=${encodeURIComponent(event.previousVersion.id)}&afterVersionId=${encodeURIComponent(event.versionId)}`}
        >
          So sánh với phiên bản {versionLabel(event.previousVersion)}
        </Link>
      ) : null}
    </Flex>
  );
}

// MH-46 — US-112: issued versions in the order they took effect, with the cohorts each one applies to.
export default function VersionTimelinePage() {
  const { programId = '' } = useParams();
  const timeline = useVersionTimeline(programId);
  if (timeline.isPending) return <PageSkeleton />;
  if (!timeline.data)
    return (
      <Alert
        type="error"
        showIcon
        title={errorMessage(timeline.error, 'Không đọc được dòng thời gian.')}
      />
    );
  const { data } = timeline;
  return (
    <Flex vertical gap="middle">
      <PageHeader
        title="Dòng thời gian phiên bản"
        subtitle={`${data.programCode} — ${data.programName}. Chỉ các phiên bản đã ban hành; khóa tuyển sinh là lịch gán đã lưu, không phải số sinh viên.`}
        actions={
          <Link to={generatePath(ROUTES.versionHistory, { programId })}>
            Lịch sử phiên bản
          </Link>
        }
      />
      <Card>
        {data.events.length ? (
          <Timeline
            items={data.events.map((event) => ({
              key: event.versionId,
              color:
                event.status === 'ACTIVE'
                  ? 'green'
                  : event.status === 'PENDING'
                    ? 'gold'
                    : 'gray',
              content: <EventBody event={event} programId={programId} />,
            }))}
          />
        ) : (
          <EmptyState description="Chương trình chưa có phiên bản nào được ban hành" />
        )}
      </Card>
    </Flex>
  );
}
