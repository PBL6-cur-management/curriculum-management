import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { GRADUATION_WARNING_CODES } from '../../../shared/graduation/graduation.constants.js';
import type {
  CompletionReason,
  CreditBasis,
  GraduationConclusion,
  GraduationResult,
} from '../../../shared/graduation/graduation.types.js';
import { DdutCourseRefDto } from './ddut-course.dto.js';

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

export class DdutGraduationContextDto {
  @ApiProperty() studentCode!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() programCode!: string;
  @ApiProperty() programName!: string;
  @ApiProperty() cohortCode!: string;
  @ApiProperty() versionNumber!: string;
  @ApiProperty() semesterCode!: string;
  @ApiProperty({ type: String, format: 'date' }) semesterStartDate!: string;
  @ApiProperty({ enum: ['COHORT', 'EXCEPTION'] }) versionSource!:
    'COHORT' | 'EXCEPTION';
}

class DdutCourseShortfallBaseDto {
  @ApiProperty({ type: DdutCourseRefDto }) course!: DdutCourseRefDto;
  @ApiProperty({ type: String, nullable: true }) blockSymbol!: string | null;
  @ApiProperty({ enum: ['NOT_TAKEN', 'FAILED', 'IN_PROGRESS'] })
  reason!: CompletionReason;
  @ApiProperty() message!: string;
}

export class DdutMandatoryCourseShortfallDto extends DdutCourseShortfallBaseDto {
  @ApiProperty({ enum: ['MANDATORY_COURSE_MISSING'] })
  code!: 'MANDATORY_COURSE_MISSING';
  @ApiProperty({ enum: ['MANDATORY_COURSE'] }) category!: 'MANDATORY_COURSE';
}

export class DdutConditionalCourseShortfallDto extends DdutCourseShortfallBaseDto {
  @ApiProperty({ enum: ['CONDITIONAL_COURSE_MISSING'] })
  code!: 'CONDITIONAL_COURSE_MISSING';
  @ApiProperty({ enum: ['CONDITIONAL_COURSE'] })
  category!: 'CONDITIONAL_COURSE';
}

class DdutElectiveShortfallBaseDto {
  @ApiProperty({ enum: ['ELECTIVE_GROUP'] }) category!: 'ELECTIVE_GROUP';
  @ApiProperty() groupCode!: string;
  @ApiProperty() groupName!: string;
  @ApiProperty() message!: string;
}

export class DdutElectiveCreditShortfallDto extends DdutElectiveShortfallBaseDto {
  @ApiProperty({ enum: ['ELECTIVE_CREDITS_MISSING'] })
  code!: 'ELECTIVE_CREDITS_MISSING';
  @ApiProperty() requiredCredits!: string;
  @ApiProperty() earnedCredits!: string;
  @ApiProperty() missingCredits!: string;
}

export class DdutElectiveCourseShortfallDto extends DdutElectiveShortfallBaseDto {
  @ApiProperty({ enum: ['ELECTIVE_COURSES_MISSING'] })
  code!: 'ELECTIVE_COURSES_MISSING';
  @ApiProperty() requiredCourses!: number;
  @ApiProperty() earnedCourses!: number;
  @ApiProperty() missingCourses!: number;
}

export class DdutTotalCreditShortfallDto {
  @ApiProperty({ enum: ['TOTAL_CREDITS_MISSING'] })
  code!: 'TOTAL_CREDITS_MISSING';
  @ApiProperty({ enum: ['TOTAL_CREDITS'] }) category!: 'TOTAL_CREDITS';
  @ApiProperty() requiredCredits!: string;
  @ApiProperty() earnedCredits!: string;
  @ApiProperty() missingCredits!: string;
  @ApiProperty() message!: string;
}

export class DdutLowGpaShortfallDto {
  @ApiProperty({ enum: ['LOW_GPA'] }) code!: 'LOW_GPA';
  @ApiProperty({ enum: ['GPA'] }) category!: 'GPA';
  @ApiProperty() requiredGpa!: string;
  @ApiProperty() actualGpa!: string;
  @ApiProperty() message!: string;
}

export class DdutTrackNotSelectedShortfallDto {
  @ApiProperty({ enum: ['TRACK_NOT_SELECTED'] }) code!: 'TRACK_NOT_SELECTED';
  @ApiProperty({ enum: ['TRACK'] }) category!: 'TRACK';
  @ApiProperty() message!: string;
}

