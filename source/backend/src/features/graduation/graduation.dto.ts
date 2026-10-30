import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  GRADUATION_LIMITS,
  GRADUATION_WARNING_CODES,
} from '../../shared/graduation/graduation.constants.js';
import type {
  GraduationConclusion,
  GraduationResult,
  GraduationShortfall,
} from '../../shared/graduation/graduation.types.js';
import { PageQueryDto } from '../../shared/pagination/page-query.dto.js';

export class GraduationLookupQueryDto {
  @ApiProperty() @IsString() @IsNotEmpty() programId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() semesterId!: string;
}

export class GraduationSaveDto extends GraduationLookupQueryDto {
  @ApiProperty({ maxLength: GRADUATION_LIMITS.REQUEST_KEY_MAX })
  @IsString()
  @IsNotEmpty()
  @MaxLength(GRADUATION_LIMITS.REQUEST_KEY_MAX)
  requestKey!: string;
}

export class GraduationHistoryQueryDto extends PageQueryDto {
  @ApiProperty() @IsString() @IsNotEmpty() programId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() semesterId!: string;
}

export class GraduationCourseRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() courseCode!: string;
  @ApiProperty() courseName!: string;
}

export class GraduationContextDto {
  @ApiProperty() studentId!: string;
  @ApiProperty() programId!: string;
  @ApiProperty() semesterId!: string;
  @ApiProperty() enrollmentId!: string;
  @ApiProperty() studentCode!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() programCode!: string;
  @ApiProperty() programName!: string;
  @ApiProperty() cohortId!: string;
  @ApiProperty() cohortCode!: string;
  @ApiProperty() programVersionId!: string;
  @ApiProperty() versionNumber!: string;
  @ApiProperty() semesterCode!: string;
  @ApiProperty({ type: String, format: 'date' }) semesterStartDate!: string;
  @ApiProperty({ enum: ['COHORT', 'EXCEPTION'] }) versionSource!:
    'COHORT' | 'EXCEPTION';
  @ApiProperty({ type: String, nullable: true }) cohortAssignmentId!:
    string | null;
}

class GraduationCourseShortfallDto {
  @ApiProperty() curriculumItemId!: string;
  @ApiProperty({ type: GraduationCourseRefDto })
  course!: GraduationCourseRefDto;
  @ApiProperty({ type: String, nullable: true }) blockSymbol!: string | null;
  @ApiProperty({ enum: ['NOT_TAKEN', 'FAILED', 'IN_PROGRESS'] }) reason!:
    'NOT_TAKEN' | 'FAILED' | 'IN_PROGRESS';
  @ApiProperty() message!: string;
}

export class GraduationMandatoryCourseShortfallDto extends GraduationCourseShortfallDto {
  @ApiProperty({ enum: ['MANDATORY_COURSE_MISSING'] })
  code!: 'MANDATORY_COURSE_MISSING';
  @ApiProperty({ enum: ['MANDATORY_COURSE'] }) category!: 'MANDATORY_COURSE';
}

export class GraduationConditionalCourseShortfallDto extends GraduationCourseShortfallDto {
  @ApiProperty({ enum: ['CONDITIONAL_COURSE_MISSING'] })
  code!: 'CONDITIONAL_COURSE_MISSING';
  @ApiProperty({ enum: ['CONDITIONAL_COURSE'] })
  category!: 'CONDITIONAL_COURSE';
}

class GraduationElectiveShortfallDto {
  @ApiProperty({ enum: ['ELECTIVE_GROUP'] }) category!: 'ELECTIVE_GROUP';
  @ApiProperty() groupId!: string;
  @ApiProperty() groupCode!: string;
  @ApiProperty() groupName!: string;
  @ApiProperty() message!: string;
}

export class GraduationElectiveCreditShortfallDto extends GraduationElectiveShortfallDto {
  @ApiProperty({ enum: ['ELECTIVE_CREDITS_MISSING'] })
  code!: 'ELECTIVE_CREDITS_MISSING';
  @ApiProperty({ type: String }) requiredCredits!: string;
  @ApiProperty({ type: String }) earnedCredits!: string;
  @ApiProperty({ type: String }) missingCredits!: string;
}

export class GraduationElectiveCourseShortfallDto extends GraduationElectiveShortfallDto {
  @ApiProperty({ enum: ['ELECTIVE_COURSES_MISSING'] })
  code!: 'ELECTIVE_COURSES_MISSING';
  @ApiProperty({ type: Number }) requiredCourses!: number;
  @ApiProperty({ type: Number }) earnedCourses!: number;
  @ApiProperty({ type: Number }) missingCourses!: number;
}

export class GraduationTotalCreditShortfallDto {
  @ApiProperty({ enum: ['TOTAL_CREDITS_MISSING'] })
  code!: 'TOTAL_CREDITS_MISSING';
  @ApiProperty({ enum: ['TOTAL_CREDITS'] }) category!: 'TOTAL_CREDITS';
  @ApiProperty({ type: String }) requiredCredits!: string;
  @ApiProperty({ type: String }) earnedCredits!: string;
  @ApiProperty({ type: String }) missingCredits!: string;
  @ApiProperty() message!: string;
}

