import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  CourseType,
  ProgramVersionStatus,
} from '../../../generated/prisma/client.js';

export class ComparisonQueryDto {
  @ApiProperty() @IsString() @IsNotEmpty() leftVersionId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() rightVersionId!: string;
}

export class VersionQueryDto {
  @ApiProperty() @IsString() @IsNotEmpty() versionId!: string;
}

export class StatisticsQueryDto {
  @ApiProperty({
    format: 'date',
    description: 'Ngày tạo đề xuất, từ (bao gồm)',
  })
  @IsDateString()
  from!: string;
  @ApiProperty({
    format: 'date',
    description: 'Ngày tạo đề xuất, đến (bao gồm)',
  })
  @IsDateString()
  to!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() programId?: string;
}

export class ReportVersionRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() programCode!: string;
  @ApiProperty() programName!: string;
  @ApiProperty({ type: String, nullable: true }) versionNumber!: string | null;
  @ApiProperty({ enum: ProgramVersionStatus, enumName: 'ProgramVersionStatus' })
  status!: ProgramVersionStatus;
  @ApiProperty() totalCredits!: string;
}

export class ComparisonSideDto {
  @ApiProperty() plannedSemester!: number;
  @ApiProperty() credits!: string;
  @ApiProperty() isElective!: boolean;
  @ApiProperty({ type: String, nullable: true }) blockSymbol!: string | null;
}

export class ComparisonCourseDto {
  @ApiProperty() courseCode!: string;
  @ApiProperty() courseName!: string;
  @ApiProperty({ type: ComparisonSideDto, nullable: true })
  left!: ComparisonSideDto | null;
  @ApiProperty({ type: ComparisonSideDto, nullable: true })
  right!: ComparisonSideDto | null;
  @ApiProperty({
    type: [String],
    description: 'SEMESTER, CREDITS, ELECTIVE, BLOCK — chỉ với học phần chung',
  })
  differences!: string[];
}

export class ComparisonEquivalentDto {
  @ApiProperty({ type: ComparisonCourseDto }) left!: ComparisonCourseDto;
  @ApiProperty({ type: ComparisonCourseDto }) right!: ComparisonCourseDto;
}

export class ComparisonSummaryDto {
  @ApiProperty() sharedCount!: number;
  @ApiProperty() equivalentCount!: number;
  @ApiProperty() leftOnlyCount!: number;
  @ApiProperty() rightOnlyCount!: number;
  @ApiProperty() sharedCreditsLeft!: string;
  @ApiProperty() sharedCreditsRight!: string;
}

export class ProgramComparisonDto {
  @ApiProperty({ type: ReportVersionRefDto }) left!: ReportVersionRefDto;
  @ApiProperty({ type: ReportVersionRefDto }) right!: ReportVersionRefDto;
  @ApiProperty({ type: ComparisonSummaryDto }) summary!: ComparisonSummaryDto;
  @ApiProperty({ type: [ComparisonCourseDto] }) shared!: ComparisonCourseDto[];
  @ApiProperty({ type: [ComparisonEquivalentDto] })
  equivalent!: ComparisonEquivalentDto[];
  @ApiProperty({ type: [ComparisonCourseDto] })
  leftOnly!: ComparisonCourseDto[];
  @ApiProperty({ type: [ComparisonCourseDto] })
  rightOnly!: ComparisonCourseDto[];
}

export class CreditBucketDto {
  @ApiProperty() key!: string;
  @ApiProperty() label!: string;
  @ApiProperty() compulsory!: string;
  @ApiProperty() elective!: string;
  @ApiProperty() total!: string;
  @ApiProperty() courseCount!: number;
}

export class ElectiveRequirementDto {
  @ApiProperty() groupCode!: string;
  @ApiProperty() groupName!: string;
  @ApiProperty({ type: String, nullable: true }) minCredits!: string | null;
  @ApiProperty({ type: Number, nullable: true }) minCourses!: number | null;
  @ApiProperty() offeredCredits!: string;
}

export class CreditTotalsDto {
  @ApiProperty({
    description: 'Tổng tín chỉ mọi dòng (cả học phần tự chọn được mở)',
  })
  allRows!: string;
  @ApiProperty() compulsory!: string;
  @ApiProperty({ description: 'Tín chỉ tự chọn được mở, không phải yêu cầu' })
  electiveOffered!: string;
  @ApiProperty({ description: 'Bắt buộc + tối thiểu các nhóm tự chọn' })
  required!: string;
  @ApiProperty({ description: 'Tổng tín chỉ công bố của phiên bản' })
  declaredTotal!: string;
  @ApiProperty() declaredCompulsory!: string;
  @ApiProperty() declaredElective!: string;
  @ApiProperty({
    description: 'Có nhóm tự chọn chưa khai báo tối thiểu tín chỉ',
  })
  requiredIsPartial!: boolean;
}

export class CreditDistributionDto {
  @ApiProperty({ type: ReportVersionRefDto }) version!: ReportVersionRefDto;
  @ApiProperty({ type: CreditTotalsDto }) totals!: CreditTotalsDto;
  @ApiProperty({ type: [CreditBucketDto] }) byBlock!: CreditBucketDto[];
  @ApiProperty({ type: [CreditBucketDto] }) bySemester!: CreditBucketDto[];
  @ApiProperty({ type: [CreditBucketDto] }) byCourseType!: CreditBucketDto[];
  @ApiProperty({ type: [ElectiveRequirementDto] })
  electiveGroups!: ElectiveRequirementDto[];
}

export class CountDto {
  @ApiProperty() key!: string;
  @ApiProperty() count!: number;
}

export class LevelTimingDto {
  @ApiProperty() approvalLevel!: number;
  @ApiProperty() visitCount!: number;
  @ApiProperty({ type: Number, nullable: true, description: 'Giờ' })
  averageHours!: number | null;
}

export class ChangeRequestStatisticsDto {
  @ApiProperty() total!: number;
  @ApiProperty({ type: [CountDto] }) byStatus!: CountDto[];
  @ApiProperty({ type: [CountDto] }) byType!: CountDto[];
  @ApiProperty({ type: [CountDto] }) byOrigin!: CountDto[];
  @ApiProperty({ type: [LevelTimingDto] }) levels!: LevelTimingDto[];
  @ApiProperty({ description: 'Toàn bộ, hoặc chỉ trong phạm vi được giao' })
  scoped!: boolean;
}

export const COURSE_TYPES = Object.values(CourseType);
