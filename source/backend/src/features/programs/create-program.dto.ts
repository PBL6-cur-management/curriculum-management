import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { DegreeLevel } from '../../generated/prisma/client.js';
import {
  CREDITS_MESSAGE,
  CREDITS_PATTERN,
} from '../../shared/decimal/decimal.js';
import { trimString } from '../../shared/dtos/transforms.js';

export const PROGRAM_LIMITS = {
  CODE_MAX: 20,
  NAME_MAX: 200,
  MAJOR_CODE_MAX: 20,
  SEMESTERS_MIN: 1,
  SEMESTERS_MAX: 12,
  QUERY_MAX: 100,
} as const;

export class CreateProgramDto {
  @ApiProperty({ maxLength: PROGRAM_LIMITS.CODE_MAX })
  @Transform(trimString)
  @IsString()
  @Length(1, PROGRAM_LIMITS.CODE_MAX)
  programCode!: string;

  @ApiPropertyOptional({
    description: 'Khoa quản lý; mặc định là Khoa CNTT.',
  })
  @IsOptional()
  @IsString()
  facultyId?: string;

  @ApiPropertyOptional({
    description: 'Ngành đào tạo (Level 0).',
  })
  @IsOptional()
  @IsString()
  majorId?: string;

  @ApiProperty({ enum: DegreeLevel, enumName: 'DegreeLevel' })
  @IsEnum(DegreeLevel)
  degreeLevel!: DegreeLevel;

  @ApiProperty({ maxLength: PROGRAM_LIMITS.NAME_MAX })
  @Transform(trimString)
  @IsString()
  @Length(1, PROGRAM_LIMITS.NAME_MAX)
  programName!: string;

  @ApiProperty({ maxLength: PROGRAM_LIMITS.MAJOR_CODE_MAX })
  @Transform(trimString)
  @IsString()
  @Length(1, PROGRAM_LIMITS.MAJOR_CODE_MAX)
  majorCode!: string;

  @ApiProperty({ maxLength: PROGRAM_LIMITS.NAME_MAX })
  @Transform(trimString)
  @IsString()
  @Length(1, PROGRAM_LIMITS.NAME_MAX)
  majorName!: string;

  @ApiProperty({
    minimum: PROGRAM_LIMITS.SEMESTERS_MIN,
    maximum: PROGRAM_LIMITS.SEMESTERS_MAX,
  })
  @Type(() => Number)
  @IsInt()
  @Min(PROGRAM_LIMITS.SEMESTERS_MIN)
  @Max(PROGRAM_LIMITS.SEMESTERS_MAX)
  semesterCount!: number;

  @ApiProperty({ example: '130', pattern: CREDITS_PATTERN.source })
  @IsString()
  @Matches(CREDITS_PATTERN, { message: CREDITS_MESSAGE })
  totalCredits!: string;

  @ApiProperty({ example: '122', pattern: CREDITS_PATTERN.source })
  @IsString()
  @Matches(CREDITS_PATTERN, { message: CREDITS_MESSAGE })
  compulsoryCredits!: string;

  @ApiProperty({ example: '8', pattern: CREDITS_PATTERN.source })
  @IsString()
  @Matches(CREDITS_PATTERN, { message: CREDITS_MESSAGE })
  electiveCredits!: string;
}
