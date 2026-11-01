import { Card, Col, Flex, Row, Tag, Tooltip, Typography } from 'antd';
import { groupByLevel, mergeSameApprover } from '../utils/groupByLevel';
import { ScopeCodes } from './ScopeCodes';
import type { ApprovalStep } from '../api/changeRequests';
import { STEP_COLORS, STEP_KIND_LABELS } from '../constants/approvalLabels';
import {
  ACADEMIC_OFFICE_LABEL,
  ACTION_LABELS,
} from '../constants/changeRequestLabels';
import { formatDateTime } from '../utils/format';

interface StepProgressProps {
  steps: readonly ApprovalStep[];
}

interface StepLineProps {
  step: ApprovalStep;
  // Codes of every programme or group this decision stands for; defaults to the row's own.
  scopes?: readonly string[];
}

const NO_APPROVER_LABEL = 'Không có người duyệt';
// One approver line; shared by the current round here and every round of the history.
export function StepLine({ step, scopes }: StepLineProps) {
  const who =
    step.approver?.fullName ??
    (step.approvalLevel === 3 ? ACADEMIC_OFFICE_LABEL : NO_APPROVER_LABEL);
  const own =
    step.forSubjectGroup?.groupCode ?? step.forProgram?.programCode ?? null;
  return (
    <Flex vertical gap={2}>
      <Flex gap="small" align="center" wrap>
        <Typography.Text delete={step.isSkipped}>{who}</Typography.Text>
        <ScopeCodes
          codes={scopes ?? (own ? [own] : [])}
          noun={step.forSubjectGroup ? 'nhóm' : 'CTĐT'}
          parenthesised
        />
        {step.isSkipped ? (
          <Tooltip title={step.skipReason}>
            <Tag>{STEP_KIND_LABELS.SKIPPED}</Tag>
          </Tooltip>
        ) : (
          <Tag color={STEP_COLORS[step.action]}>
            {ACTION_LABELS[step.action]}
          </Tag>
        )}
        {(step.kind === 'OVERRIDE' || step.kind === 'DELEGATED') && (
          <Tag color="purple">{STEP_KIND_LABELS[step.kind]}</Tag>
        )}
        {!step.isSkipped && step.recordedAt && (
          <Typography.Text type="secondary">
            {formatDateTime(step.recordedAt)}
          </Typography.Text>
        )}
      </Flex>
      {step.kind === 'OVERRIDE' && step.performedBy && (
        <Typography.Text type="secondary">
          Người duyệt: {who} · Thực hiện: {step.performedBy.fullName}
        </Typography.Text>
      )}
      {step.kind === 'DELEGATED' && step.performedBy && (
        <Typography.Text type="secondary">
          {step.performedBy.fullName} duyệt thay {who} (ủy quyền)
        </Typography.Text>
      )}
      {step.isSkipped && step.skipReason && (
        <Typography.Text type="secondary">{step.skipReason}</Typography.Text>
      )}
      {step.remark && <Typography.Text>{step.remark}</Typography.Text>}
    </Flex>
  );
}

// One column per level and one line per approver, so two coordinators show two lines (EC-22) while one director
// standing for six programmes shows one line naming the six.
export function StepProgress({ steps }: StepProgressProps) {
  return (
    <Row gutter={[16, 16]}>
      {groupByLevel(steps).map(({ approvalLevel, levelName, rows }) => (
        <Col key={approvalLevel} xs={24} md={8}>
          <Card size="small" title={`Cấp ${approvalLevel} — ${levelName}`}>
            <Flex vertical gap="small">
              {mergeSameApprover(rows).map(({ step, scopes }) => (
                <StepLine key={step.id} step={step} scopes={scopes} />
              ))}
            </Flex>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
