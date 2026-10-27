import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import {
  DiffRowDto,
  DiffSectionDto,
} from '../../../shared/change-requests/diff/change-diff.dto.js';
import { SemesterDto } from '../../../shared/releases/semester.dto.js';
import { SyllabusPinDto } from './version-detail.dto.js';

export const VERSION_COMPARE_SECTIONS = {
  INFO: 'INFO',
  CURRICULUM: 'CURRICULUM',
  ELECTIVE_GROUPS: 'ELECTIVE_GROUPS',
  PLOS: 'PLOS',
  MATRICES: 'MATRICES',
  SYLLABI: 'SYLLABI',
} as const;
export type VersionCompareSection =
  (typeof VERSION_COMPARE_SECTIONS)[keyof typeof VERSION_COMPARE_SECTIONS];
export const ISSUED_VERSION_STATUSES = [
  'PENDING',
  'ACTIVE',
  'HISTORICAL',
] as const;
export type IssuedVersionStatus = (typeof ISSUED_VERSION_STATUSES)[number];

export class VersionComparisonQueryDto {
  @ApiProperty() @IsString() @IsNotEmpty() beforeVersionId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() afterVersionId!: string;
}
export class IssuedVersionDto {
  @ApiProperty() id!: string;
  @ApiProperty() versionNumber!: string;
  @ApiProperty({
    enum: [...ISSUED_VERSION_STATUSES],
    enumName: 'IssuedVersionStatus',
  })
  status!: IssuedVersionStatus;
  @ApiProperty() decisionNumber!: string;
  @ApiProperty({ type: SemesterDto }) effectiveSemester!: SemesterDto;
}
export class SyllabusComparisonLinkDto {
  @ApiProperty() courseId!: string;
  @ApiProperty() beforeSyllabusId!: string;
  @ApiProperty() afterSyllabusId!: string;
}
export class VersionCompareRowDto extends DiffRowDto {
  @ApiProperty({ type: SyllabusComparisonLinkDto, nullable: true })
  syllabusComparison!: SyllabusComparisonLinkDto | null;
}
export class VersionCompareSectionDto {
  @ApiProperty({
    enum: Object.values(VERSION_COMPARE_SECTIONS),
    enumName: 'VersionCompareSection',
  })
  key!: VersionCompareSection;
  @ApiProperty() title!: string;
  @ApiProperty({ type: [VersionCompareRowDto] }) rows!: VersionCompareRowDto[];
}
export class VersionComparisonDto {
  @ApiProperty() programId!: string;
  @ApiProperty({ type: IssuedVersionDto }) before!: IssuedVersionDto;
  @ApiProperty({ type: IssuedVersionDto }) after!: IssuedVersionDto;
  @ApiProperty({ type: [VersionCompareSectionDto] })
  sections!: VersionCompareSectionDto[];
}
export class PinnedSyllabusComparisonDto {
  @ApiProperty() programId!: string;
  @ApiProperty() courseId!: string;
  @ApiProperty() courseCode!: string;
  @ApiProperty() beforeVersionId!: string;
  @ApiProperty() afterVersionId!: string;
  @ApiProperty({ type: SyllabusPinDto }) before!: SyllabusPinDto;
  @ApiProperty({ type: SyllabusPinDto }) after!: SyllabusPinDto;
  @ApiProperty({ type: [DiffSectionDto] }) sections!: DiffSectionDto[];
}
