import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { StudentStatus } from '../../../generated/prisma/client.js';
import { PageQueryDto } from '../../../shared/pagination/page-query.dto.js';

const ID_MAX = 64;
const SEARCH_MAX = 100;

export class StudentSemesterQueryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(ID_MAX)
  semesterId!: string;
}

export class StudentContextQueryDto extends StudentSemesterQueryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(ID_MAX)
  programId!: string;
}

// A program director must name the program; the service enforces it because the rule depends on the caller's role.
export class StudentDetailQueryDto extends StudentSemesterQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(ID_MAX)
  programId?: string;
}

// Optional semester: without one the list is not tied to a term (a program filter matches any enrollment in it).
export class StudentOptionalSemesterQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(ID_MAX)
  semesterId?: string;
}

export class StudentListQueryDto extends PageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(ID_MAX)
  semesterId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(SEARCH_MAX)
  q?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(ID_MAX)
  cohortId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(ID_MAX)
  programId?: string;
  @ApiPropertyOptional({ enum: StudentStatus, enumName: 'StudentStatus' })
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;
}

export class StudentResultsQueryDto extends PageQueryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(ID_MAX)
  semesterId!: string;
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(ID_MAX)
  programId!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(ID_MAX)
  resultSemesterId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(ID_MAX)
  courseId?: string;
}
