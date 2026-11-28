import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import {
  CourseType,
  DegreeLevel,
  MajorStatus,
  ProgramStatus,
  ProgramVersionStatus,
  SubjectGroupStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
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
  @ApiProperty() activeProgramCount!: number;
  @ApiProperty() studentCount!: number;
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

  @ApiPropertyOptional({
    description: 'CD01 (Đại học), CD02 (Thạc sĩ), CD03 (Tiến sĩ)',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(MAJOR_LIMITS.DEGREE_GROUP_MAX)
  degreeGroup?: string;

  @ApiPropertyOptional({
    description: 'true: chỉ ngành đã có CTĐT; false: chưa có CTĐT',
  })
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsOptional()
  @IsBoolean()
  hasPrograms?: boolean;
}

export class CreateMajorDto {
  @ApiProperty({ maxLength: MAJOR_LIMITS.CODE_MAX, example: '7480201' })
  @Transform(trimString)
  @IsString()
  @Length(1, MAJOR_LIMITS.CODE_MAX)
  majorCode!: string;

  @ApiProperty({
    maxLength: MAJOR_LIMITS.NAME_MAX,
    example: 'Công nghệ Thông tin',
  })
  @Transform(trimString)
  @IsString()
  @Length(1, MAJOR_LIMITS.NAME_MAX)
  majorName!: string;

  @ApiPropertyOptional({
    maxLength: MAJOR_LIMITS.NAME_MAX,
    nullable: true,
    type: String,
  })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(MAJOR_LIMITS.NAME_MAX)
  englishName?: string | null;

  @ApiPropertyOptional({
    maxLength: MAJOR_LIMITS.DEGREE_GROUP_MAX,
    nullable: true,
    type: String,
  })
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

  @ApiPropertyOptional({
    maxLength: MAJOR_LIMITS.NAME_MAX,
    nullable: true,
    type: String,
  })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(MAJOR_LIMITS.NAME_MAX)
  englishName?: string | null;

  @ApiPropertyOptional({
    maxLength: MAJOR_LIMITS.DEGREE_GROUP_MAX,
    nullable: true,
    type: String,
  })
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

export interface MajorStats {
  activeProgramCount: number;
  studentCount: number;
}

export function toMajorDto(
  row: MajorRow,
  stats: MajorStats = { activeProgramCount: 0, studentCount: 0 },
): MajorDto {
  return {
    id: row.id,
    majorCode: row.majorCode,
    majorName: row.majorName,
    englishName: row.englishName,
    degreeGroup: row.degreeGroup,
    faculty: row.faculty,
    status: row.status,
    programCount: row._count.programs,
    activeProgramCount: stats.activeProgramCount,
    studentCount: stats.studentCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class MajorOverviewStatsDto {
  @ApiProperty() totalPrograms!: number;
  @ApiProperty() activePrograms!: number;
  @ApiProperty() draftPrograms!: number;
  @ApiProperty() inactivePrograms!: number;
  @ApiProperty() releasedVersions!: number;
  @ApiProperty() totalStudents!: number;
  @ApiProperty() totalCourses!: number;
  @ApiProperty() publishedSyllabi!: number;
  @ApiProperty() totalPlos!: number;
  @ApiProperty() subjectGroupCount!: number;
}

export class MajorOverviewDirectorDto {
  @ApiProperty() id!: string;
  @ApiProperty() userCode!: string;
  @ApiProperty() fullName!: string;
}

export class MajorOverviewProgramDto {
  @ApiProperty() id!: string;
  @ApiProperty() programCode!: string;
  @ApiProperty() programName!: string;
  @ApiProperty({ enum: DegreeLevel, enumName: 'DegreeLevel' })
  degreeLevel!: DegreeLevel;
  @ApiProperty({ enum: ProgramStatus, enumName: 'ProgramStatus' })
  status!: ProgramStatus;
  @ApiProperty({ type: OrgUnitRefDto }) faculty!: OrgUnitRefDto;
  @ApiProperty() hasReleasedVersion!: boolean;
  @ApiProperty({ type: [MajorOverviewDirectorDto] })
  directors!: MajorOverviewDirectorDto[];
  @ApiProperty({ nullable: true, type: String }) latestVersionId!:
    string | null;
  @ApiProperty({ nullable: true, type: String })
  latestVersionNumber!: string | null;
  @ApiProperty({
    enum: ProgramVersionStatus,
    enumName: 'ProgramVersionStatus',
    nullable: true,
  })
  latestVersionStatus!: ProgramVersionStatus | null;
  @ApiProperty({ nullable: true, type: Number }) totalCredits!: number | null;
  @ApiProperty() releasedVersionCount!: number;
  @ApiProperty() trackCount!: number;
  @ApiProperty() ploCount!: number;
  @ApiProperty() courseCount!: number;
  @ApiProperty() studentCount!: number;
  @ApiProperty({ type: [String] }) cohorts!: string[];
}

export class MajorOverviewCourseOwnerGroupDto {
  @ApiProperty() id!: string;
  @ApiProperty() groupCode!: string;
  @ApiProperty() groupName!: string;
}

export class MajorOverviewCourseDto {
  @ApiProperty() id!: string;
  @ApiProperty() courseCode!: string;
  @ApiProperty() courseName!: string;
  @ApiProperty() credits!: number;
  @ApiProperty({ enum: CourseType, enumName: 'CourseType' })
  courseType!: CourseType;
  @ApiProperty() programCount!: number;
  @ApiProperty() hasPublishedSyllabus!: boolean;
  @ApiProperty({ type: MajorOverviewCourseOwnerGroupDto, nullable: true })
  ownerGroup!: MajorOverviewCourseOwnerGroupDto | null;
}

export class MajorOverviewSubjectGroupDto {
  @ApiProperty() id!: string;
  @ApiProperty() groupCode!: string;
  @ApiProperty() groupName!: string;
  @ApiProperty({ enum: SubjectGroupStatus, enumName: 'SubjectGroupStatus' })
  status!: SubjectGroupStatus;
  @ApiProperty() memberCount!: number;
  @ApiProperty() courseCount!: number;
}

export class MajorOverviewCohortBreakdownDto {
  @ApiProperty() programId!: string;
  @ApiProperty() programCode!: string;
  @ApiProperty() programName!: string;
  @ApiProperty() cohortId!: string;
  @ApiProperty() cohortCode!: string;
  @ApiProperty() studentCount!: number;
}

export class MajorOverviewDto {
  @ApiProperty({ type: MajorDto }) major!: MajorDto;
  @ApiProperty({ type: MajorOverviewStatsDto }) stats!: MajorOverviewStatsDto;
  @ApiProperty({ type: [MajorOverviewProgramDto] })
  programs!: MajorOverviewProgramDto[];
  @ApiProperty({ type: [MajorOverviewCourseDto] })
  courses!: MajorOverviewCourseDto[];
  @ApiProperty({ type: [MajorOverviewSubjectGroupDto] })
  subjectGroups!: MajorOverviewSubjectGroupDto[];
  @ApiProperty({ type: [MajorOverviewCohortBreakdownDto] })
  cohortBreakdown!: MajorOverviewCohortBreakdownDto[];
}
