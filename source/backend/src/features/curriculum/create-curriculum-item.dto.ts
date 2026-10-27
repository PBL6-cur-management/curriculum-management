import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  GRADE_POINT_MESSAGE,
  GRADE_POINT_PATTERN,
} from '../../shared/decimal/decimal.js';
import { emptyToNull } from '../../shared/dtos/transforms.js';

import { CURRICULUM_LIMITS } from '../../shared/curriculum/curriculum-limits.js';
export { CURRICULUM_LIMITS } from '../../shared/curriculum/curriculum-limits.js';

export class CreateCurriculumItemDto {
  @ApiProperty() @IsString() courseId!: string;

  @ApiProperty({ minimum: CURRICULUM_LIMITS.SEMESTER_MIN })
  @Type(() => Number)
  @IsInt()
  @Min(CURRICULUM_LIMITS.SEMESTER_MIN)
  plannedSemester!: number;

  // Kept exactly as typed (F07-02): matched to a knowledge block when a code exists, never enforced.
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    maxLength: CURRICULUM_LIMITS.BLOCK_SYMBOL_MAX,
  })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(CURRICULUM_LIMITS.BLOCK_SYMBOL_MAX)
  blockSymbol?: string | null;

  @ApiProperty() @IsBoolean() isElective!: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() htDa?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() tqDa?: boolean;

  @ApiPropertyOptional({ nullable: true, type: String, example: '4' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @Matches(GRADE_POINT_PATTERN, { message: GRADE_POINT_MESSAGE })
  minStudiedScore?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: '4' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @Matches(GRADE_POINT_PATTERN, { message: GRADE_POINT_MESSAGE })
  minTransferScore?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    maxLength: CURRICULUM_LIMITS.NOTE_MAX,
  })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(CURRICULUM_LIMITS.NOTE_MAX)
  note?: string | null;
}

// The course of a row never changes: remove the row and add another (D5).
export class UpdateCurriculumItemDto extends PartialType(
  OmitType(CreateCurriculumItemDto, ['courseId'] as const),
) {}
