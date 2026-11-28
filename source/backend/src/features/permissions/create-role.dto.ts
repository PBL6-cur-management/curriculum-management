import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export const ROLE_FIELD_LIMITS = {
  CODE_MIN: 2,
  CODE_MAX: 32,
  NAME_MIN: 2,
  NAME_MAX: 100,
  DESCRIPTION_MAX: 500,
} as const;

export const ROLE_CODE_PATTERN = /^[A-Z0-9_]+$/;

export class CreateRoleDto {
  @ApiProperty({
    minLength: ROLE_FIELD_LIMITS.CODE_MIN,
    maxLength: ROLE_FIELD_LIMITS.CODE_MAX,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(ROLE_FIELD_LIMITS.CODE_MIN, ROLE_FIELD_LIMITS.CODE_MAX)
  @Matches(ROLE_CODE_PATTERN)
  roleCode!: string;

  @ApiProperty({
    minLength: ROLE_FIELD_LIMITS.NAME_MIN,
    maxLength: ROLE_FIELD_LIMITS.NAME_MAX,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  @Length(ROLE_FIELD_LIMITS.NAME_MIN, ROLE_FIELD_LIMITS.NAME_MAX)
  roleName!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: ROLE_FIELD_LIMITS.DESCRIPTION_MAX,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString()
  @MaxLength(ROLE_FIELD_LIMITS.DESCRIPTION_MAX)
  description?: string | null;
}