export type DdutGraduationShortfallDto =
  | DdutLowGpaShortfallDto
  | DdutTrackNotSelectedShortfallDto
  | DdutMandatoryCourseShortfallDto
  | DdutConditionalCourseShortfallDto
  | DdutElectiveCreditShortfallDto
  | DdutElectiveCourseShortfallDto
  | DdutTotalCreditShortfallDto;

export class DdutGraduationRecognitionDto {
  @ApiProperty({ type: DdutCourseRefDto }) requiredCourse!: DdutCourseRefDto;
  @ApiProperty({ type: DdutCourseRefDto }) studiedCourse!: DdutCourseRefDto;
  @ApiProperty() attemptRevision!: number;
  @ApiProperty({ enum: ['PASSED', 'EXEMPT'] }) completionStatus!:
    'PASSED' | 'EXEMPT';
  @ApiProperty() viaEquivalence!: boolean;
  @ApiProperty({ type: String, nullable: true }) equivalenceGroupCode!:
    string | null;
  @ApiProperty() requiredCredits!: string;
  @ApiProperty() recognizedCredits!: string;
  @ApiProperty({ enum: ['APPLIED_VERSION_SNAPSHOT', 'CURRENT_CATALOG'] })
  creditBasis!: CreditBasis;
  @ApiProperty({
    enum: ['MANDATORY_COURSE', 'ELECTIVE_GROUP', 'CONDITIONAL_COURSE'],
  })
  category!: 'MANDATORY_COURSE' | 'ELECTIVE_GROUP' | 'CONDITIONAL_COURSE';
  @ApiProperty({ type: String, nullable: true }) electiveGroupCode!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) blockSymbol!: string | null;
}

export class DdutGraduationFreeCreditDto {
  @ApiProperty({ type: DdutCourseRefDto }) course!: DdutCourseRefDto;
  @ApiProperty() credits!: string;
  @ApiProperty({ enum: ['APPLIED_VERSION_SNAPSHOT', 'CURRENT_CATALOG'] })
  creditBasis!: CreditBasis;
  @ApiProperty({ enum: ['SURPLUS_EQUIVALENT', 'OUTSIDE_FRAME'] }) reason!:
    'SURPLUS_EQUIVALENT' | 'OUTSIDE_FRAME';
}

export class DdutGraduationGroupProgressDto {
  @ApiProperty() groupCode!: string;
  @ApiProperty() groupName!: string;
  @ApiProperty({ type: String, nullable: true }) requiredCredits!:
    string | null;
  @ApiProperty() earnedCredits!: string;
  @ApiProperty({ type: String, nullable: true }) missingCredits!: string | null;
  @ApiProperty({ type: Number, nullable: true }) requiredCourses!:
    number | null;
  @ApiProperty() earnedCourses!: number;
  @ApiProperty({ type: Number, nullable: true }) missingCourses!: number | null;
}

export class DdutGraduationBlockProgressDto {
  @ApiProperty({ type: String, nullable: true }) blockSymbol!: string | null;
  @ApiProperty({ type: String, nullable: true }) blockName!: string | null;
  @ApiProperty() earnedCredits!: string;
  @ApiProperty() compulsoryCredits!: string;
  @ApiProperty() electiveCredits!: string;
  @ApiProperty({ type: String, nullable: true }) catalogRequiredCredits!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) advisoryGap!: string | null;
}

export class DdutGraduationWarningDto {
  @ApiProperty({ enum: GRADUATION_WARNING_CODES })
  code!: GraduationResult['warnings'][number]['code'];
  @ApiProperty({ type: String, nullable: true }) courseCode!: string | null;
  @ApiProperty({ type: String, nullable: true }) creditGap!: string | null;
  @ApiProperty() message!: string;
}

export const DDUT_SHORTFALL_MODELS = [
  DdutLowGpaShortfallDto,
  DdutTrackNotSelectedShortfallDto,
  DdutMandatoryCourseShortfallDto,
  DdutConditionalCourseShortfallDto,
  DdutElectiveCreditShortfallDto,
  DdutElectiveCourseShortfallDto,
  DdutTotalCreditShortfallDto,
] as const;

