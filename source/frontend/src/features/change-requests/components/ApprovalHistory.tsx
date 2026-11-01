import {
  Collapse,
  Flex,
  Result,
  Skeleton,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import { useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import { DEAD_STEP_LABEL, STEP_COLORS } from '../constants/approvalLabels';
import { useApprovalHistory } from '../hooks/useApprovals';
import { formatDateTime } from '../utils/format';
import { mergeSameApprover } from '../utils/groupByLevel';
import { StepLine } from './StepProgress';

interface ApprovalHistoryProps {
  requestId: string;
  submissionRound: number;
}

// US-069: every round of the request, newest first. Loaded only when opened: the current round is already on the page.
export function ApprovalHistory({
  requestId,
  submissionRound,
}: ApprovalHistoryProps) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = useApprovalHistory(requestId, open);
  if (submissionRound === 0) return null;
  return (
    <Collapse
      onChange={(keys) => setOpen(keys.length > 0)}
      items={[
        {
          key: 'history',
          label: 'Lịch sử phê duyệt',
          children: error ? (
            <Result
              status="error"
              title={errorMessage(error, 'Không tải được lịch sử.')}
              subTitle={error instanceof ApiError ? error.code : undefined}
            />
          ) : isLoading || !data ? (
            <Skeleton active />
          ) : (
            <Timeline
              items={data.rounds.flatMap((round) => [
                {
                  color: 'gray',
                  content: (
                    <Typography.Text strong>
                      Lần gửi {round.submissionRound} —{' '}
                      {formatDateTime(round.submittedAt)}
                    </Typography.Text>
                  ),
                },
                ...mergeSameApprover(round.steps).map(({ step, scopes }) => ({
                  color: STEP_COLORS[step.action],
                  content: (
                    <Flex gap="small" align="start" wrap>
                      <StepLine step={step} scopes={scopes} />
                      {round.submissionRound < submissionRound &&
                        step.action === 'PENDING' && (
                          <Tag>{DEAD_STEP_LABEL}</Tag>
                        )}
                    </Flex>
                  ),
                })),
              ])}
            />
          ),
        },
      ]}
    />
  );
}
