import { ApiProperty } from '@nestjs/swagger';
import type { Cohort, Semester } from '../../generated/prisma/client.js';
import { toIsoDay } from '../time/today.js';

export class SemesterDto {
  @ApiProperty() id!: string;
  @ApiProperty() semesterCode!: string;
  @ApiProperty() academicYear!: string;
  @ApiProperty() termInYear!: number;
  @ApiProperty({ nullable: true, type: String, format: 'date' })
  startDate!: string | null;
  @ApiProperty({
    description:
      'The start date is an estimate (the school calendar has none for this term), not an official date',
  })
  startDateEstimated!: boolean;
}

export class CohortDto {
  @ApiProperty() id!: string;
  @ApiProperty() cohortCode!: string;
  @ApiProperty() intakeYear!: number;
}

export function toSemesterDto(row: Semester): SemesterDto {
  return {
    id: row.id,
    semesterCode: row.semesterCode,
    academicYear: row.academicYear,
    termInYear: row.termInYear,
    startDate: row.startDate ? toIsoDay(row.startDate) : null,
    startDateEstimated: row.startDateEstimated,
  };
}

export function toCohortDto(row: Cohort): CohortDto {
  return {
    id: row.id,
    cohortCode: row.cohortCode,
    intakeYear: row.intakeYear,
  };
}
