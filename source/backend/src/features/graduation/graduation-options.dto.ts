import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { GRADUATION_LIMITS } from '../../shared/graduation/graduation.constants.js';
import { PageQueryDto } from '../../shared/pagination/page-query.dto.js';

export class GraduationProgramOptionsQueryDto {
  @ApiProperty() @IsString() @IsNotEmpty() semesterId!: string;
}

export class GraduationStudentOptionsQueryDto extends PageQueryDto {
  @ApiProperty() @IsString() @IsNotEmpty() programId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() semesterId!: string;
  @ApiPropertyOptional({ maxLength: GRADUATION_LIMITS.SEARCH_MAX })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(GRADUATION_LIMITS.SEARCH_MAX)
  q?: string;
}

export class GraduationProgramOptionDto {
  @ApiProperty() id!: string;
  @ApiProperty() programCode!: string;
  @ApiProperty() programName!: string;
}

export class GraduationStudentOptionDto {
  @ApiProperty() id!: string;
  @ApiProperty() studentCode!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ type: String, nullable: true }) enrollmentId!: string | null;
  @ApiProperty() cohortId!: string;
  @ApiProperty() cohortCode!: string;
}

export class GraduationStudentOptionPageDto {
  @ApiProperty({ type: [GraduationStudentOptionDto] })
  items!: GraduationStudentOptionDto[];
  @ApiProperty({ type: Number }) total!: number;
  @ApiProperty({ type: Number }) page!: number;
  @ApiProperty({ type: Number }) pageSize!: number;
}
