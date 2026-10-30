import { ApiProperty } from '@nestjs/swagger';
import {
  AcademicResultStatus,
  CourseStatus,
} from '../../../generated/prisma/client.js';
import {
  ELIGIBILITY_REASON_CODES,
  ELIGIBILITY_VALUES,
  ELIGIBILITY_WARNING_CODES,
} from '../../../shared/registration-eligibility/eligibility.constants.js';
import type {
  EligibilityReasonCode,
  EligibilityRelation,
  EligibilityValue,
  EligibilityWarningCode,
} from '../../../shared/registration-eligibility/eligibility.types.js';

export class EligibilityCourseRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() courseCode!: string;
  @ApiProperty() courseName!: string;
  @ApiProperty({
    enum: ['SNAPSHOT', 'CATALOG'],
    enumName: 'EligibilityNameSource',
  })
  nameSource!: 'SNAPSHOT' | 'CATALOG';
}
export class EligibilityReasonDto {
  @ApiProperty({
    enum: ELIGIBILITY_REASON_CODES,
    enumName: 'EligibilityReasonCode',
  })
  code!: EligibilityReasonCode;
  @ApiProperty({ enum: ELIGIBILITY_REASON_CODES, nullable: true })
  causeCode!: EligibilityReasonCode | null;
  @ApiProperty() message!: string;
  @ApiProperty({
    enum: ['PRIOR', 'PREREQUISITE', 'COREQUISITE'],
    nullable: true,
  })
  relationType!: EligibilityRelation | null;
  @ApiProperty({ type: EligibilityCourseRefDto, nullable: true })
  requiredCourse!: EligibilityCourseRefDto | null;
  @ApiProperty({ type: EligibilityCourseRefDto, nullable: true })
  viaCourse!: EligibilityCourseRefDto | null;
  @ApiProperty({ type: EligibilityCourseRefDto, nullable: true })
  evidenceCourse!: EligibilityCourseRefDto | null;
  @ApiProperty({ type: String, nullable: true }) evidenceResultId!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) requiredScore4!: string | null;
  @ApiProperty({ type: String, nullable: true }) actualScore4!: string | null;
  @ApiProperty({
    enum: AcademicResultStatus,
    enumName: 'AcademicResultStatus',
    nullable: true,
  })
  actualStatus!: AcademicResultStatus | null;
  @ApiProperty({ type: [EligibilityCourseRefDto] })
  path!: EligibilityCourseRefDto[];
}
export class EligibilityWarningDto {
  @ApiProperty({
    enum: ELIGIBILITY_WARNING_CODES,
    enumName: 'EligibilityWarningCode',
  })
  code!: EligibilityWarningCode;
  @ApiProperty() message!: string;
  @ApiProperty({ type: EligibilityCourseRefDto })
  course!: EligibilityCourseRefDto;
}
export class EligibilityItemDto {
  @ApiProperty() itemId!: string;
  @ApiProperty({ type: EligibilityCourseRefDto })
  course!: EligibilityCourseRefDto;
  @ApiProperty() credits!: string;
  @ApiProperty({ enum: CourseStatus, enumName: 'CourseStatus' })
  catalogStatus!: CourseStatus;
  @ApiProperty() plannedSemester!: number;
  @ApiProperty() completed!: boolean;
  @ApiProperty({ enum: ELIGIBILITY_VALUES, nullable: true })
  eligibility!: EligibilityValue | null;
  @ApiProperty() statusText!: string;
  @ApiProperty({ type: [EligibilityReasonDto] })
  reasons!: EligibilityReasonDto[];
  @ApiProperty({ type: [EligibilityCourseRefDto] })
  requiredConcurrentCourses!: EligibilityCourseRefDto[];
}
export class EligibilityContextDto {
  @ApiProperty() studentId!: string;
  @ApiProperty() enrollmentId!: string;
  @ApiProperty() programId!: string;
  @ApiProperty() semesterId!: string;
  @ApiProperty() programVersionId!: string;
  @ApiProperty({
    enum: ['COHORT', 'EXCEPTION'],
    enumName: 'EligibilityVersionSource',
  })
  source!: 'COHORT' | 'EXCEPTION';
  @ApiProperty({ type: String, nullable: true }) cohortAssignmentId!:
    string | null;
}
export class RegistrationEligibilityDto {
  @ApiProperty({ enum: [1] }) contractVersion!: 1;
  @ApiProperty({ type: EligibilityContextDto }) context!: EligibilityContextDto;
  @ApiProperty({ format: 'date-time' }) evaluatedAt!: string;
  @ApiProperty({ type: [EligibilityItemDto] }) items!: EligibilityItemDto[];
  @ApiProperty({ type: [EligibilityWarningDto] })
  warnings!: EligibilityWarningDto[];
}
export class EligibilityStudentOptionDto {
  @ApiProperty() id!: string;
  @ApiProperty() studentCode!: string;
  @ApiProperty() fullName!: string;
}
export class EligibilityStudentPageDto {
  @ApiProperty({ type: [EligibilityStudentOptionDto] })
  items!: EligibilityStudentOptionDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}
