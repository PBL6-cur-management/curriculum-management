import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { CourseType } from '../../generated/prisma/client.js';
import {
  CREDITS_MESSAGE,
  CREDITS_PATTERN,
} from '../../shared/decimal/decimal.js';
import {
  emptyToNull,
  trimString,
  trimUpperCase,
} from '../../shared/dtos/transforms.js';

import { COURSE_FIELD_LIMITS } from '../../shared/courses/course-field-limits.js';
export { COURSE_FIELD_LIMITS } from '../../shared/courses/course-field-limits.js';

export class CreateCourseDto {
  @ApiProperty({ maxLength: COURSE_FIELD_LIMITS.CODE_MAX })
  @Transform(trimUpperCase)
  @IsString()
  @Length(1, COURSE_FIELD_LIMITS.CODE_MAX)
  courseCode!: string;

  @ApiProperty({ maxLength: COURSE_FIELD_LIMITS.NAME_MAX })
  @Transform(trimString)
  @IsString()
  @Length(1, COURSE_FIELD_LIMITS.NAME_MAX)
  courseName!: string;

  @ApiPropertyOptional({
    maxLength: COURSE_FIELD_LIMITS.NAME_MAX,
    nullable: true,
    type: String,
  })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(COURSE_FIELD_LIMITS.NAME_MAX)
  englishName?: string | null;

  @ApiProperty({ example: '2.5', pattern: CREDITS_PATTERN.source })
  @IsString()
  @Matches(CREDITS_PATTERN, { message: CREDITS_MESSAGE })
  credits!: string;

  @ApiProperty({ enum: CourseType, enumName: 'CourseType' })
  @IsEnum(CourseType)
  courseType!: CourseType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ownerFacultyId!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  ownerGroupId?: string | null;
}