export class GraduationRecognitionDto {
  @ApiProperty() curriculumItemId!: string;
  @ApiProperty({ type: GraduationCourseRefDto })
  requiredCourse!: GraduationCourseRefDto;
  @ApiProperty({ type: GraduationCourseRefDto })
  studiedCourse!: GraduationCourseRefDto;
  @ApiProperty() attemptId!: string;
  @ApiProperty({ type: Number }) attemptRevision!: number;
  @ApiProperty({ enum: ['PASSED', 'EXEMPT'] }) completionStatus!:
    'PASSED' | 'EXEMPT';
  @ApiProperty({ type: Boolean }) viaEquivalence!: boolean;
  @ApiProperty({ type: String, nullable: true }) equivalenceGroupId!:
    string | null;
  @ApiProperty({ type: String }) requiredCredits!: string;
  @ApiProperty({ type: String }) recognizedCredits!: string;
  @ApiProperty({ enum: ['APPLIED_VERSION_SNAPSHOT', 'CURRENT_CATALOG'] })
  creditBasis!: 'APPLIED_VERSION_SNAPSHOT' | 'CURRENT_CATALOG';
  @ApiProperty({
    enum: ['MANDATORY_COURSE', 'ELECTIVE_GROUP', 'CONDITIONAL_COURSE'],
  })
  category!: 'MANDATORY_COURSE' | 'ELECTIVE_GROUP' | 'CONDITIONAL_COURSE';
  @ApiProperty({ type: String, nullable: true }) electiveGroupId!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) blockSymbol!: string | null;
}

export class GraduationFreeCreditDto {
  @ApiProperty({ type: GraduationCourseRefDto })
  course!: GraduationCourseRefDto;
  @ApiProperty() attemptId!: string;
  @ApiProperty({ type: String }) credits!: string;
  @ApiProperty({ enum: ['APPLIED_VERSION_SNAPSHOT', 'CURRENT_CATALOG'] })
  creditBasis!: 'APPLIED_VERSION_SNAPSHOT' | 'CURRENT_CATALOG';
  @ApiProperty({ enum: ['SURPLUS_EQUIVALENT', 'OUTSIDE_FRAME'] }) reason!:
    'SURPLUS_EQUIVALENT' | 'OUTSIDE_FRAME';
}

export class GraduationGroupProgressDto {
  @ApiProperty() groupId!: string;
  @ApiProperty() groupCode!: string;
  @ApiProperty() groupName!: string;
  @ApiProperty({ type: String, nullable: true }) requiredCredits!:
    string | null;
  @ApiProperty({ type: String }) earnedCredits!: string;
  @ApiProperty({ type: String, nullable: true }) missingCredits!: string | null;
  @ApiProperty({ type: Number, nullable: true }) requiredCourses!:
    number | null;
  @ApiProperty({ type: Number }) earnedCourses!: number;
  @ApiProperty({ type: Number, nullable: true }) missingCourses!: number | null;
}

export class GraduationBlockProgressDto {
  @ApiProperty({ type: String, nullable: true }) blockSymbol!: string | null;
  @ApiProperty({ type: String, nullable: true }) blockName!: string | null;
  @ApiProperty({ type: String }) earnedCredits!: string;
  @ApiProperty({ type: String }) compulsoryCredits!: string;
  @ApiProperty({ type: String }) electiveCredits!: string;
  @ApiProperty({ type: String, nullable: true }) catalogRequiredCredits!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) advisoryGap!: string | null;
}

export class GraduationWarningDto {
  @ApiProperty({ enum: GRADUATION_WARNING_CODES })
  code!: GraduationResult['warnings'][number]['code'];
  @ApiProperty({ type: String, nullable: true }) curriculumItemId!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) courseId!: string | null;
  @ApiProperty({ type: String, nullable: true }) creditGap!: string | null;
  @ApiProperty() message!: string;
}

export class GraduationCreditsDto {
  @ApiProperty({ type: String }) requiredTotal!: string;
  @ApiProperty({ type: String }) recognizedTotal!: string;
  @ApiProperty({ type: String }) missingTotal!: string;
  @ApiProperty({ type: String }) compulsory!: string;
  @ApiProperty({ type: String }) elective!: string;
  @ApiProperty({ type: String }) free!: string;
}

const shortfallModels = [
  GraduationMandatoryCourseShortfallDto,
  GraduationConditionalCourseShortfallDto,
  GraduationElectiveCreditShortfallDto,
  GraduationElectiveCourseShortfallDto,
  GraduationTotalCreditShortfallDto,
];

