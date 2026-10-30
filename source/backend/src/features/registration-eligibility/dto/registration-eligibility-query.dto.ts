import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../../shared/pagination/page-query.dto.js';
import { ELIGIBILITY_LIMITS } from '../../../shared/registration-eligibility/eligibility.constants.js';

export class RegistrationEligibilityQueryDto {
  @ApiProperty() @IsString() @IsNotEmpty() programId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() semesterId!: string;
}
export class EligibilityStudentsQueryDto extends PageQueryDto {
  @ApiProperty() @IsString() @IsNotEmpty() semesterId!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(ELIGIBILITY_LIMITS.SEARCH_MAX)
  q?: string;
}
