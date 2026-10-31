import {
  Alert,
  Button,
  Card,
  Descriptions,
  Flex,
  Popconfirm,
  Result,
  App,
} from 'antd';
import { generatePath, Link, useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { ApiError } from '../../../shared/api/client';
import { RequestStatusTag } from '../../../shared/change-requests/RequestStatusTag';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { ChangeRequestDetail } from '../api/changeRequests';
import { ApprovalHistory } from '../components/ApprovalHistory';
import { ApprovalPanel } from '../components/ApprovalPanel';
import { CommentsCard } from '../components/CommentsCard';
import { ConflictAlert } from '../components/ConflictAlert';
import { DocumentsCard } from '../components/DocumentsCard';
import { ReleaseCard } from '../components/ReleaseCard';
import { RequestDiff } from '../components/RequestDiff';
import { StepProgress } from '../components/StepProgress';
import {
  ORIGIN_LABELS,
  REQUEST_TYPE_LABELS,
  TARGET_TYPE_LABELS,
  WITHDRAW_CONFIRM,
} from '../constants/changeRequestLabels';
import {
  useChangeRequest,
  useWithdrawChangeRequest,
} from '../hooks/useChangeRequests';
import { formatDateTime } from '../utils/format';
import {
  BackLink,
  PageHeader,
  PageSkeleton,
} from '../../../shared/design-system';

// Where the target lives; null when the viewer has no screen for it.
function targetLink(request: ChangeRequestDetail): string | null {
  const { targetType, id } = request.target;
  if (targetType === 'COURSE')
    return generatePath(ROUTES.courseDetail, { courseId: id });
  if (targetType === 'PROGRAM')
    return generatePath(ROUTES.programDetail, { programId: id });
  return generatePath(ROUTES.subjectGroupDetail, { groupId: id });
}

// MH-41: the request as everyone with visibility reads it, with the approval panel for whoever may decide.
export function ChangeRequestDetailPage() {
  const { requestId = '' } = useParams();
  const { message } = App.useApp();
  const { data: request, isPending, error } = useChangeRequest(requestId);
  const withdraw = useWithdrawChangeRequest(requestId);
  if (isPending) return <PageSkeleton />;
  if (!request) {
    if (error instanceof ApiError && error.status === 403)
      return <Result status="403" title="Bạn không có quyền xem đề xuất này" />;
    return <Result status="404" title="Không tìm thấy đề xuất" />;
  }
  const link = targetLink(request);
  return (
    <Flex vertical gap="middle">
      <BackLink to={ROUTES.changeRequests} preferHistory>
        Quay lại
      </BackLink>
      <PageHeader
        title={
          <>
            {request.requestCode} — {request.title}{' '}
            <RequestStatusTag status={request.status} />
          </>
        }
        actions={
          <>
            {request.permissions.canEdit && (
              <Link to={generatePath(ROUTES.changeRequestEdit, { requestId })}>
                <Button type="primary">Tiếp tục soạn</Button>
              </Link>
            )}
            {request.permissions.canWithdraw && (
              <Popconfirm
                title={WITHDRAW_CONFIRM}
                okText="Rút"
                cancelText="Hủy"
                onConfirm={() =>
                  withdraw.mutateAsync().catch((reason: unknown) => {
                    void message.error(
                      errorMessage(reason, 'Không rút được đề xuất.'),
                    );
                  })
                }
              >
                <Button>Rút đề xuất</Button>
              </Popconfirm>
            )}
          </>
        }
      />
      {request.status === 'WITHDRAWN' && (
        <Alert
          type="warning"
          showIcon
          title="Đề xuất đã được rút; bản nháp chỉ còn để tra cứu."
        />
      )}
      <ConflictAlert conflicts={request.conflicts} />
      {/* The decision first, then what is being decided, then the context. */}
      <ApprovalPanel request={request} />
      {request.steps.length > 0 && (
        <Card title="Tiến độ phê duyệt">
          <StepProgress steps={request.steps} />
        </Card>
      )}
      <Card title="Thay đổi so với bản đang áp dụng">
        <RequestDiff requestId={requestId} />
      </Card>
      <Card title="Thông tin đề xuất">
        <Descriptions column={{ xs: 1, md: 2 }} size="small">
          <Descriptions.Item label="Loại">
            {REQUEST_TYPE_LABELS[request.requestType]}
          </Descriptions.Item>
          <Descriptions.Item
            label={TARGET_TYPE_LABELS[request.target.targetType]}
          >
            {link ? (
              <Link to={link}>
                {request.target.code} — {request.target.name}
              </Link>
            ) : (
              `${request.target.code} — ${request.target.name}`
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Tiêu đề">{request.title}</Descriptions.Item>
          <Descriptions.Item label="Nguồn">
            {ORIGIN_LABELS[request.origin]}
          </Descriptions.Item>
          {request.basisDocumentNumber && (
            <Descriptions.Item label="Số văn bản căn cứ">
              {request.basisDocumentNumber}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Người tạo">
            {request.createdBy.fullName}
          </Descriptions.Item>
          <Descriptions.Item label="Lần gửi">
            {request.submissionRound === 0
              ? 'Chưa gửi'
              : request.submissionRound}
          </Descriptions.Item>
          <Descriptions.Item label="Cập nhật">
            {formatDateTime(request.updatedAt)}
          </Descriptions.Item>
          <Descriptions.Item label="Lý do" span={2}>
            {request.reason}
          </Descriptions.Item>
        </Descriptions>
      </Card>
      {request.release && <ReleaseCard release={request.release} />}
      <ApprovalHistory
        requestId={requestId}
        submissionRound={request.submissionRound}
      />
      <DocumentsCard request={request} />
      <CommentsCard
        requestId={requestId}
        canComment={request.permissions.canComment}
      />
    </Flex>
  );
}