@ApiExtraModels(...shortfallModels)
export class GraduationResultDto implements GraduationResult {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ enum: ['graduation-v1'] }) ruleVersion!: 'graduation-v1';
  @ApiProperty({ type: String, format: 'date-time' }) evaluatedAt!: string;
  @ApiProperty({ type: GraduationContextDto }) context!: GraduationContextDto;
  @ApiProperty({ enum: ['ELIGIBLE', 'NOT_ELIGIBLE'] })
  conclusion!: GraduationConclusion;
  @ApiProperty({
    type: 'array',
    items: {
      oneOf: shortfallModels.map((model) => ({ $ref: getSchemaPath(model) })),
      discriminator: {
        propertyName: 'code',
        mapping: {
          MANDATORY_COURSE_MISSING: getSchemaPath(
            GraduationMandatoryCourseShortfallDto,
          ),
          CONDITIONAL_COURSE_MISSING: getSchemaPath(
            GraduationConditionalCourseShortfallDto,
          ),
          ELECTIVE_CREDITS_MISSING: getSchemaPath(
            GraduationElectiveCreditShortfallDto,
          ),
          ELECTIVE_COURSES_MISSING: getSchemaPath(
            GraduationElectiveCourseShortfallDto,
          ),
          TOTAL_CREDITS_MISSING: getSchemaPath(
            GraduationTotalCreditShortfallDto,
          ),
        },
      },
    },
  })
  shortfalls!: GraduationShortfall[];
  @ApiProperty({ type: [GraduationWarningDto] })
  warnings!: GraduationWarningDto[];
  @ApiProperty({ type: GraduationCreditsDto }) credits!: GraduationCreditsDto;
  @ApiProperty({ type: [GraduationGroupProgressDto] })
  electiveGroups!: GraduationGroupProgressDto[];
  @ApiProperty({ type: [GraduationBlockProgressDto] })
  knowledgeBlocks!: GraduationBlockProgressDto[];
  @ApiProperty({ type: [GraduationRecognitionDto] })
  recognitions!: GraduationRecognitionDto[];
  @ApiProperty({ type: [GraduationFreeCreditDto] })
  freeCredits!: GraduationFreeCreditDto[];
}

export class GraduationDiagnosticDto {
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ type: String, nullable: true }) enrollmentId!: string | null;
}

export class GraduationReviewedOutcomeDto {
  @ApiProperty({ enum: ['REVIEWED'] }) status!: 'REVIEWED';
  @ApiProperty({ type: GraduationResultDto }) result!: GraduationResultDto;
  @ApiProperty({ type: String, nullable: true, enum: [null] }) error!: null;
}

export class GraduationCannotAuditOutcomeDto {
  @ApiProperty({ enum: ['CANNOT_AUDIT'] }) status!: 'CANNOT_AUDIT';
  @ApiProperty({ type: String, nullable: true, enum: [null] }) result!: null;
  @ApiProperty({ type: GraduationDiagnosticDto })
  error!: GraduationDiagnosticDto;
}

@ApiExtraModels(GraduationReviewedOutcomeDto, GraduationCannotAuditOutcomeDto)
export class GraduationOutcomeDto {
  @ApiProperty({ enum: ['REVIEWED', 'CANNOT_AUDIT'] }) status!:
    'REVIEWED' | 'CANNOT_AUDIT';
  @ApiProperty({ type: GraduationResultDto, nullable: true })
  result!: GraduationResultDto | null;
  @ApiProperty({ type: GraduationDiagnosticDto, nullable: true })
  error!: GraduationDiagnosticDto | null;
}

export const GRADUATION_OUTCOME_SCHEMA = {
  oneOf: [
    { $ref: getSchemaPath(GraduationReviewedOutcomeDto) },
    { $ref: getSchemaPath(GraduationCannotAuditOutcomeDto) },
  ],
  discriminator: {
    propertyName: 'status',
    mapping: {
      REVIEWED: getSchemaPath(GraduationReviewedOutcomeDto),
      CANNOT_AUDIT: getSchemaPath(GraduationCannotAuditOutcomeDto),
    },
  },
};

export class GraduationAuditorDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
}

export class GraduationAuditDto {
  @ApiProperty() id!: string;
  @ApiProperty() contextId!: string;
  @ApiProperty() enrollmentId!: string;
  @ApiProperty() programVersionId!: string;
  @ApiProperty({ type: String, format: 'date-time' }) auditedAt!: string;
  @ApiProperty({ type: GraduationAuditorDto, nullable: true })
  auditedBy!: GraduationAuditorDto | null;
  @ApiProperty({ enum: ['STAFF', 'BATCH', 'RESULT_CHANGE'] }) trigger!:
    'STAFF' | 'BATCH' | 'RESULT_CHANGE';
  @ApiProperty({ type: String, nullable: true }) supersedesId!: string | null;
  @ApiProperty() inputDigest!: string;
  @ApiProperty({ type: GraduationResultDto }) result!: GraduationResultDto;
  @ApiProperty({ enum: ['CURRENT', 'RECHECK_PENDING', 'RECHECK_FAILED'] })
  freshness!: 'CURRENT' | 'RECHECK_PENDING' | 'RECHECK_FAILED';
}

export class GraduationAuditPageDto {
  @ApiProperty({ type: [GraduationAuditDto] }) items!: GraduationAuditDto[];
  @ApiProperty({ type: Number }) total!: number;
  @ApiProperty({ type: Number }) page!: number;
  @ApiProperty({ type: Number }) pageSize!: number;
}
