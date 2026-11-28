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

export class DdutEligibilityCourseRefDto {
  @ApiProperty() courseCode!: string;
  @ApiProperty() courseName!: string;
  @ApiProperty({
    enum: ['SNAPSHOT', 'CATALOG'],
    enumName: 'EligibilityNameSource',
  })
  nameSource!: 'SNAPSHOT' | 'CATALOG';
}

export class DdutEligibilityReasonDto {
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
  @ApiProperty({ type: DdutEligibilityCourseRefDto, nullable: true })
  requiredCourse!: DdutEligibilityCourseRefDto | null;
  @ApiProperty({ type: DdutEligibilityCourseRefDto, nullable: true })
  viaCourse!: DdutEligibilityCourseRefDto | null;
  @ApiProperty({ type: DdutEligibilityCourseRefDto, nullable: true })
  evidenceCourse!: DdutEligibilityCourseRefDto | null;
  @ApiProperty({ type: String, nullable: true }) requiredScore4!: string | null;
  @ApiProperty({ type: String, nullable: true }) actualScore4!: string | null;
  @ApiProperty({
    enum: AcademicResultStatus,
    enumName: 'AcademicResultStatus',
    nullable: true,
  })
  actualStatus!: AcademicResultStatus | null;
  @ApiProperty({ type: [DdutEligibilityCourseRefDto] })
  path!: DdutEligibilityCourseRefDto[];
}

export class DdutEligibilityWarningDto {
  @ApiProperty({
    enum: ELIGIBILITY_WARNING_CODES,
    enumName: 'EligibilityWarningCode',
  })
  code!: EligibilityWarningCode;
  @ApiProperty() message!: string;
  @ApiProperty({ type: DdutEligibilityCourseRefDto })
  course!: DdutEligibilityCourseRefDto;
}

export class DdutEligibilityItemDto {
  @ApiProperty({ type: DdutEligibilityCourseRefDto })
  course!: DdutEligibilityCourseRefDto;
  @ApiProperty() credits!: string;
  @ApiProperty({ enum: CourseStatus, enumName: 'CourseStatus' })
  catalogStatus!: CourseStatus;
  @ApiProperty() plannedSemester!: number;
  @ApiProperty() completed!: boolean;
  @ApiProperty({ enum: ELIGIBILITY_VALUES, nullable: true })
  eligibility!: EligibilityValue | null;
  @ApiProperty() statusText!: string;
  @ApiProperty({ type: [DdutEligibilityReasonDto] })
  reasons!: DdutEligibilityReasonDto[];
  @ApiProperty({ type: [DdutEligibilityCourseRefDto] })
  requiredConcurrentCourses!: DdutEligibilityCourseRefDto[];
}

export class DdutEligibilityContextDto {
  @ApiProperty() studentCode!: string;
  @ApiProperty() programCode!: string;
  @ApiProperty({ type: String, nullable: true }) versionNumber!: string | null;
  @ApiProperty() semesterCode!: string;
  @ApiProperty({
    enum: ['COHORT', 'EXCEPTION'],
    enumName: 'EligibilityVersionSource',
  })
  source!: 'COHORT' | 'EXCEPTION';
}

export class DdutRegistrationEligibilityDto {
  @ApiProperty({ enum: [1] }) contractVersion!: 1;
  @ApiProperty({ type: DdutEligibilityContextDto })
  context!: DdutEligibilityContextDto;
  @ApiProperty({ format: 'date-time' }) evaluatedAt!: string;
  @ApiProperty({ type: [DdutEligibilityItemDto] })
  items!: DdutEligibilityItemDto[];
  @ApiProperty({ type: [DdutEligibilityWarningDto] })
  warnings!: DdutEligibilityWarningDto[];
}
