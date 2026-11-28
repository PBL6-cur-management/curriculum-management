import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { ROLE_FIELD_LIMITS } from './create-role.dto.js';

export class UpdateRoleDto {
  @ApiPropertyOptional({
    minLength: ROLE_FIELD_LIMITS.NAME_MIN,
    maxLength: ROLE_FIELD_LIMITS.NAME_MAX,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  @Length(ROLE_FIELD_LIMITS.NAME_MIN, ROLE_FIELD_LIMITS.NAME_MAX)
  roleName?: string;

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
