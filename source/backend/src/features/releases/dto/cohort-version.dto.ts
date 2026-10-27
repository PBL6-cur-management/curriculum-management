import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsString,
  Matches,
} from 'class-validator';
import {
  CohortDto,
  SemesterDto,
} from '../../../shared/releases/semester.dto.js';
import { IssuedVersionDto } from './version-comparison.dto.js';

export const COHORT_ASSIGNMENT_LIMITS = {
  COHORTS_MAX: 50,
  REVISION_LENGTH: 64,
} as const;
export const ASSIGNMENT_REVISION_PATTERN = new RegExp(
  `^[a-f0-9]{${COHORT_ASSIGNMENT_LIMITS.REVISION_LENGTH}}$`,
);
export const APPLIED_VERSION_STATES = ['ASSIGNED', 'UNASSIGNED'] as const;

export class AssignCohortVersionsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(COHORT_ASSIGNMENT_LIMITS.COHORTS_MAX)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  cohortIds!: string[];
  @ApiProperty() @IsString() @IsNotEmpty() programVersionId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() fromSemesterId!: string;
  @ApiProperty()
  @Matches(ASSIGNMENT_REVISION_PATTERN)
  expectedRevision!: string;
}
export class UpdateCohortVersionDto {
  @ApiProperty() @IsString() @IsNotEmpty() fromSemesterId!: string;
  @ApiProperty()
  @Matches(ASSIGNMENT_REVISION_PATTERN)
  expectedRevision!: string;
}
export class AppliedVersionQueryDto {
  @ApiProperty() @IsString() @IsNotEmpty() semesterId!: string;
}
export class CohortVersionAssignmentDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: CohortDto }) cohort!: CohortDto;
  @ApiProperty({ type: IssuedVersionDto }) version!: IssuedVersionDto;
  @ApiProperty({ type: SemesterDto }) fromSemester!: SemesterDto;
  @ApiProperty() createdAt!: string;
}
export class CohortVersionListDto {
  @ApiProperty() programId!: string;
  @ApiProperty() revision!: string;
  @ApiProperty({ type: [CohortVersionAssignmentDto] })
  assignments!: CohortVersionAssignmentDto[];
}
export class AppliedCohortVersionDto {
  @ApiProperty() programId!: string;
  @ApiProperty({ type: CohortDto }) cohort!: CohortDto;
  @ApiProperty({ type: SemesterDto }) semester!: SemesterDto;
  @ApiProperty({
    enum: [...APPLIED_VERSION_STATES],
    enumName: 'AppliedVersionState',
  })
  state!: 'ASSIGNED' | 'UNASSIGNED';
  @ApiProperty({ type: CohortVersionAssignmentDto, nullable: true })
  assignment!: CohortVersionAssignmentDto | null;
}
