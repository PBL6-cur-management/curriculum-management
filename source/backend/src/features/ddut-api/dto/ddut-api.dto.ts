import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { SyllabusMaterialKind } from '../../../generated/prisma/client.js';
import { INTEGRATION } from '../../../shared/integration-access/integration.constants.js';
import { VERSION_NUMBER_PATTERN } from '../../../shared/releases/version-number.js';
import {
  PORTAL_COURSE_STATES,
  PortalAssessmentDto,
  PortalCloDto,
  PortalWeekDto,
  type PortalCourseState,
} from '../../student-portal/dto/student-portal.dto.js';
import { DdutCourseRefDto, DdutMetaDto } from './ddut-course.dto.js';
import { DdutRegistrationEligibilityDto } from './ddut-eligibility.dto.js';
import {
  DDUT_GRADUATION_OUTCOME_SCHEMA,
  DdutCreditsDto,
  DdutDiagnosticDto,
  type DdutGraduationOutcome,
} from './ddut-graduation.dto.js';

export * from './ddut-course.dto.js';
export * from './ddut-eligibility.dto.js';
export * from './ddut-graduation.dto.js';

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

export class DdutStudentContextDto {
  @ApiProperty() studentCode!: string;
  @ApiProperty() programCode!: string;
  @ApiProperty() programName!: string;
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

export class DdutSyllabusAttachmentDto {
  @ApiProperty() fileName!: string;
  @ApiProperty({ enum: SyllabusMaterialKind, enumName: 'SyllabusMaterialKind' })
  materialKind!: SyllabusMaterialKind;
  @ApiProperty() sizeBytes!: number;
}

export class DdutSyllabusContentDto {
  @ApiProperty() courseCode!: string;
  @ApiProperty() courseName!: string;
  @ApiProperty() credits!: string;
  @ApiProperty() revisionNumber!: number;
  @ApiProperty({ type: String, nullable: true }) publishedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) courseDescription!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) objectives!: string | null;
  @ApiProperty({ type: String, nullable: true }) teachingMethods!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) assessmentMethods!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) references!: string | null;
  @ApiProperty({ type: [PortalCloDto] }) clos!: PortalCloDto[];
  @ApiProperty({ type: [PortalWeekDto] }) weeks!: PortalWeekDto[];
  @ApiProperty({ type: [PortalAssessmentDto] })
  assessments!: PortalAssessmentDto[];
  @ApiProperty({ type: [DdutSyllabusAttachmentDto] })
  attachments!: DdutSyllabusAttachmentDto[];
}

export class DdutSyllabusDto {
  @ApiProperty({ type: DdutMetaDto }) meta!: DdutMetaDto;
  @ApiProperty({ type: DdutSyllabusContextDto })
  context!: DdutSyllabusContextDto;
  @ApiProperty({ type: DdutSyllabusContentDto })
  syllabus!: DdutSyllabusContentDto;
}

export class DdutProgressCourseDto {
  @ApiProperty() courseCode!: string;
  @ApiProperty() courseName!: string;
  @ApiProperty() credits!: string;
  @ApiProperty() isElective!: boolean;
  @ApiProperty({ type: String, nullable: true }) groupName!: string | null;
  @ApiProperty({ type: String, nullable: true }) blockSymbol!: string | null;
  @ApiProperty({ enum: PORTAL_COURSE_STATES, enumName: 'PortalCourseState' })
  state!: PortalCourseState;
  @ApiProperty() attemptCount!: number;
  @ApiProperty({ type: String, nullable: true }) score10!: string | null;
  @ApiProperty({ type: String, nullable: true }) score4!: string | null;
  @ApiProperty({ type: String, nullable: true }) letterGrade!: string | null;
  @ApiProperty() hasSyllabus!: boolean;
}

export class DdutProgressTermDto {
  @ApiProperty() plannedSemester!: number;
  @ApiProperty() credits!: string;
  @ApiProperty({ type: [DdutProgressCourseDto] })
  courses!: DdutProgressCourseDto[];
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
  @ApiProperty({ type: [DdutProgressTermDto] }) terms!: DdutProgressTermDto[];
}

export class DdutEligibilityDto {
  @ApiProperty({ type: DdutMetaDto }) meta!: DdutMetaDto;
  @ApiProperty({ type: DdutStudentContextDto }) context!: DdutStudentContextDto;
  @ApiProperty({ type: DdutRegistrationEligibilityDto })
  eligibility!: DdutRegistrationEligibilityDto;
}

export class DdutGraduationDto {
  @ApiProperty({ type: DdutMetaDto }) meta!: DdutMetaDto;
  @ApiProperty({ type: DdutStudentContextDto }) context!: DdutStudentContextDto;
  @ApiProperty(DDUT_GRADUATION_OUTCOME_SCHEMA)
  graduation!: DdutGraduationOutcome;
}
