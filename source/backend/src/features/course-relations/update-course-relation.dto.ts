import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, ValidateIf } from 'class-validator';
import {
  SCORE10_MESSAGE,
  SCORE10_PATTERN,
} from '../../shared/decimal/decimal.js';
import { emptyToNull } from '../../shared/dtos/transforms.js';

export class UpdateCourseRelationDto {
  @ApiProperty({ nullable: true, type: String, example: '4.0' })
  @Transform(emptyToNull)
  @ValidateIf((_, value: unknown) => value !== null)
  @IsString()
  @Matches(SCORE10_PATTERN, { message: SCORE10_MESSAGE })
  minScore!: string | null;
}
