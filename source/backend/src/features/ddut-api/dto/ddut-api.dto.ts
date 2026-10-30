import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { RegistrationEligibilityDto } from '../../registration-eligibility/dto/registration-eligibility.dto.js';
import {
  PortalSyllabusDto,
  PortalTermDto,
} from '../../student-portal/dto/student-portal.dto.js';
import { GRADUATION_OUTCOME_SCHEMA } from '../../graduation/graduation.dto.js';
import type { GraduationOutcome } from '../../../shared/graduation/graduation.types.js';
import { INTEGRATION } from '../../../shared/integration-access/integration.constants.js';
import { VERSION_NUMBER_PATTERN } from '../../../shared/releases/version-number.js';

export class DdutSemesterQueryDto {
  @ApiPropertyOptional({
    description:
      'Mã học kỳ. Bỏ trống: học kỳ gần nhất đã bắt đầu tính đến hôm nay.',
    maxLength: INTEGRATION.CODE_MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(INTEGRATION.CODE_MAX)
  semester?: string;
}

export class DdutSyllabusQueryDto extends DdutSemesterQueryDto {
  @ApiPropertyOptional({ description: 'Mã sinh viên (chọn theo sinh viên).' })
  @IsOptional()
  @IsString()
  @MaxLength(INTEGRATION.CODE_MAX)
  mssv?: string;

  @ApiPropertyOptional({
    description: 'Mã chương trình (chọn theo phiên bản).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(INTEGRATION.CODE_MAX)
  program?: string;

  @ApiPropertyOptional({ example: '1.0' })
  @IsOptional()
  @Matches(VERSION_NUMBER_PATTERN)
  programVersion?: string;
}

export class DdutMetaDto {
  @ApiProperty({ enum: ['v1'] }) apiVersion!: 'v1';
  @ApiProperty({ format: 'date-time' }) evaluatedAt!: string;
}

export class DdutStudentContextDto {
  @ApiProperty() studentCode!: string;
  @ApiProperty() enrollmentId!: string;
  @ApiProperty() programCode!: string;
  @ApiProperty() programName!: string;
  @ApiProperty() programVersionId!: string;
  @ApiProperty({ type: String, nullable: true }) versionNumber!: string | null;
  @ApiProperty({ type: String, nullable: true }) decisionNumber!: string | null;
  @ApiProperty() semesterCode!: string;
  @ApiProperty({ format: 'date' }) semesterStartDate!: string;
  @ApiProperty({ enum: ['COHORT', 'EXCEPTION'] })
  versionSource!: 'COHORT' | 'EXCEPTION';
}

export class DdutApplicableProgramDto {
  @ApiProperty({ type: DdutMetaDto }) meta!: DdutMetaDto;
  @ApiProperty({ type: DdutStudentContextDto }) context!: DdutStudentContextDto;
}

export class DdutCourseRefDto {
  @ApiProperty() courseCode!: string;
  @ApiProperty() courseName!: string;
}

export class DdutRequisiteDto {
  @ApiProperty({ type: DdutCourseRefDto }) sourceCourse!: DdutCourseRefDto;
  @ApiProperty({ enum: ['PRIOR', 'PREREQUISITE', 'COREQUISITE'] })
  relationType!: 'PRIOR' | 'PREREQUISITE' | 'COREQUISITE';
  @ApiProperty({ type: String, nullable: true }) minScore!: string | null;
}

export class DdutCurriculumItemDto {
  @ApiProperty({ type: DdutCourseRefDto }) course!: DdutCourseRefDto;
  @ApiProperty() credits!: string;
  @ApiProperty() sortOrder!: number;
  @ApiProperty({ type: String, nullable: true }) blockSymbol!: string | null;
  @ApiProperty() isElective!: boolean;
  @ApiProperty({ type: String, nullable: true }) electiveGroupCode!:
    string | null;
  @ApiProperty() htDa!: boolean;
  @ApiProperty() tqDa!: boolean;
  @ApiProperty({ type: String, nullable: true }) minStudiedScore!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) minTransferScore!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
  @ApiProperty() hasSyllabus!: boolean;
  @ApiProperty({ type: [DdutRequisiteDto] }) requisites!: DdutRequisiteDto[];
}

export class DdutPlannedSemesterDto {
  @ApiProperty() plannedSemester!: number;
  @ApiProperty({ type: [DdutCurriculumItemDto] })
  items!: DdutCurriculumItemDto[];
}

export class DdutElectiveGroupDto {
  @ApiProperty() groupCode!: string;
  @ApiProperty() groupName!: string;
  @ApiProperty({ type: String, nullable: true }) minCredits!: string | null;
  @ApiProperty({ type: Number, nullable: true }) minCourses!: number | null;
}

export class DdutPloDto {
  @ApiProperty() ploCode!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: String, nullable: true }) competencyGroup!:
    string | null;
  @ApiProperty() sortOrder!: number;
}

export class DdutProgramVersionDto {
  @ApiProperty({ type: DdutMetaDto }) meta!: DdutMetaDto;
  @ApiProperty() programCode!: string;
  @ApiProperty() programName!: string;
  @ApiProperty() majorCode!: string;
  @ApiProperty() majorName!: string;
  @ApiProperty() versionNumber!: string;
  @ApiProperty({ enum: ['PENDING', 'ACTIVE', 'HISTORICAL'] })
  status!: 'PENDING' | 'ACTIVE' | 'HISTORICAL';
  @ApiProperty({ type: String, nullable: true }) decisionNumber!: string | null;
  @ApiProperty() semesterCount!: number;
  @ApiProperty() totalCredits!: string;
  @ApiProperty() compulsoryCredits!: string;
  @ApiProperty() electiveCredits!: string;
  @ApiProperty({ format: 'date-time' }) publishedAt!: string;
  @ApiProperty({ type: String, nullable: true }) effectiveSemesterCode!:
    string | null;
  @ApiProperty({ type: [DdutPlannedSemesterDto] })
  semesters!: DdutPlannedSemesterDto[];
  @ApiProperty({ type: [DdutElectiveGroupDto] })
  electiveGroups!: DdutElectiveGroupDto[];
  @ApiProperty({ type: [DdutPloDto] }) plos!: DdutPloDto[];
}

export class DdutSyllabusContextDto {
  @ApiProperty() programCode!: string;
  @ApiProperty({ type: String, nullable: true }) versionNumber!: string | null;
  @ApiProperty({ type: String, nullable: true }) studentCode!: string | null;
}

export class DdutSyllabusDto {
  @ApiProperty({ type: DdutMetaDto }) meta!: DdutMetaDto;
  @ApiProperty({ type: DdutSyllabusContextDto })
  context!: DdutSyllabusContextDto;
  @ApiProperty({ type: PortalSyllabusDto }) syllabus!: PortalSyllabusDto;
}

export class DdutCreditsDto {
  @ApiProperty() requiredTotal!: string;
  @ApiProperty() recognizedTotal!: string;
  @ApiProperty() missingTotal!: string;
  @ApiProperty() compulsory!: string;
  @ApiProperty() elective!: string;
  @ApiProperty() free!: string;
}

export class DdutDiagnosticDto {
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
}

export class DdutProgressDto {
  @ApiProperty({ type: DdutMetaDto }) meta!: DdutMetaDto;
  @ApiProperty({ type: DdutStudentContextDto }) context!: DdutStudentContextDto;
  @ApiProperty({ enum: ['HAS_RESULTS', 'NO_ACADEMIC_RESULTS'] })
  academicStatus!: 'HAS_RESULTS' | 'NO_ACADEMIC_RESULTS';
  @ApiProperty({
    type: DdutCreditsDto,
    nullable: true,
    description: 'Null khi không tính được; xem creditsUnavailable.',
  })
  credits!: DdutCreditsDto | null;
  @ApiProperty({ type: DdutDiagnosticDto, nullable: true })
  creditsUnavailable!: DdutDiagnosticDto | null;
  @ApiProperty({ type: [PortalTermDto] }) terms!: PortalTermDto[];
}

export class DdutEligibilityDto {
  @ApiProperty({ type: DdutMetaDto }) meta!: DdutMetaDto;
  @ApiProperty({ type: DdutStudentContextDto }) context!: DdutStudentContextDto;
  @ApiProperty({ type: RegistrationEligibilityDto })
  eligibility!: RegistrationEligibilityDto;
}

export class DdutGraduationDto {
  @ApiProperty({ type: DdutMetaDto }) meta!: DdutMetaDto;
  @ApiProperty({ type: DdutStudentContextDto }) context!: DdutStudentContextDto;
  @ApiProperty(GRADUATION_OUTCOME_SCHEMA)
  graduation!: GraduationOutcome;
}
