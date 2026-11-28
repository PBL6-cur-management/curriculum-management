import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CourseStatus, CourseType } from '../../generated/prisma/client.js';
import { toArray, trimString } from '../../shared/dtos/transforms.js';
import { PageQueryDto } from '../../shared/pagination/page-query.dto.js';
import { COURSE_FIELD_LIMITS } from './create-course.dto.js';

export const COURSE_SORT_FIELDS = [
  'courseCode',
  'courseName',
  'credits',
  'createdAt',
  'updatedAt',
] as const;
export type CourseSortField = (typeof COURSE_SORT_FIELDS)[number];
export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export class CourseQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ maxLength: COURSE_FIELD_LIMITS.QUERY_MAX })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(COURSE_FIELD_LIMITS.QUERY_MAX)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerFacultyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerGroupId?: string;

  @ApiPropertyOptional({ enum: CourseType, enumName: 'CourseType' })
  @IsOptional()
  @IsEnum(CourseType)
  courseType?: CourseType;

  @ApiPropertyOptional({
    enum: CourseStatus,
    enumName: 'CourseStatus',
    isArray: true,
  })
  @Transform(toArray)
  @IsOptional()
  @IsEnum(CourseStatus, { each: true })
  status?: CourseStatus[];

  @ApiPropertyOptional({ type: Boolean })
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsOptional()
  @IsBoolean()
  foreign?: boolean;

  @ApiPropertyOptional({ enum: COURSE_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(COURSE_SORT_FIELDS)
  sort: CourseSortField = 'createdAt';

  @ApiPropertyOptional({ enum: SORT_ORDERS, default: 'desc' })
  @IsOptional()
  @IsIn(SORT_ORDERS)
  order: SortOrder = 'desc';
}
