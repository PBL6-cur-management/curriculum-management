import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DegreeLevel, ProgramStatus } from '../../generated/prisma/client.js';
import { trimString } from '../../shared/dtos/transforms.js';
import { PageQueryDto } from '../../shared/pagination/page-query.dto.js';
import { PROGRAM_LIMITS } from './create-program.dto.js';

export const PROGRAM_YEAR_MIN = 1900;
export const PROGRAM_YEAR_MAX = 2100;

export class ProgramQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ maxLength: PROGRAM_LIMITS.QUERY_MAX })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(PROGRAM_LIMITS.QUERY_MAX)
  q?: string;

  @ApiPropertyOptional({ enum: DegreeLevel, enumName: 'DegreeLevel' })
  @IsOptional()
  @IsEnum(DegreeLevel)
  degreeLevel?: DegreeLevel;

  @ApiPropertyOptional({ enum: ProgramStatus, enumName: 'ProgramStatus' })
  @IsOptional()
  @IsEnum(ProgramStatus)
  status?: ProgramStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  facultyId?: string;

  @ApiPropertyOptional({ minimum: PROGRAM_YEAR_MIN, maximum: PROGRAM_YEAR_MAX })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(PROGRAM_YEAR_MIN)
  @Max(PROGRAM_YEAR_MAX)
  releaseYear?: number;

  @ApiPropertyOptional({ minimum: PROGRAM_YEAR_MIN, maximum: PROGRAM_YEAR_MAX })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(PROGRAM_YEAR_MIN)
  @Max(PROGRAM_YEAR_MAX)
  intakeYear?: number;
}
