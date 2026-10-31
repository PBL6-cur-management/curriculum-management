import { ApiProperty } from '@nestjs/swagger';
import {
  AttachmentFileType,
  ChangeDocumentType,
  ChangeRequestStatus,
  ChangeRequestType,
  ChangeTargetType,
  ProgramVersionStatus,
  RequestOrigin,
  ApprovalAction,
} from '../../generated/prisma/client.js';
import {
  APPROVAL_STEP_KINDS,
  type ApprovalStepKind,
} from '../../shared/change-requests/approval.constants.js';
import { UserRefDto } from '../../shared/dtos/ref.dto.js';
import { SemesterDto } from '../../shared/releases/semester.dto.js';

export const WORKSPACE_KINDS = ['PROGRAM_VERSION', 'SYLLABUS'] as const;
export const AUTHORED_ENTITY_TYPES = [
  'COURSE_FIELD',
  'COURSE_RELATION',
  'ORG_MEMBERSHIP',
  'ORG_DIRECTOR',
] as const;

export class RequestTargetDto {
  @ApiProperty({ enum: ChangeTargetType, enumName: 'ChangeTargetType' })
  targetType!: ChangeTargetType;
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
}

export class ChangeRequestSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() requestCode!: string;
  @ApiProperty({ enum: ChangeRequestType, enumName: 'ChangeRequestType' })
  requestType!: ChangeRequestType;
  @ApiProperty({ type: RequestTargetDto }) target!: RequestTargetDto;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: ChangeRequestStatus, enumName: 'ChangeRequestStatus' })
  status!: ChangeRequestStatus;
  @ApiProperty({ enum: RequestOrigin, enumName: 'RequestOrigin' })
  origin!: RequestOrigin;
  @ApiProperty({ description: '0 = never submitted' }) submissionRound!: number;
  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'When the request entered its current level; null outside PENDING_*',
  })
  levelEnteredAt!: string | null;
  @ApiProperty({ nullable: true, type: Number }) daysWaiting!: number | null;
  @ApiProperty({ type: UserRefDto }) createdBy!: UserRefDto;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class ChangeRequestPageDto {
  @ApiProperty({ type: [ChangeRequestSummaryDto] })
  items!: ChangeRequestSummaryDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class RequestWorkspaceDto {
  @ApiProperty({ enum: WORKSPACE_KINDS, enumName: 'WorkspaceKind' })
  kind!: (typeof WORKSPACE_KINDS)[number];
  @ApiProperty({ description: 'Version id or syllabus id of the copy' })
  copyId!: string;
  @ApiProperty({ nullable: true, type: String }) programId!: string | null;
  @ApiProperty({ nullable: true, type: String }) courseId!: string | null;
  @ApiProperty({ example: 'Phiên bản 2.1' }) baseLabel!: string;
  @ApiProperty() isStale!: boolean;
}

export class AuthoredItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: AUTHORED_ENTITY_TYPES, enumName: 'AuthoredEntityType' })
  entityType!: string;
  @ApiProperty() itemKey!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ nullable: true, type: Object }) oldValue!: unknown;
  @ApiProperty({ nullable: true, type: Object }) newValue!: unknown;
}

export class ChangeRequestDocumentDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ChangeDocumentType, enumName: 'ChangeDocumentType' })
  documentType!: ChangeDocumentType;
  @ApiProperty() fileName!: string;
  @ApiProperty({ enum: AttachmentFileType, enumName: 'AttachmentFileType' })
  fileType!: AttachmentFileType;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty({ type: UserRefDto }) uploadedBy!: UserRefDto;
  @ApiProperty() createdAt!: string;
  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Null = no approver has seen it yet',
  })
  seenInRound!: number | null;
  @ApiProperty() canRemove!: boolean;
}

export class StepGroupRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() groupCode!: string;
  @ApiProperty() groupName!: string;
}

export class StepProgramRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() programCode!: string;
}

export class StepDelegationRefDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: UserRefDto }) delegator!: UserRefDto;
}

