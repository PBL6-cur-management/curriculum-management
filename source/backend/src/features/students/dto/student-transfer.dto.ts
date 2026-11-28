import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { STUDENT_LIMITS } from '../../../shared/students/student.constants.js';

const ID_MAX = 64;
const SEARCH_MAX = 100;
export const BULK_TRANSFER_MAX = 500;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// At least one of studentIds / studentCodes is required; the service enforces it.
export class BulkTransferDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BULK_TRANSFER_MAX)
  @IsString({ each: true })
  @MaxLength(ID_MAX, { each: true })
  studentIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BULK_TRANSFER_MAX)
  @IsString({ each: true })
  @MaxLength(STUDENT_LIMITS.CODE_MAX, { each: true })
  studentCodes?: string[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(ID_MAX)
  targetVersionId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(ID_MAX)
  trackId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(ID_MAX)
  fromSemesterId!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(STUDENT_LIMITS.BASIS_MAX)
  basisDecision!: string;
}

export const BULK_TRANSFER_STATUSES = ['OK', 'FAILED'] as const;

export class BulkTransferResultItemDto {
  @ApiProperty() studentCode!: string;
  @ApiProperty({ enum: BULK_TRANSFER_STATUSES })
  @IsIn(BULK_TRANSFER_STATUSES)
  status!: 'OK' | 'FAILED';
  @ApiPropertyOptional() errorMessage?: string;
  @ApiPropertyOptional() newEnrollmentId?: string;
}

export class BulkTransferResultDto {
  @ApiProperty() total!: number;
  @ApiProperty() succeeded!: number;
  @ApiProperty() failed!: number;
  @ApiProperty({ type: [BulkTransferResultItemDto] })
  results!: BulkTransferResultItemDto[];
}

// trackId null clears the chosen track.
export class SetEnrollmentTrackDto {
  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(ID_MAX)
  trackId!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  expectedEnrollmentUpdatedAt?: string;
}

export class TransferExportQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(ID_MAX)
  cohortId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(ID_MAX)
  programId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(SEARCH_MAX)
  search?: string;
}
