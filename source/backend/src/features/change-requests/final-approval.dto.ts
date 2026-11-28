import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { ChangeRequestType } from '../../generated/prisma/client.js';
import { CurriculumWarningDto } from '../../shared/curriculum/curriculum-warning.dto.js';
import { emptyToNull, trimString } from '../../shared/dtos/transforms.js';
import { DECISION_NUMBER_MAX } from '../../shared/releases/release-decision.dto.js';
import { SyllabusReleaseIssueDto } from '../../shared/releases/release-issue.dto.js';
import {
  CohortDto,
  SemesterDto,
} from '../../shared/releases/semester.dto.js';
import { ISO_DAY_LENGTH } from '../../shared/time/today.js';

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

// MH-43: the decision and optional semester/cohorts override (defaults to the CR's proposed values).
export class FinalApproveDto {
  @ApiProperty({ example: 'QĐ-123/ĐHBK' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(DECISION_NUMBER_MAX)
  decisionNumber!: string;

  @ApiProperty({ format: 'date' })
  @IsISO8601({ strict: true })
  @Length(ISO_DAY_LENGTH, ISO_DAY_LENGTH)
  signedDate!: string;

  @ApiPropertyOptional({
    description:
      'Học kỳ hiệu lực (nếu bỏ trống sẽ dùng học kỳ dự kiến của đề xuất).',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  effectiveSemesterId?: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(FINAL_APPROVAL_LIMITS.REMARK_MAX)
  remark?: string | null;

  @ApiPropertyOptional({
    description:
      'Cho phép ban hành vào học kỳ đã bắt đầu khi Phòng Đào tạo xác nhận.',
  })
  @IsOptional()
  @IsBoolean()
  allowPastSemester?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Các khóa tuyển sinh áp dụng (nếu bỏ trống sẽ dùng khóa dự kiến của đề xuất).',
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
    description: 'Có thể gán khóa tuyển sinh khi tạo ít nhất một phiên bản.',
  })
  canAssignCohorts!: boolean;
  @ApiProperty({
    description:
      'Phòng Đào tạo có thể xác nhận ban hành vào học kỳ đã bắt đầu.',
  })
  canAllowPastSemester!: boolean;
  @ApiProperty({ type: SemesterDto, nullable: true })
  effectiveSemester!: SemesterDto | null;
  @ApiProperty({ type: [CohortDto] })
  targetCohorts!: CohortDto[];
}
