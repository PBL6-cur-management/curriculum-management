import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { Prisma } from '../../generated/prisma/client.js';
import { toWireDecimal } from '../../shared/decimal/decimal.js';
import {
  emptyToNull,
  trimString,
  trimUpperCase,
} from '../../shared/dtos/transforms.js';
import {
  ASSESSMENT_CONDITION,
  GRADE_FORMULA_LIMITS,
  PERCENT_MESSAGE,
  PERCENT_PATTERN,
  THRESHOLD_MESSAGE,
  THRESHOLD_PATTERN,
  totalAssessmentWeight,
  uncoveredClos,
} from '../../shared/syllabi/grade-formula.rules.js';
import { SYLLABUS_LIMITS } from './syllabus.errors.js';

const NULLABLE_STRING = { nullable: true, type: String } as const;

export class AssessmentComponentInputDto {
  @ApiPropertyOptional({
    description: 'A component of this revision to keep; omit to create',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  id?: string;

  @ApiProperty({ example: 'GK', description: 'Trimmed and upper-cased' })
  @Transform(trimUpperCase)
  @IsString()
  @Length(1, GRADE_FORMULA_LIMITS.CODE_MAX)
  componentCode!: string;

  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @Length(1, GRADE_FORMULA_LIMITS.NAME_MAX)
  componentName!: string;

  @ApiProperty({ example: '30', description: 'Percent, above 0 up to 100' })
  @IsString()
  @Matches(PERCENT_PATTERN, { message: PERCENT_MESSAGE })
  weight!: string;

  @ApiPropertyOptional(NULLABLE_STRING)
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(GRADE_FORMULA_LIMITS.FORM_MAX)
  assessmentForm?: string | null;

  @ApiProperty() @IsBoolean() isConditional!: boolean;

  @ApiPropertyOptional({
    ...NULLABLE_STRING,
    description: 'Required when conditional; dropped otherwise',
  })
  @IsOptional()
  @IsString()
  @Matches(THRESHOLD_PATTERN, { message: THRESHOLD_MESSAGE })
  conditionThreshold?: string | null;

  @ApiPropertyOptional(NULLABLE_STRING)
  @IsOptional()
  @IsString()
  @Matches(THRESHOLD_PATTERN, { message: THRESHOLD_MESSAGE })
  failingScore?: string | null;
}

export class ReplaceGradeFormulaDto {
  @ApiProperty({
    description: 'updatedAt of the revision the form was loaded from',
  })
  @IsISO8601()
  expectedUpdatedAt!: string;

  @ApiProperty(NULLABLE_STRING)
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @Matches(THRESHOLD_PATTERN, { message: THRESHOLD_MESSAGE })
  failingScore!: string | null;

  @ApiProperty({ type: [AssessmentComponentInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(GRADE_FORMULA_LIMITS.COMPONENTS_MAX)
  @ValidateNested({ each: true })
  @Type(() => AssessmentComponentInputDto)
  components!: AssessmentComponentInputDto[];
}

export class AssessmentMappingInputDto {
  @ApiProperty() @IsString() @IsNotEmpty() assessmentComponentId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() cloId!: string;

  @ApiPropertyOptional(NULLABLE_STRING)
  @IsOptional()
  @IsString()
  @Matches(PERCENT_PATTERN, { message: PERCENT_MESSAGE })
  cloWeight?: string | null;
}

export class ReplaceAssessmentMappingsDto {
  @ApiProperty({
    description: 'updatedAt of the revision the grid was loaded from',
  })
  @IsISO8601()
  expectedUpdatedAt!: string;

  @ApiProperty({ type: [AssessmentMappingInputDto] })
  @IsArray()
  @ArrayMaxSize(GRADE_FORMULA_LIMITS.COMPONENTS_MAX * SYLLABUS_LIMITS.CLOS_MAX)
  @ValidateNested({ each: true })
  @Type(() => AssessmentMappingInputDto)
  mappings!: AssessmentMappingInputDto[];
}

export class AssessmentCloMappingDto {
  @ApiProperty() cloId!: string;
  @ApiProperty({
    ...NULLABLE_STRING,
    description: 'Percent; null is still a mapped cell',
  })
  cloWeight!: string | null;
}

export class AssessmentComponentDto {
  @ApiProperty() id!: string;
  @ApiProperty() componentCode!: string;
  @ApiProperty() componentName!: string;
  @ApiProperty({ example: '30' }) weight!: string;
  @ApiProperty({ nullable: true, type: String }) assessmentForm!: string | null;
  @ApiProperty() isConditional!: boolean;
  @ApiProperty(NULLABLE_STRING) conditionThreshold!: string | null;
  @ApiProperty(NULLABLE_STRING) failingScore!: string | null;
  @ApiProperty({ type: [AssessmentCloMappingDto] })
  mappings!: AssessmentCloMappingDto[];
}

export const ASSESSMENT_WARNING_CODES = [
  ASSESSMENT_CONDITION.CLO_UNCOVERED,
] as const;

export class AssessmentWarningDto {
  @ApiProperty({
    enum: ASSESSMENT_WARNING_CODES,
    enumName: 'AssessmentWarningCode',
  })
  code!: (typeof ASSESSMENT_WARNING_CODES)[number];
  @ApiProperty() cloId!: string;
  @ApiProperty() cloCode!: string;
  @ApiProperty() message!: string;
}

export class GradeFormulaDto {
  @ApiProperty(NULLABLE_STRING) failingScore!: string | null;
  @ApiProperty({
    example: '100',
    description: "Sum of the components' weights",
  })
  totalWeight!: string;
  @ApiProperty({ type: [AssessmentComponentDto] })
  components!: AssessmentComponentDto[];
  @ApiProperty({
    type: [AssessmentWarningDto],
    description: 'One per CLO that no component assesses, in CLO order',
  })
  warnings!: AssessmentWarningDto[];
}

export const ASSESSMENT_INCLUDE = {
  mappings: { orderBy: [{ clo: { sortOrder: 'asc' } }, { id: 'asc' }] },
} as const satisfies Prisma.AssessmentComponentInclude;
export type AssessmentComponentRow = Prisma.AssessmentComponentGetPayload<{
  include: typeof ASSESSMENT_INCLUDE;
}>;

export const ASSESSMENT_COMPONENT_ORDER = [
  { componentCode: 'asc' },
  { id: 'asc' },
] as const;

export const GRADE_FORMULA_SELECT = {
  failingScore: true,
  clos: {
    select: { id: true, cloCode: true, sortOrder: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  },
  assessmentComponents: {
    include: ASSESSMENT_INCLUDE,
    orderBy: [...ASSESSMENT_COMPONENT_ORDER],
  },
} as const satisfies Prisma.SyllabusSelect;

export interface GradeFormulaRow {
  failingScore: Prisma.Decimal | null;
  clos: readonly { id: string; cloCode: string; sortOrder: number }[];
  assessmentComponents: readonly AssessmentComponentRow[];
}

const wire = (value: Prisma.Decimal | null): string | null =>
  value === null ? null : toWireDecimal(value);

export function toAssessmentComponentDto(
  row: AssessmentComponentRow,
): AssessmentComponentDto {
  return {
    id: row.id,
    componentCode: row.componentCode,
    componentName: row.componentName,
    weight: toWireDecimal(row.weight),
    assessmentForm: row.assessmentForm,
    isConditional: row.isConditional,
    conditionThreshold: wire(row.conditionThreshold),
    failingScore: wire(row.failingScore),
    mappings: row.mappings.map((mapping) => ({
      cloId: mapping.cloId,
      cloWeight: wire(mapping.cloWeight),
    })),
  };
}

// Warnings come from the row's own CLOs and links, so a pinned or request-copy revision reports its own coverage.
export function toGradeFormulaDto(row: GradeFormulaRow): GradeFormulaDto {
  const uncovered = uncoveredClos({
    failingScore: row.failingScore,
    clos: row.clos,
    assessmentComponents: row.assessmentComponents,
  });
  return {
    failingScore: wire(row.failingScore),
    totalWeight: toWireDecimal(totalAssessmentWeight(row.assessmentComponents)),
    components: row.assessmentComponents.map(toAssessmentComponentDto),
    warnings: uncovered.map((clo) => ({
      code: ASSESSMENT_CONDITION.CLO_UNCOVERED,
      cloId: clo.id,
      cloCode: clo.cloCode,
      message: `${clo.cloCode} chưa được thành phần đánh giá nào ánh xạ; cần bao phủ trước khi gửi duyệt hoặc ban hành.`,
    })),
  };
}
