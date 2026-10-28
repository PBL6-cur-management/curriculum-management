import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { STUDENT_LIMITS } from '../../../shared/students/student.constants.js';

export const STUDENT_ENROLLMENT_OPERATIONS = [
  'ASSIGN_EXCEPTION',
  'TRANSFER',
  'ADD_SECOND_MAJOR',
] as const;
export type StudentEnrollmentOperation =
  (typeof STUDENT_ENROLLMENT_OPERATIONS)[number];

const ID_MAX = 64;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// TRANSFER needs sourceEnrollmentId and expectedEnrollmentUpdatedAt while the other operations refuse them; that rule lives in the enrollment writer, not in decorators.
export class StudentEnrollmentCommandDto {
  @ApiProperty({ enum: STUDENT_ENROLLMENT_OPERATIONS })
  @IsIn(STUDENT_ENROLLMENT_OPERATIONS)
  operation!: StudentEnrollmentOperation;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(ID_MAX)
  targetVersionId!: string;
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(ID_MAX)
  fromSemesterId!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(STUDENT_LIMITS.BASIS_MAX)
  basisDecision!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(ID_MAX)
  sourceEnrollmentId?: string;

  @ApiProperty() @IsISO8601() expectedStudentUpdatedAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  expectedEnrollmentUpdatedAt?: string;
}

export class ReconcileStudentDto {
  @ApiProperty() @IsISO8601() expectedStudentUpdatedAt!: string;
}
