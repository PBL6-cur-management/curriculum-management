import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Validate,
  ValidatorConstraint,
} from 'class-validator';
import type {
  ValidationArguments,
  ValidatorConstraintInterface,
} from 'class-validator';
import { GRADUATION_LIMITS } from '../../shared/graduation/graduation.constants.js';
import type { GraduationConclusion } from '../../shared/graduation/graduation.types.js';
import { PageQueryDto } from '../../shared/pagination/page-query.dto.js';

@ValidatorConstraint({ name: 'graduationRosterFilter', async: false })
class GraduationRosterFilterConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const filters = args.object as GraduationBatchFilterDto;
    return (
      (typeof filters.programId === 'string' && filters.programId.length > 0) ||
      (typeof filters.cohortId === 'string' && filters.cohortId.length > 0)
    );
  }

  defaultMessage(): string {
    return 'Chọn ít nhất một chương trình hoặc khóa tuyển sinh để xét tốt nghiệp.';
  }
}

@ValidatorConstraint({ name: 'graduationItemConclusion', async: false })
class GraduationItemConclusionConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const query = args.object as GraduationBatchItemQueryDto;
    return (
      query.outcome === undefined ||
      query.outcome === null ||
      query.outcome === 'REVIEWED'
    );
  }

  defaultMessage(): string {
    return 'Chỉ lọc kết luận học tập cho kết quả đã xét; bỏ kết luận hoặc chọn trạng thái REVIEWED.';
  }
}

export class GraduationBatchFilterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Validate(GraduationRosterFilterConstraint)
  semesterId!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  programId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cohortId?: string;
}

export class GraduationBatchCreateDto extends GraduationBatchFilterDto {
  @ApiProperty({
    minLength: GRADUATION_LIMITS.REVISION_LENGTH,
    maxLength: GRADUATION_LIMITS.REVISION_LENGTH,
  })
  @IsString()
  @Length(GRADUATION_LIMITS.REVISION_LENGTH, GRADUATION_LIMITS.REVISION_LENGTH)
  previewRevision!: string;
  @ApiProperty({ maxLength: GRADUATION_LIMITS.REQUEST_KEY_MAX })
  @IsString()
  @IsNotEmpty()
  @MaxLength(GRADUATION_LIMITS.REQUEST_KEY_MAX)
  requestKey!: string;
}

export class GraduationBatchItemQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ['ELIGIBLE', 'NOT_ELIGIBLE'] })
  @IsOptional()
  @IsIn(['ELIGIBLE', 'NOT_ELIGIBLE'])
  @Validate(GraduationItemConclusionConstraint)
  conclusion?: GraduationConclusion;
  @ApiPropertyOptional({ enum: ['PENDING', 'REVIEWED', 'ERROR'] })
  @IsOptional()
  @IsIn(['PENDING', 'REVIEWED', 'ERROR'])
  outcome?: 'PENDING' | 'REVIEWED' | 'ERROR';
  @ApiPropertyOptional({ maxLength: GRADUATION_LIMITS.SEARCH_MAX })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(GRADUATION_LIMITS.SEARCH_MAX)
  q?: string;
}

export class GraduationBatchExportQueryDto extends PickType(
  GraduationBatchItemQueryDto,
  ['conclusion', 'outcome', 'q'] as const,
) {}

export interface GraduationBatchPreviewValue {
  filters: {
    semesterId: string;
    programId: string | null;
    cohortId: string | null;
  };
  studentCount: number;
  enrollmentCount: number;
  previewRevision: string;
}

export interface GraduationBatchValue extends GraduationBatchPreviewValue {
  id: string;
  requestedById: string;
  status:
    'QUEUED' | 'RUNNING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED';
  processedCount: number;
  eligibleCount: number;
  notEligibleCount: number;
  errorCount: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  failure: { code: string; message: string } | null;
}

export interface GraduationBatchItemValue {
  id: string;
  studentId: string;
  studentCode: string;
  fullName: string;
  programId: string;
  programCode: string;
  programName: string;
  semesterId: string;
  enrollmentId: string | null;
  status: 'PENDING' | 'REVIEWED' | 'ERROR';
  auditId: string | null;
  conclusion: GraduationConclusion | null;
  shortfallCount: number | null;
  error: { code: string; message: string } | null;
  finishedAt: string | null;
}

export class GraduationBatchFiltersDto {
  @ApiProperty() semesterId!: string;
  @ApiProperty({ type: String, nullable: true }) programId!: string | null;
  @ApiProperty({ type: String, nullable: true }) cohortId!: string | null;
}

export class GraduationBatchFailureDto {
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
}

export class GraduationBatchPreviewDto implements GraduationBatchPreviewValue {
  @ApiProperty({ type: GraduationBatchFiltersDto })
  filters!: GraduationBatchFiltersDto;
  @ApiProperty({ type: Number }) studentCount!: number;
  @ApiProperty({ type: Number }) enrollmentCount!: number;
  @ApiProperty({
    minLength: GRADUATION_LIMITS.REVISION_LENGTH,
    maxLength: GRADUATION_LIMITS.REVISION_LENGTH,
  })
  previewRevision!: string;
}

export class GraduationBatchDto
  extends GraduationBatchPreviewDto
  implements GraduationBatchValue
{
  @ApiProperty() id!: string;
  @ApiProperty() requestedById!: string;
  @ApiProperty({
    enum: ['QUEUED', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED'],
  })
  status!: GraduationBatchValue['status'];
  @ApiProperty({ type: Number }) processedCount!: number;
  @ApiProperty({ type: Number }) eligibleCount!: number;
  @ApiProperty({ type: Number }) notEligibleCount!: number;
  @ApiProperty({ type: Number }) errorCount!: number;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  startedAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  finishedAt!: string | null;
  @ApiProperty({ type: GraduationBatchFailureDto, nullable: true })
  failure!: GraduationBatchFailureDto | null;
}

export class GraduationBatchItemDto implements GraduationBatchItemValue {
  @ApiProperty() id!: string;
  @ApiProperty() studentId!: string;
  @ApiProperty() studentCode!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() programId!: string;
  @ApiProperty() programCode!: string;
  @ApiProperty() programName!: string;
  @ApiProperty() semesterId!: string;
  @ApiProperty({ type: String, nullable: true }) enrollmentId!: string | null;
  @ApiProperty({ enum: ['PENDING', 'REVIEWED', 'ERROR'] })
  status!: GraduationBatchItemValue['status'];
  @ApiProperty({ type: String, nullable: true }) auditId!: string | null;
  @ApiProperty({ enum: ['ELIGIBLE', 'NOT_ELIGIBLE'], nullable: true })
  conclusion!: GraduationConclusion | null;
  @ApiProperty({ type: Number, nullable: true }) shortfallCount!: number | null;
  @ApiProperty({ type: GraduationBatchFailureDto, nullable: true })
  error!: GraduationBatchFailureDto | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  finishedAt!: string | null;
}

export class GraduationBatchPageDto {
  @ApiProperty({ type: [GraduationBatchDto] }) items!: GraduationBatchDto[];
  @ApiProperty({ type: Number }) total!: number;
  @ApiProperty({ type: Number }) page!: number;
  @ApiProperty({ type: Number }) pageSize!: number;
}

export class GraduationBatchItemPageDto {
  @ApiProperty({ type: [GraduationBatchItemDto] })
  items!: GraduationBatchItemDto[];
  @ApiProperty({ type: Number }) total!: number;
  @ApiProperty({ type: Number }) page!: number;
  @ApiProperty({ type: Number }) pageSize!: number;
}
