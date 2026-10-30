import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import {
  AttachmentFileType,
  SyllabusMaterialKind,
} from '../../generated/prisma/client.js';
import { UserRefDto } from '../../shared/dtos/ref.dto.js';

// The validated body: `file` stays out, or the whitelist rejects the empty field the class declares.
export class UploadAttachmentDto {
  @ApiProperty({ enum: SyllabusMaterialKind, enumName: 'SyllabusMaterialKind' })
  @IsEnum(SyllabusMaterialKind)
  materialKind!: SyllabusMaterialKind;
}

export class UploadAttachmentFormDto extends UploadAttachmentDto {
  @ApiProperty({ type: 'string', format: 'binary' }) file!: unknown;
}

export class AttachmentRulesDto {
  @ApiProperty() maxBytes!: number;
  @ApiProperty({
    enum: AttachmentFileType,
    enumName: 'AttachmentFileType',
    isArray: true,
  })
  fileTypes!: AttachmentFileType[];
}

export class SyllabusAttachmentDto {
  @ApiProperty({ enum: SyllabusMaterialKind, enumName: 'SyllabusMaterialKind' })
  materialKind!: SyllabusMaterialKind;
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'Original name, UTF-8 decoded' })
  fileName!: string;
  @ApiProperty({ enum: AttachmentFileType, enumName: 'AttachmentFileType' })
  fileType!: AttachmentFileType;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty({ type: UserRefDto }) uploadedBy!: UserRefDto;
  @ApiProperty() recordedAt!: string;
  @ApiProperty() canDelete!: boolean;
}

export interface AttachmentRow {
  materialKind: SyllabusMaterialKind;
  id: string;
  fileName: string;
  fileType: AttachmentFileType;
  sizeBytes: number;
  recordedAt: Date;
  uploadedBy: { id: string; fullName: string };
}

export function toAttachmentDto(
  row: AttachmentRow,
  canDelete: boolean,
): SyllabusAttachmentDto {
  return {
    materialKind: row.materialKind,
    id: row.id,
    fileName: row.fileName,
    fileType: row.fileType,
    sizeBytes: row.sizeBytes,
    uploadedBy: row.uploadedBy,
    recordedAt: row.recordedAt.toISOString(),
    canDelete,
  };
}
