import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  CourseRelationType,
  CourseStatus,
  CourseType,
} from '../../../generated/prisma/client.js';
import { trimString } from '../../../shared/dtos/transforms.js';
import { INTEGRATION } from '../../../shared/integration-access/integration.constants.js';
import { PageQueryDto } from '../../../shared/pagination/page-query.dto.js';

export class DdutMetaDto {
  @ApiProperty({ enum: ['v1'] }) apiVersion!: 'v1';
  @ApiProperty({ format: 'date-time' }) evaluatedAt!: string;
}

export class DdutCourseRefDto {
  @ApiProperty() courseCode!: string;
  @ApiProperty() courseName!: string;
}

export class DdutCourseCatalogQueryDto extends PageQueryDto {
  @ApiPropertyOptional({
    description: 'Từ khóa tìm theo mã hoặc tên học phần.',
    maxLength: INTEGRATION.CODE_MAX,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(INTEGRATION.CODE_MAX)
  search?: string;

  @ApiPropertyOptional({ enum: CourseStatus, enumName: 'CourseStatus' })
  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;

  @ApiPropertyOptional({
    description: 'Mã đơn vị/khoa quản lý học phần (unitCode).',
    maxLength: INTEGRATION.CODE_MAX,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(INTEGRATION.CODE_MAX)
  facultyCode?: string;
}

export class DdutCourseCatalogItemDto {
  @ApiProperty() courseCode!: string;
  @ApiProperty() courseName!: string;
  @ApiProperty({ type: String, nullable: true }) englishName!: string | null;
  @ApiProperty() credits!: string;
  @ApiProperty({ enum: CourseType, enumName: 'CourseType' })
  courseType!: CourseType;
  @ApiProperty({ enum: CourseStatus, enumName: 'CourseStatus' })
  status!: CourseStatus;
  @ApiProperty() ownerFacultyCode!: string;
  @ApiProperty() ownerFacultyName!: string;
  @ApiProperty({ type: String, nullable: true }) ownerGroupCode!: string | null;
  @ApiProperty({ type: String, nullable: true }) ownerGroupName!: string | null;
  @ApiProperty({ type: Number, nullable: true }) latestSyllabusRevision!:
    number | null;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class DdutCourseCatalogPageDto {
  @ApiProperty({ type: DdutMetaDto }) meta!: DdutMetaDto;
  @ApiProperty({ type: [DdutCourseCatalogItemDto] })
  items!: DdutCourseCatalogItemDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class DdutCourseCloDto {
  @ApiProperty() cloCode!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: String, nullable: true }) englishDescription!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) cognitiveLevel!: string | null;
}

export class DdutGradingComponentDto {
  @ApiProperty() componentCode!: string;
  @ApiProperty() componentName!: string;
  @ApiProperty() weight!: string;
  @ApiProperty({ type: String, nullable: true }) assessmentForm!: string | null;
  @ApiProperty() isConditional!: boolean;
  @ApiProperty({ type: String, nullable: true }) conditionThreshold!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) failingScore!: string | null;
  @ApiProperty({ type: [String] }) cloCodes!: string[];
}

export class DdutPublishedSyllabusSummaryDto {
  @ApiProperty() revisionNumber!: number;
  @ApiProperty({ type: String, nullable: true }) publishedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) effectiveSemesterCode!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) documentNumber!: string | null;
  @ApiProperty({ type: String, format: 'date', nullable: true }) signedDate!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) courseDescription!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) englishDescription!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) objectives!: string | null;
  @ApiProperty({ type: String, nullable: true }) teachingMethods!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) assessmentMethods!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) references!: string | null;
  @ApiProperty({ type: String, nullable: true }) failingScore!: string | null;
  @ApiProperty({ type: [DdutCourseCloDto] }) clos!: DdutCourseCloDto[];
}

export class DdutCourseRelationDto {
  @ApiProperty({ enum: CourseRelationType, enumName: 'CourseRelationType' })
  relationType!: CourseRelationType;
  @ApiProperty() sourceCourseCode!: string;
  @ApiProperty() sourceCourseName!: string;
  @ApiProperty() targetCourseCode!: string;
  @ApiProperty() targetCourseName!: string;
  @ApiProperty({ type: String, nullable: true }) minScore!: string | null;
}

export class DdutCourseDetailDto {
  @ApiProperty({ type: DdutMetaDto }) meta!: DdutMetaDto;
  @ApiProperty() courseCode!: string;
  @ApiProperty() courseName!: string;
  @ApiProperty({ type: String, nullable: true }) englishName!: string | null;
  @ApiProperty() credits!: string;
  @ApiProperty({ enum: CourseType, enumName: 'CourseType' })
  courseType!: CourseType;
  @ApiProperty({ enum: CourseStatus, enumName: 'CourseStatus' })
  status!: CourseStatus;
  @ApiProperty() ownerFacultyCode!: string;
  @ApiProperty() ownerFacultyName!: string;
  @ApiProperty({ type: String, nullable: true }) ownerGroupCode!: string | null;
  @ApiProperty({ type: String, nullable: true }) ownerGroupName!: string | null;
  @ApiProperty({ type: String, nullable: true }) equivalenceGroupCode!:
    string | null;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: DdutPublishedSyllabusSummaryDto, nullable: true })
  latestPublishedSyllabus!: DdutPublishedSyllabusSummaryDto | null;
  @ApiProperty({ type: [DdutGradingComponentDto] })
  gradingFormula!: DdutGradingComponentDto[];
  @ApiProperty({ type: [DdutCourseRelationDto] })
  relations!: DdutCourseRelationDto[];
}
