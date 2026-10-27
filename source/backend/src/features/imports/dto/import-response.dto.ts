import { ApiProperty } from '@nestjs/swagger';
import {
  ImportBatchStatus,
  ImportType,
} from '../../../generated/prisma/client.js';
import { UserRefDto } from '../../../shared/dtos/ref.dto.js';
import {
  WARNING_SEVERITY,
  type WarningSeverity,
} from '../../../shared/curriculum/curriculum-warnings.js';

export class ImportTypeOptionDto {
  @ApiProperty({ enum: ImportType, enumName: 'ImportType' })
  importType!: ImportType;
  @ApiProperty() needsVersion!: boolean;
}
export class ImportTargetDto {
  @ApiProperty() versionId!: string;
  @ApiProperty() programId!: string;
  @ApiProperty() programCode!: string;
  @ApiProperty() programName!: string;
}
export class ImportProgramDto {
  @ApiProperty() id!: string;
  @ApiProperty() programCode!: string;
  @ApiProperty() programName!: string;
}
export class ImportIssueDto {
  @ApiProperty({ type: Number, nullable: true }) rowNumber!: number | null;
  @ApiProperty({
    enum: Object.values(WARNING_SEVERITY),
    enumName: 'WarningSeverity',
  })
  severity!: WarningSeverity;
  @ApiProperty() code!: string;
  @ApiProperty({ type: String, nullable: true }) column!: string | null;
  @ApiProperty() message!: string;
}
export class ImportFormatErrorDto {
  @ApiProperty({ type: String, nullable: true }) column!: string | null;
  @ApiProperty() message!: string;
}
export class ImportReportDto {
  @ApiProperty({ type: [ImportFormatErrorDto] })
  formatErrors!: ImportFormatErrorDto[];
  @ApiProperty({ type: [ImportIssueDto] }) issues!: ImportIssueDto[];
}
export class ImportBatchSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ImportType, enumName: 'ImportType' })
  importType!: ImportType;
  @ApiProperty() fileName!: string;
  @ApiProperty({ type: UserRefDto }) performedBy!: UserRefDto;
  @ApiProperty({ type: ImportProgramDto, nullable: true })
  program!: ImportProgramDto | null;
  @ApiProperty({ type: String, nullable: true }) versionId!: string | null;
  @ApiProperty() totalRows!: number;
  @ApiProperty() successRows!: number;
  @ApiProperty() errorRows!: number;
  @ApiProperty({ enum: ImportBatchStatus, enumName: 'ImportBatchStatus' })
  status!: ImportBatchStatus;
  @ApiProperty({ format: 'date-time' }) recordedAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  finishedAt!: string | null;
}
export class ImportBatchDetailDto extends ImportBatchSummaryDto {
  @ApiProperty({ type: ImportReportDto, nullable: true })
  report!: ImportReportDto | null;
  @ApiProperty() canCommit!: boolean;
  @ApiProperty() fileAvailable!: boolean;
}
export class ImportBatchPageDto {
  @ApiProperty({ type: [ImportBatchSummaryDto] })
  items!: ImportBatchSummaryDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}
