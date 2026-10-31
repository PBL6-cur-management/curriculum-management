import { Flex, Result, Typography } from 'antd';
import { useState } from 'react';
import { generatePath, Navigate, useParams } from 'react-router';
import { ROUTES } from '../../../routes';
import { RequestStatusTag } from '../../../shared/change-requests/RequestStatusTag';
import { ConflictAlert } from '../components/ConflictAlert';
import { CourseItemsEditor } from '../components/CourseItemsEditor';
import { DocumentsCard } from '../components/DocumentsCard';
import { OrganizationalItemsEditor } from '../components/OrganizationalItemsEditor';
import { RequestDiff } from '../components/RequestDiff';
import { RequestDraftActions } from '../components/RequestDraftActions';
import { RequestHeaderCard } from '../components/RequestHeaderCard';
import { SubmitConfirmModal } from '../components/SubmitConfirmModal';
import { WorkspaceCard } from '../components/WorkspaceCard';
import { useChangeRequest } from '../hooks/useChangeRequests';
import {
  BackLink,
  PageHeader,
  PageSkeleton,
} from '../../../shared/design-system';

// The creator's workbench for one Draft: header, the copy or the items, documents, the diff, and "Gửi duyệt".
export function ChangeRequestEditPage() {
  const { requestId = '' } = useParams();
  const { data: request, isPending, isError } = useChangeRequest(requestId);
  const [confirming, setConfirming] = useState(false);
  if (isPending) return <PageSkeleton />;
  if (isError || !request)
    return <Result status="404" title="Không tìm thấy đề xuất" />;
  if (!request.permissions.canEdit)
    return (
      <Navigate
        to={generatePath(ROUTES.changeRequestDetail, { requestId })}
        replace
      />
    );
  return (
    <Flex vertical gap="middle">
      <BackLink
        to={generatePath(ROUTES.changeRequestDetail, { requestId: request.id })}
        preferHistory
      >
        Quay lại đề xuất
      </BackLink>
      <Flex justify="space-between" align="center" wrap gap="small">
        <Flex gap="small" align="center" wrap>
          <PageHeader
            title={
              <>
                {request.requestCode} — {request.title}
              </>
            }
          />
          <RequestStatusTag status={request.status} />
        </Flex>
        <RequestDraftActions
          request={request}
          onSubmit={() => setConfirming(true)}
        />
      </Flex>
      <ConflictAlert conflicts={request.conflicts} />
      <RequestHeaderCard request={request} />
      {request.workspace && <WorkspaceCard request={request} />}
      {request.requestType === 'COURSE_RELATION' && (
        <CourseItemsEditor request={request} />
      )}
      {request.requestType === 'ORGANIZATION' && (
        <OrganizationalItemsEditor request={request} />
      )}
      <DocumentsCard request={request} />
      <Typography.Title level={4} style={{ margin: 0 }}>
        Thay đổi so với bản đang áp dụng
      </Typography.Title>
      <RequestDiff requestId={requestId} />
      {confirming && (
        <SubmitConfirmModal
          requestId={requestId}
          onClose={() => setConfirming(false)}
        />
      )}
    </Flex>
  );
}