export class ApprovalStepDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: [1, 2, 3] }) approvalLevel!: number;
  @ApiProperty() levelName!: string;
  @ApiProperty({ type: UserRefDto, nullable: true })
  approver!: UserRefDto | null;
  @ApiProperty({ type: StepGroupRefDto, nullable: true })
  forSubjectGroup!: StepGroupRefDto | null;
  @ApiProperty({ type: StepProgramRefDto, nullable: true })
  forProgram!: StepProgramRefDto | null;
  @ApiProperty({ enum: ApprovalAction, enumName: 'ApprovalAction' })
  action!: ApprovalAction;
  @ApiProperty() isSkipped!: boolean;
  @ApiProperty({ nullable: true, type: String }) skipReason!: string | null;
  @ApiProperty({ nullable: true, type: String }) remark!: string | null;
  @ApiProperty({ nullable: true, type: String }) recordedAt!: string | null;
  @ApiProperty({
    type: UserRefDto,
    nullable: true,
    description: 'Who acted; differs from approver on an override',
  })
  performedBy!: UserRefDto | null;
  @ApiProperty() isOverride!: boolean;
  @ApiProperty({ enum: APPROVAL_STEP_KINDS, enumName: 'ApprovalStepKind' })
  kind!: ApprovalStepKind;
  @ApiProperty({
    type: StepDelegationRefDto,
    nullable: true,
    description:
      'F-25: the grant a delegate decided this row under; kept after it expires or is revoked',
  })
  delegation!: StepDelegationRefDto | null;
}

export class ConflictDto {
  @ApiProperty() id!: string;
  @ApiProperty() requestCode!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: ChangeRequestStatus, enumName: 'ChangeRequestStatus' })
  status!: ChangeRequestStatus;
  @ApiProperty({ type: UserRefDto }) createdBy!: UserRefDto;
}

export class RequestActionsDto {
  @ApiProperty() canEdit!: boolean;
  @ApiProperty() canDelete!: boolean;
  @ApiProperty() canSubmit!: boolean;
  @ApiProperty() canWithdraw!: boolean;
  @ApiProperty() canUpload!: boolean;
  @ApiProperty() canApprove!: boolean;
  @ApiProperty({
    description:
      'Đề xuất dữ liệu đang chờ Phòng Đào tạo và người xem được phép phê duyệt cuối (MH-43).',
  })
  canFinalApprove!: boolean;
  @ApiProperty() canReturn!: boolean;
  @ApiProperty() canReject!: boolean;
  @ApiProperty() canOverride!: boolean;
  @ApiProperty() canComment!: boolean;
}

export class ReleasedVersionDto {
  @ApiProperty() id!: string;
  @ApiProperty() programId!: string;
  @ApiProperty() programCode!: string;
  @ApiProperty({ nullable: true, type: String }) versionNumber!: string | null;
  @ApiProperty({ enum: ProgramVersionStatus, enumName: 'ProgramVersionStatus' })
  status!: ProgramVersionStatus;
}

// What the final approval decided and what it produced (F-15).
export class RequestReleaseDto {
  @ApiProperty() decisionNumber!: string;
  @ApiProperty({ format: 'date' }) signedDate!: string;
  @ApiProperty({ type: SemesterDto, nullable: true })
  effectiveSemester!: SemesterDto | null;
  @ApiProperty() pastSemesterAllowed!: boolean;
  @ApiProperty({ type: [ReleasedVersionDto] }) versions!: ReleasedVersionDto[];
}

export class ChangeRequestDetailDto extends ChangeRequestSummaryDto {
  @ApiProperty() reason!: string;
  @ApiProperty({ nullable: true, type: String })
  basisDocumentNumber!: string | null;
  @ApiProperty({ type: RequestWorkspaceDto, nullable: true })
  workspace!: RequestWorkspaceDto | null;
  @ApiProperty({ type: [AuthoredItemDto] }) authoredItems!: AuthoredItemDto[];
  @ApiProperty({ type: [ChangeRequestDocumentDto] })
  documents!: ChangeRequestDocumentDto[];
  @ApiProperty({
    type: [ApprovalStepDto],
    description: 'Current round only; empty before the first submit',
  })
  steps!: ApprovalStepDto[];
  @ApiProperty({ type: [ConflictDto] }) conflicts!: ConflictDto[];
  @ApiProperty({ type: RequestActionsDto }) permissions!: RequestActionsDto;
  @ApiProperty({ type: RequestReleaseDto, nullable: true })
  release!: RequestReleaseDto | null;
}
