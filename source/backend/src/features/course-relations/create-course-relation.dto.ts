import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { CourseRelationType } from '../../generated/prisma/client.js';
import {
  SCORE10_MESSAGE,
  SCORE10_PATTERN,
} from '../../shared/decimal/decimal.js';
import { emptyToNull } from '../../shared/dtos/transforms.js';

export class CreateCourseRelationDto {
  @ApiProperty() @IsString() @IsNotEmpty() sourceCourseId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() targetCourseId!: string;

  @ApiProperty({ enum: CourseRelationType, enumName: 'CourseRelationType' })
  @IsEnum(CourseRelationType)
  relationType!: CourseRelationType;

  @ApiPropertyOptional({ nullable: true, type: String, example: '4.0' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @Matches(SCORE10_PATTERN, { message: SCORE10_MESSAGE })
  minScore?: string | null;
}
