import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ChangeRequestType } from '../../generated/prisma/client.js';
import { CurriculumWarningDto } from '../../shared/curriculum/curriculum-warning.dto.js';
import { emptyToNull } from '../../shared/dtos/transforms.js';
import { ReleaseDecisionDto } from '../../shared/releases/release-decision.dto.js';
import { SyllabusReleaseIssueDto } from '../../shared/releases/release-issue.dto.js';

export const FINAL_APPROVAL_LIMITS = {
  REMARK_MAX: 2000,
  COHORTS_MAX: 50,
} as const;

export const FINAL_APPROVAL_KINDS = [
  'PROGRAM_VERSION',
  'SYLLABUS',
  'AUTHORED',
] as const;
export type FinalApprovalKind = (typeof FINAL_APPROVAL_KINDS)[number];

// MH-43: the decision and the semester, plus what the academic office may add.
export class FinalApproveDto extends ReleaseDecisionDto {
  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(FINAL_APPROVAL_LIMITS.REMARK_MAX)
  remark?: string | null;

  @ApiPropertyOptional({
    description:
      'Cho phép ban hành vào học kỳ đã bắt đầu; chỉ hiệu lực với đề xuất do Phòng Đào tạo tạo.',
  })
  @IsOptional()
  @IsBoolean()
  allowPastSemester?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'Chỉ khi đề xuất tạo đúng một phiên bản.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(FINAL_APPROVAL_LIMITS.COHORTS_MAX)
  @IsString({ each: true })
  cohortIds?: string[];
}

export class FinalApprovalProgramDto {
  @ApiProperty() programId!: string;
  @ApiProperty() programCode!: string;
  @ApiProperty() baseVersionId!: string;
  @ApiProperty({ nullable: true, type: String })
  baseVersionNumber!: string | null;
  @ApiProperty() nextVersionNumber!: string;
  @ApiProperty({ type: [CurriculumWarningDto] })
  consistencyIssues!: CurriculumWarningDto[];
  @ApiProperty({ type: [SyllabusReleaseIssueDto] })
  syllabusIssues!: SyllabusReleaseIssueDto[];
  @ApiProperty({
    description:
      'Liên kết CLO–PLO sẽ mất vì bản đề cương mới không còn mã CLO đó.',
  })
  droppedCloLinks!: number;
}

export class FinalApprovalPreviewDto {
  @ApiProperty() requestId!: string;
  @ApiProperty() requestCode!: string;
  @ApiProperty({ enum: ChangeRequestType, enumName: 'ChangeRequestType' })
  requestType!: ChangeRequestType;
  @ApiProperty({ enum: FINAL_APPROVAL_KINDS, enumName: 'FinalApprovalKind' })
  kind!: FinalApprovalKind;
  @ApiProperty({ description: 'Dữ liệu gốc đã đổi; phải làm lại bản nháp.' })
  stale!: boolean;
  @ApiProperty({ type: [FinalApprovalProgramDto] })
  affectedPrograms!: FinalApprovalProgramDto[];
  @ApiProperty({
    type: [String],
    description: 'Điều kiện chưa đạt của chính bản đề cương được đề xuất.',
  })
  copyIssues!: string[];
  @ApiProperty({
    type: [String],
    description: 'Nhãn các thay đổi tác giả soạn.',
  })
  authoredLabels!: string[];
  @ApiProperty({
    description: 'Gán khóa tuyển sinh được khi tạo đúng một phiên bản.',
  })
  canAssignCohorts!: boolean;
  @ApiProperty({
    description:
      'Người tạo đề xuất là Phòng Đào tạo nên được nạp học kỳ đã qua.',
  })
  canAllowPastSemester!: boolean;
}
