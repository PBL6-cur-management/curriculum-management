import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { CREATABLE_UNIT_TYPES } from './org-unit-hierarchy.js';

export const ORG_UNIT_FIELD_LIMITS = { CODE_MAX: 32, NAME_MAX: 200 } as const;
export const UNIT_CODE_PATTERN = /^[A-Z0-9_]+$/;
export const LEGACY_UNIT_ABBREVIATION = /^(?:K|P)\.\s*/u;

export function normalizeUnitName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function hasLegacyUnitAbbreviation(value: string): boolean {
  return LEGACY_UNIT_ABBREVIATION.test(value.trim());
}

export class CreateOrgUnitDto {
  @ApiProperty({ maxLength: ORG_UNIT_FIELD_LIMITS.CODE_MAX })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(1, ORG_UNIT_FIELD_LIMITS.CODE_MAX)
  @Matches(UNIT_CODE_PATTERN)
  unitCode!: string;

  @ApiProperty({ maxLength: ORG_UNIT_FIELD_LIMITS.NAME_MAX })
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeUnitName(value) : value,
  )
  @IsString()
  @Length(1, ORG_UNIT_FIELD_LIMITS.NAME_MAX)
  unitName!: string;

  @ApiProperty({ enum: CREATABLE_UNIT_TYPES })
  @IsIn(CREATABLE_UNIT_TYPES)
  unitType!: (typeof CREATABLE_UNIT_TYPES)[number];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isExternal?: boolean;

  @ApiProperty()
  @IsString()
  parentUnitId!: string;
}
