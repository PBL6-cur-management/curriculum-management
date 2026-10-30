import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
  EnrollmentType,
  StudentStatus,
  SyllabusMaterialKind,
} from '../../../generated/prisma/client.js';

export const PORTAL_COURSE_STATES = [
  'PASSED',
  'PASSED_EQUIVALENT',
  'IN_PROGRESS',
  'FAILED',
  'NOT_TAKEN',
] as const;
export type PortalCourseState = (typeof PORTAL_COURSE_STATES)[number];

export class PortalSemesterQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() semesterId?: string;
}

export class PortalContextQueryDto {
  @ApiProperty() @IsString() @IsNotEmpty() programId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() semesterId!: string;
}

export class PortalStudentDto {
  @ApiProperty() id!: string;
  @ApiProperty() studentCode!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() cohortCode!: string;
  @ApiProperty() major!: string;
  @ApiProperty({ enum: StudentStatus, enumName: 'StudentStatus' })
  status!: StudentStatus;
}

export class PortalProgramDto {
  @ApiProperty() programId!: string;
  @ApiProperty() programCode!: string;
  @ApiProperty() programName!: string;
  @ApiProperty({ enum: EnrollmentType, enumName: 'EnrollmentType' })
  enrollmentType!: EnrollmentType;
  @ApiProperty() versionId!: string;
  @ApiProperty({ type: String, nullable: true }) versionNumber!: string | null;
  @ApiProperty({ type: String, nullable: true }) decisionNumber!: string | null;
}

export class PortalSemesterDto {
  @ApiProperty() id!: string;
  @ApiProperty() semesterCode!: string;
}

export class PortalMeDto {
  @ApiProperty({ type: PortalStudentDto, nullable: true })
  student!: PortalStudentDto | null;
  @ApiProperty({ type: PortalSemesterDto, nullable: true })
  semester!: PortalSemesterDto | null;
  @ApiProperty({ type: [PortalProgramDto] }) programs!: PortalProgramDto[];
}

export class PortalCourseDto {
  @ApiProperty() itemId!: string;
  @ApiProperty() courseId!: string;
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

export class PortalTermDto {
  @ApiProperty() plannedSemester!: number;
  @ApiProperty() credits!: string;
  @ApiProperty({ type: [PortalCourseDto] }) courses!: PortalCourseDto[];
}

export class PortalCurriculumDto {
  @ApiProperty() programName!: string;
  @ApiProperty({ type: String, nullable: true }) versionNumber!: string | null;
  @ApiProperty({ type: String, nullable: true }) decisionNumber!: string | null;
  @ApiProperty() totalCredits!: string;
  @ApiProperty({ type: [PortalTermDto] }) terms!: PortalTermDto[];
}

export class PortalPloDto {
  @ApiProperty() ploCode!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: String, nullable: true }) competencyGroup!:
    string | null;
}

export class PortalCloDto {
  @ApiProperty() cloCode!: string;
  @ApiProperty() description!: string;
}

export class PortalWeekDto {
  @ApiProperty() weekLabel!: string;
  @ApiProperty() content!: string;
}

export class PortalAssessmentDto {
  @ApiProperty() componentCode!: string;
  @ApiProperty() componentName!: string;
  @ApiProperty() weight!: string;
  @ApiProperty({ type: String, nullable: true }) assessmentForm!: string | null;
}

export class PortalAttachmentDto {
  @ApiProperty() id!: string;
  @ApiProperty() fileName!: string;
  @ApiProperty({ enum: SyllabusMaterialKind, enumName: 'SyllabusMaterialKind' })
  materialKind!: SyllabusMaterialKind;
  @ApiProperty() sizeBytes!: number;
}

// Allowlisted: no draft state, request, reviewer or uploader fields ever reach a student.
export class PortalSyllabusDto {
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
  @ApiProperty({ type: [PortalAttachmentDto] })
  attachments!: PortalAttachmentDto[];
}
