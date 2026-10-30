import { ApiProperty } from '@nestjs/swagger';
import { ProgramVersionStatus } from '../../generated/prisma/client.js';
import {
  HEALTH_CATEGORIES,
  HEALTH_TARGETS,
  PDF_EXPORT_STATES,
  PUBLICATION_RELATIONS,
  type HealthCategory,
  type HealthTarget,
  type PdfExportState,
} from './publication.constants.js';

export class PublicationVersionDto {
  @ApiProperty() id!: string;
  @ApiProperty() programId!: string;
  @ApiProperty() programCode!: string;
  @ApiProperty() programName!: string;
  @ApiProperty({ type: String, nullable: true }) versionNumber!: string | null;
  @ApiProperty({ enum: ProgramVersionStatus, enumName: 'ProgramVersionStatus' })
  status!: ProgramVersionStatus;
  @ApiProperty() semesterCount!: number;
}

export class GraphNodeDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, nullable: true }) itemId!: string | null;
  @ApiProperty() courseId!: string;
  @ApiProperty() courseCode!: string;
  @ApiProperty() courseName!: string;
  @ApiProperty({ type: String, nullable: true }) credits!: string | null;
  @ApiProperty({ type: Number, nullable: true }) semester!: number | null;
  @ApiProperty({ type: Number, nullable: true }) sortOrder!: number | null;
  @ApiProperty({ description: 'Học phần điều kiện nằm ngoài khung' })
  external!: boolean;
}

export class GraphEdgeDto {
  @ApiProperty() id!: string;
  @ApiProperty() source!: string;
  @ApiProperty() target!: string;
  @ApiProperty({ enum: PUBLICATION_RELATIONS, enumName: 'GraphRelationType' })
  relationType!: (typeof PUBLICATION_RELATIONS)[number];
  @ApiProperty({ type: String, nullable: true }) minScore!: string | null;
}

export class CourseGraphDto {
  @ApiProperty({ type: PublicationVersionDto })
  version!: PublicationVersionDto;
  @ApiProperty({ type: [GraphNodeDto] }) nodes!: GraphNodeDto[];
  @ApiProperty({ type: [GraphEdgeDto] }) edges!: GraphEdgeDto[];
}

export class TimelineSemesterDto {
  @ApiProperty() id!: string;
  @ApiProperty() semesterCode!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date' })
  startDate!: string | null;
}

export class TimelineAssignmentDto {
  @ApiProperty() id!: string;
  @ApiProperty() cohortCode!: string;
  @ApiProperty() intakeYear!: number;
  @ApiProperty({ type: TimelineSemesterDto })
  fromSemester!: TimelineSemesterDto;
}

export class TimelineVersionRefDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, nullable: true }) versionNumber!: string | null;
}

export class TimelineEventDto {
  @ApiProperty() versionId!: string;
  @ApiProperty({ type: String, nullable: true }) versionNumber!: string | null;
  @ApiProperty({ enum: ProgramVersionStatus, enumName: 'ProgramVersionStatus' })
  status!: ProgramVersionStatus;
  @ApiProperty({ type: String, nullable: true }) decisionNumber!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  publishedAt!: string | null;
  @ApiProperty({ type: TimelineSemesterDto, nullable: true })
  effectiveSemester!: TimelineSemesterDto | null;
  @ApiProperty({ type: TimelineVersionRefDto, nullable: true })
  previousVersion!: TimelineVersionRefDto | null;
  @ApiProperty({ type: TimelineVersionRefDto, nullable: true })
  correctionOf!: TimelineVersionRefDto | null;
  @ApiProperty({ type: [TimelineAssignmentDto] })
  assignments!: TimelineAssignmentDto[];
}

export class ProgramTimelineDto {
  @ApiProperty() programId!: string;
  @ApiProperty() programCode!: string;
  @ApiProperty() programName!: string;
  @ApiProperty({ type: [TimelineEventDto] }) events!: TimelineEventDto[];
}

export class HealthIssueDto {
  @ApiProperty({ enum: HEALTH_CATEGORIES, enumName: 'HealthCategory' })
  category!: HealthCategory;
  @ApiProperty() code!: string;
  @ApiProperty({ enum: ['ERROR', 'HIGH', 'INFO'], enumName: 'HealthSeverity' })
  severity!: 'ERROR' | 'HIGH' | 'INFO';
  @ApiProperty() message!: string;
  @ApiProperty({ type: Number, nullable: true }) semester!: number | null;
  @ApiProperty({ type: String, nullable: true }) courseCode!: string | null;
  @ApiProperty({ type: String, nullable: true }) itemId!: string | null;
  @ApiProperty({ type: String, nullable: true }) courseId!: string | null;
  @ApiProperty({ enum: HEALTH_TARGETS, enumName: 'HealthTarget' })
  target!: HealthTarget;
}

export class HealthCategoryCountDto {
  @ApiProperty({ enum: HEALTH_CATEGORIES, enumName: 'HealthCategory' })
  category!: HealthCategory;
  @ApiProperty() count!: number;
  @ApiProperty({ description: 'Nhóm kiểm tra này đã chạy được' })
  checked!: boolean;
}

export class ProgramHealthDto {
  @ApiProperty({ type: PublicationVersionDto })
  version!: PublicationVersionDto;
  @ApiProperty() checkedAt!: string;
  @ApiProperty({
    description:
      'false: còn nhóm kiểm tra chưa chạy được — không phải "không có cảnh báo"',
  })
  complete!: boolean;
  @ApiProperty({ type: [HealthCategoryCountDto] })
  categories!: HealthCategoryCountDto[];
  @ApiProperty({ type: [HealthIssueDto] }) issues!: HealthIssueDto[];
  @ApiProperty() errorCount!: number;
  @ApiProperty() warningCount!: number;
}

export class ProgramPdfExportDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: PDF_EXPORT_STATES, enumName: 'PdfExportState' })
  state!: PdfExportState;
  @ApiProperty() programId!: string;
  @ApiProperty() versionId!: string;
  @ApiProperty() fileName!: string;
  @ApiProperty() draft!: boolean;
  @ApiProperty({ format: 'date-time' }) requestedAt!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  expiresAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) failure!: string | null;
}
