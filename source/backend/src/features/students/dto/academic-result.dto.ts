import { ApiProperty } from '@nestjs/swagger';
import {
  AcademicResultStatus,
  StudentDataSource,
} from '../../../generated/prisma/client.js';
import { SemesterDto } from '../../../shared/releases/semester.dto.js';

export class StudentResultCourseDto {
  @ApiProperty() id!: string;
  @ApiProperty() courseCode!: string;
  @ApiProperty() courseName!: string;
}

export class AcademicResultDto {
  @ApiProperty() id!: string;
  @ApiProperty() studentId!: string;
  @ApiProperty({ type: StudentResultCourseDto })
  course!: StudentResultCourseDto;
  @ApiProperty({ type: SemesterDto }) semester!: SemesterDto;
  @ApiProperty({ type: String, nullable: true }) score10!: string | null;
  @ApiProperty({ type: String, nullable: true }) score4!: string | null;
  @ApiProperty({ type: String, nullable: true }) letterGrade!: string | null;
  @ApiProperty({ enum: AcademicResultStatus, enumName: 'AcademicResultStatus' })
  status!: AcademicResultStatus;
  @ApiProperty({ enum: StudentDataSource, enumName: 'StudentDataSource' })
  dataSource!: StudentDataSource;
  @ApiProperty() revision!: number;
  @ApiProperty() updatedAt!: string;
}

export class AcademicResultPageDto {
  @ApiProperty({ type: [AcademicResultDto] }) items!: AcademicResultDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}
