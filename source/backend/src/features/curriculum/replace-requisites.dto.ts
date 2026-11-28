import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { CourseRelationType } from '../../generated/prisma/client.js';
import {
  SCORE10_MESSAGE,
  SCORE10_PATTERN,
} from '../../shared/decimal/decimal.js';
import { emptyToNull } from '../../shared/dtos/transforms.js';
import { CURRICULUM_LIMITS } from './create-curriculum-item.dto.js';

// A curriculum has no replacement edges: they only matter in the catalog.
export const CURRICULUM_REQUISITE_TYPES = [
  CourseRelationType.PRIOR,
  CourseRelationType.PREREQUISITE,
  CourseRelationType.COREQUISITE,
] as const;
export type CurriculumRequisiteType =
  (typeof CURRICULUM_REQUISITE_TYPES)[number];

export class RequisiteInputDto {
  @ApiProperty() @IsString() sourceCourseId!: string;

  @ApiProperty({
    enum: CURRICULUM_REQUISITE_TYPES,
    enumName: 'CurriculumRequisiteType',
  })
  @IsIn(CURRICULUM_REQUISITE_TYPES)
  relationType!: CurriculumRequisiteType;

  @ApiPropertyOptional({ nullable: true, type: String, example: '4' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @Matches(SCORE10_PATTERN, { message: SCORE10_MESSAGE })
  minScore?: string | null;
}

export class ReplaceRequisitesDto {
  @ApiProperty({ type: [RequisiteInputDto] })
  @IsArray()
  @ArrayMaxSize(CURRICULUM_LIMITS.REQUISITES_MAX)
  @ValidateNested({ each: true })
  @Type(() => RequisiteInputDto)
  requisites!: RequisiteInputDto[];
}
