import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { emptyToNull, trimString } from '../../../shared/dtos/transforms.js';
import { ISO_DAY_LENGTH } from '../../../shared/time/today.js';

export const SEMESTER_LIMITS = {
  CODE_MAX: 30,
  YEAR_MAX: 20,
  TERM_MIN: 1,
  TERM_MAX: 4,
} as const;

export class CreateSemesterDto {
  @ApiProperty({ example: '2610' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @Length(1, SEMESTER_LIMITS.CODE_MAX)
  semesterCode!: string;

  @ApiProperty({ example: '2026-2027' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @Length(1, SEMESTER_LIMITS.YEAR_MAX)
  academicYear!: string;

  @ApiProperty({ minimum: SEMESTER_LIMITS.TERM_MIN })
  @Type(() => Number)
  @IsInt()
  @Min(SEMESTER_LIMITS.TERM_MIN)
  @Max(SEMESTER_LIMITS.TERM_MAX)
  termInYear!: number;

  @ApiPropertyOptional({ format: 'date', nullable: true, type: String })
  @Transform(emptyToNull)
  @IsOptional()
  @IsISO8601({ strict: true })
  @Length(ISO_DAY_LENGTH, ISO_DAY_LENGTH)
  startDate?: string | null;
}

export class UpdateSemesterDto extends PartialType(CreateSemesterDto) {}
