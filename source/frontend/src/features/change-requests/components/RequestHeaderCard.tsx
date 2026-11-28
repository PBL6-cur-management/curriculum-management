import { App, Button, Card, Descriptions, Flex, Form, Tag } from 'antd';
import { useState } from 'react';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import { semesterLabel } from '../../../shared/releases/semesters';
import type { ChangeRequestDetail } from '../api/changeRequests';
import {
  ORIGIN_LABELS,
  REQUEST_TYPE_LABELS,
  TARGET_TYPE_LABELS,
} from '../constants/changeRequestLabels';
import { useUpdateChangeRequest } from '../hooks/useChangeRequests';
import type { RequestHeaderValues } from '../schema/requestRules';
import { applyRequestError } from '../utils/requestErrors';
import { RequestHeaderForm } from './RequestHeaderForm';

interface RequestHeaderCardProps {
  request: ChangeRequestDetail;
}

// The header of a Draft, read-only with an "Sửa" toggle; type and target are fixed once the request exists.
export function RequestHeaderCard({ request }: RequestHeaderCardProps) {
  const { message } = App.useApp();
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm<RequestHeaderValues>();
  const update = useUpdateChangeRequest(request.id);
  const targetLabel = `${request.target.code} — ${request.target.name}`;
  const onFinish = (values: RequestHeaderValues) =>
    update.mutate(
      {
        title: values.title,
        reason: values.reason,
        origin: values.origin,
        basisDocumentNumber: values.basisDocumentNumber ?? null,
        effectiveSemesterId: values.effectiveSemesterId ?? null,
        cohortIds: values.cohortIds ?? [],
      },
      {
        onSuccess: () => setEditing(false),
        onError: (error) => {
          if (!applyRequestError(form, error))
            void message.error(errorMessage(error, 'Không lưu được đề xuất.'));
        },
      },
    );
  return (
    <Card
      title="Thông tin đề xuất"
      extra={!editing && <Button onClick={() => setEditing(true)}>Sửa</Button>}
    >
      {editing ? (
        <RequestHeaderForm
          form={form}
          mode="edit"
          types={[request.requestType]}
          initialValues={{
            requestType: request.requestType,
            targetType: request.target.targetType,
            targetId: request.target.id,
            title: request.title,
            reason: request.reason,
            origin: request.origin,
            basisDocumentNumber: request.basisDocumentNumber ?? undefined,
            effectiveSemesterId: request.effectiveSemester?.id ?? undefined,
            cohortIds: request.targetCohorts.map((cohort) => cohort.id),
          }}
          targetLabel={targetLabel}
          onFinish={onFinish}
          onCancel={() => setEditing(false)}
          submitting={update.isPending}
        />
      ) : (
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Loại">
            {REQUEST_TYPE_LABELS[request.requestType]}
          </Descriptions.Item>
          <Descriptions.Item
            label={TARGET_TYPE_LABELS[request.target.targetType]}
          >
            {targetLabel}
          </Descriptions.Item>
          <Descriptions.Item label="Tiêu đề">{request.title}</Descriptions.Item>
          <Descriptions.Item label="Lý do">{request.reason}</Descriptions.Item>
          <Descriptions.Item label="Nguồn">
            {ORIGIN_LABELS[request.origin]}
          </Descriptions.Item>
          {request.basisDocumentNumber && (
            <Descriptions.Item label="Số văn bản">
              {request.basisDocumentNumber}
            </Descriptions.Item>
          )}
          {request.effectiveSemester && (
            <Descriptions.Item label="Học kỳ hiệu lực dự kiến">
              {semesterLabel(request.effectiveSemester)}
            </Descriptions.Item>
          )}
          {request.targetCohorts.length > 0 && (
            <Descriptions.Item label="Các khóa áp dụng dự kiến">
              <Flex gap={4} wrap>
                {request.targetCohorts.map((cohort) => (
                  <Tag key={cohort.id}>{cohort.cohortCode}</Tag>
                ))}
              </Flex>
            </Descriptions.Item>
          )}
        </Descriptions>
      )}
    </Card>
  );
}
