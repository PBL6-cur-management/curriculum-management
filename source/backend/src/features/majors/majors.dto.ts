import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { MajorStatus, type Prisma } from '../../generated/prisma/client.js';
import {
  ORG_UNIT_REF_SELECT,
  OrgUnitRefDto,
} from '../../shared/dtos/ref.dto.js';
import { emptyToNull, trimString } from '../../shared/dtos/transforms.js';
import { PageQueryDto } from '../../shared/pagination/page-query.dto.js';

export const MAJOR_LIMITS = {
  CODE_MAX: 20,
  NAME_MAX: 200,
  DEGREE_GROUP_MAX: 20,
  QUERY_MAX: 100,
} as const;

export class MajorRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() majorCode!: string;
  @ApiProperty() majorName!: string;
  @ApiProperty({ nullable: true, type: String }) degreeGroup!: string | null;
}

export class MajorDto extends MajorRefDto {
  @ApiProperty({ nullable: true, type: String }) englishName!: string | null;
  @ApiProperty({ type: OrgUnitRefDto, nullable: true })
  faculty!: OrgUnitRefDto | null;
  @ApiProperty({ enum: MajorStatus, enumName: 'MajorStatus' })
  status!: MajorStatus;
  @ApiProperty() programCount!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class MajorPageDto {
  @ApiProperty({ type: [MajorDto] }) items!: MajorDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class MajorQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ maxLength: MAJOR_LIMITS.QUERY_MAX })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(MAJOR_LIMITS.QUERY_MAX)
  q?: string;

  @ApiPropertyOptional({ enum: MajorStatus, enumName: 'MajorStatus' })
  @IsOptional()
  @IsEnum(MajorStatus)
  status?: MajorStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  facultyId?: string;

  @ApiPropertyOptional({ description: 'CD01 (Đại học), CD02 (Thạc sĩ), CD03 (Tiến sĩ)' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(MAJOR_LIMITS.DEGREE_GROUP_MAX)
  degreeGroup?: string;
}

export class CreateMajorDto {
  @ApiProperty({ maxLength: MAJOR_LIMITS.CODE_MAX, example: '7480201' })
  @Transform(trimString)
  @IsString()
  @Length(1, MAJOR_LIMITS.CODE_MAX)
  majorCode!: string;

  @ApiProperty({ maxLength: MAJOR_LIMITS.NAME_MAX, example: 'Công nghệ Thông tin' })
  @Transform(trimString)
  @IsString()
  @Length(1, MAJOR_LIMITS.NAME_MAX)
  majorName!: string;

  @ApiPropertyOptional({ maxLength: MAJOR_LIMITS.NAME_MAX, nullable: true, type: String })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(MAJOR_LIMITS.NAME_MAX)
  englishName?: string | null;

  @ApiPropertyOptional({ maxLength: MAJOR_LIMITS.DEGREE_GROUP_MAX, nullable: true, type: String })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(MAJOR_LIMITS.DEGREE_GROUP_MAX)
  degreeGroup?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  facultyId?: string | null;
}

export class UpdateMajorDto {
  @ApiPropertyOptional({ maxLength: MAJOR_LIMITS.NAME_MAX })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @Length(1, MAJOR_LIMITS.NAME_MAX)
  majorName?: string;

  @ApiPropertyOptional({ maxLength: MAJOR_LIMITS.NAME_MAX, nullable: true, type: String })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(MAJOR_LIMITS.NAME_MAX)
  englishName?: string | null;

  @ApiPropertyOptional({ maxLength: MAJOR_LIMITS.DEGREE_GROUP_MAX, nullable: true, type: String })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(MAJOR_LIMITS.DEGREE_GROUP_MAX)
  degreeGroup?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  facultyId?: string | null;
}

export class SetMajorStatusDto {
  @ApiProperty({ enum: MajorStatus, enumName: 'MajorStatus' })
  @IsEnum(MajorStatus)
  status!: MajorStatus;
}

export const MAJOR_INCLUDE = {
  faculty: { select: ORG_UNIT_REF_SELECT },
  _count: { select: { programs: true } },
} as const satisfies Prisma.MajorInclude;

export type MajorRow = Prisma.MajorGetPayload<{
  include: typeof MAJOR_INCLUDE;
}>;

export function toMajorDto(row: MajorRow): MajorDto {
  return {
    id: row.id,
    majorCode: row.majorCode,
    majorName: row.majorName,
    englishName: row.englishName,
    degreeGroup: row.degreeGroup,
    faculty: row.faculty,
    status: row.status,
    programCount: row._count.programs,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
