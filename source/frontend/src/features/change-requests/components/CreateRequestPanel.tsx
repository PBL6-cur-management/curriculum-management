import { App, Flex, Form } from 'antd';
import { generatePath, useNavigate } from 'react-router';
import { ROUTES } from '../../../routes';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import type { ChangeRequestType } from '../api/changeRequests';
import {
  useConflicts,
  useCreateChangeRequest,
} from '../hooks/useChangeRequests';
import type { RequestHeaderValues } from '../schema/requestRules';
import { applyRequestError } from '../utils/requestErrors';
import { ConflictAlert } from './ConflictAlert';
import { RequestHeaderForm } from './RequestHeaderForm';

interface CreateRequestPanelProps {
  types: readonly ChangeRequestType[];
  defaults: Partial<RequestHeaderValues>;
}

// The create form of MH-39 / MH-40: header fields, the conflict warning (BR-30) and the move to the workbench.
export function CreateRequestPanel({
  types,
  defaults,
}: CreateRequestPanelProps) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm<RequestHeaderValues>();
  const create = useCreateChangeRequest();
  const targetType = Form.useWatch('targetType', form);
  const targetId = Form.useWatch('targetId', form);
  const conflicts = useConflicts(targetType, targetId || undefined);
  const onFinish = (values: RequestHeaderValues) =>
    create.mutate(
      {
        requestType: values.requestType,
        targetType: values.targetType,
        targetId: values.targetId,
        title: values.title,
        reason: values.reason,
        origin: values.origin,
        basisDocumentNumber: values.basisDocumentNumber?.trim() || null,
        effectiveSemesterId: values.effectiveSemesterId ?? null,
        cohortIds: values.cohortIds ?? [],
      },
      {
        onSuccess: (detail) =>
          void navigate(
            generatePath(ROUTES.changeRequestEdit, { requestId: detail.id }),
          ),
        onError: (error) => {
          if (!applyRequestError(form, error))
            void message.error(errorMessage(error, 'Không tạo được đề xuất.'));
        },
      },
    );
  return (
    <Flex vertical gap="middle">
      <ConflictAlert conflicts={conflicts.data ?? []} />
      <RequestHeaderForm
        form={form}
        mode="create"
        types={types}
        initialValues={defaults}
        onFinish={onFinish}
        submitting={create.isPending}
      />
    </Flex>
  );
}
