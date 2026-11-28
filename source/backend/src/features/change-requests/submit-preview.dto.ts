import { ApiProperty } from '@nestjs/swagger';
import {
  APPROVAL_LEVEL_NAMES,
  type ApprovalLevel,
} from '../../shared/change-requests/approval.constants.js';
import type { PlannedStep, RoutingPlan } from './routing-planner.js';

export class BlockingIssueDto {
  @ApiProperty({ example: 'STALE_BASE' }) code!: string;
  @ApiProperty() message!: string;
}

export class AffectedProgramDto {
  @ApiProperty() id!: string;
  @ApiProperty() programCode!: string;
  @ApiProperty() programName!: string;
}

export class PreviewApproverDto {
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) scope!: string | null;
  @ApiProperty({ nullable: true, type: String }) skipReason!: string | null;
}

export class PreviewLevelDto {
  @ApiProperty({ enum: [1, 2, 3, 4] }) approvalLevel!: number;
  @ApiProperty() levelName!: string;
  @ApiProperty({ type: [PreviewApproverDto] })
  approvers!: PreviewApproverDto[];
}

export class SubmitPreviewDto {
  @ApiProperty() itemCount!: number;
  @ApiProperty({ type: [AffectedProgramDto] })
  affectedPrograms!: AffectedProgramDto[];
  @ApiProperty({ type: [PreviewLevelDto] }) levels!: PreviewLevelDto[];
  @ApiProperty({ type: [BlockingIssueDto] })
  blockingIssues!: BlockingIssueDto[];
}

const LEVELS: readonly ApprovalLevel[] = [1, 2, 3, 4];

function toApprover(step: PlannedStep, levelName: string): PreviewApproverDto {
  return {
    name: step.approverName ?? levelName,
    scope: step.scopeLabel,
    skipReason: step.skipReason,
  };
}

// Only levels that have rows are listed: an organisational request shows the academic office alone (D16).
export function toSubmitPreviewDto(
  itemCount: number,
  plan: RoutingPlan,
  blockingIssues: BlockingIssueDto[],
): SubmitPreviewDto {
  return {
    itemCount,
    affectedPrograms: plan.affectedPrograms,
    levels: LEVELS.flatMap((approvalLevel) => {
      const levelName = APPROVAL_LEVEL_NAMES[approvalLevel];
      const rows = plan.steps.filter(
        (step) => step.approvalLevel === approvalLevel,
      );
      return rows.length === 0
        ? []
        : [
            {
              approvalLevel,
              levelName,
              approvers: rows.map((row) => toApprover(row, levelName)),
            },
          ];
    }),
    blockingIssues,
  };
}
