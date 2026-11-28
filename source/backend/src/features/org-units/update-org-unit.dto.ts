import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import {
  normalizeUnitName,
  ORG_UNIT_FIELD_LIMITS,
} from './create-org-unit.dto.js';

export class UpdateOrgUnitDto {
  @ApiPropertyOptional({ maxLength: ORG_UNIT_FIELD_LIMITS.NAME_MAX })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeUnitName(value) : value,
  )
  @IsString()
  @Length(1, ORG_UNIT_FIELD_LIMITS.NAME_MAX)
  unitName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isExternal?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentUnitId?: string;
}