@ApiExtraModels(...DDUT_SHORTFALL_MODELS)
export class DdutGraduationResultDto {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ enum: ['graduation-v1'] }) ruleVersion!: 'graduation-v1';
  @ApiProperty({ type: String, format: 'date-time' }) evaluatedAt!: string;
  @ApiProperty({ type: DdutGraduationContextDto })
  context!: DdutGraduationContextDto;
  @ApiProperty({ enum: ['ELIGIBLE', 'NOT_ELIGIBLE'] })
  conclusion!: GraduationConclusion;
  @ApiProperty({ type: String, nullable: true, required: false })
  cumulativeGpa?: string | null;
  @ApiProperty({ type: String, required: false })
  minGraduationGpa?: string;
  @ApiProperty({
    type: 'array',
    items: {
      oneOf: DDUT_SHORTFALL_MODELS.map((model) => ({
        $ref: getSchemaPath(model),
      })),
      discriminator: {
        propertyName: 'code',
        mapping: {
          LOW_GPA: getSchemaPath(DdutLowGpaShortfallDto),
          TRACK_NOT_SELECTED: getSchemaPath(DdutTrackNotSelectedShortfallDto),
          MANDATORY_COURSE_MISSING: getSchemaPath(
            DdutMandatoryCourseShortfallDto,
          ),
          CONDITIONAL_COURSE_MISSING: getSchemaPath(
            DdutConditionalCourseShortfallDto,
          ),
          ELECTIVE_CREDITS_MISSING: getSchemaPath(
            DdutElectiveCreditShortfallDto,
          ),
          ELECTIVE_COURSES_MISSING: getSchemaPath(
            DdutElectiveCourseShortfallDto,
          ),
          TOTAL_CREDITS_MISSING: getSchemaPath(DdutTotalCreditShortfallDto),
        },
      },
    },
  })
  shortfalls!: DdutGraduationShortfallDto[];
  @ApiProperty({ type: [DdutGraduationWarningDto] })
  warnings!: DdutGraduationWarningDto[];
  @ApiProperty({ type: DdutCreditsDto }) credits!: DdutCreditsDto;
  @ApiProperty({ type: [DdutGraduationGroupProgressDto] })
  electiveGroups!: DdutGraduationGroupProgressDto[];
  @ApiProperty({ type: [DdutGraduationBlockProgressDto] })
  knowledgeBlocks!: DdutGraduationBlockProgressDto[];
  @ApiProperty({ type: [DdutGraduationRecognitionDto] })
  recognitions!: DdutGraduationRecognitionDto[];
  @ApiProperty({ type: [DdutGraduationFreeCreditDto] })
  freeCredits!: DdutGraduationFreeCreditDto[];
}

export class DdutGraduationReviewedOutcomeDto {
  @ApiProperty({ enum: ['REVIEWED'] }) status!: 'REVIEWED';
  @ApiProperty({ type: DdutGraduationResultDto })
  result!: DdutGraduationResultDto;
  @ApiProperty({ type: String, nullable: true, enum: [null] }) error!: null;
}

export class DdutGraduationCannotAuditOutcomeDto {
  @ApiProperty({ enum: ['CANNOT_AUDIT'] }) status!: 'CANNOT_AUDIT';
  @ApiProperty({ type: String, nullable: true, enum: [null] }) result!: null;
  @ApiProperty({ type: DdutDiagnosticDto }) error!: DdutDiagnosticDto;
}

@ApiExtraModels(
  DdutGraduationReviewedOutcomeDto,
  DdutGraduationCannotAuditOutcomeDto,
)
export class DdutGraduationOutcomeDto {
  @ApiProperty({ enum: ['REVIEWED', 'CANNOT_AUDIT'] }) status!:
    'REVIEWED' | 'CANNOT_AUDIT';
  @ApiProperty({ type: DdutGraduationResultDto, nullable: true })
  result!: DdutGraduationResultDto | null;
  @ApiProperty({ type: DdutDiagnosticDto, nullable: true })
  error!: DdutDiagnosticDto | null;
}

export type DdutGraduationOutcome =
  | DdutGraduationReviewedOutcomeDto
  | DdutGraduationCannotAuditOutcomeDto;

export const DDUT_GRADUATION_OUTCOME_SCHEMA = {
  oneOf: [
    { $ref: getSchemaPath(DdutGraduationReviewedOutcomeDto) },
    { $ref: getSchemaPath(DdutGraduationCannotAuditOutcomeDto) },
  ],
  discriminator: {
    propertyName: 'status',
    mapping: {
      REVIEWED: getSchemaPath(DdutGraduationReviewedOutcomeDto),
      CANNOT_AUDIT: getSchemaPath(DdutGraduationCannotAuditOutcomeDto),
    },
  },
};
