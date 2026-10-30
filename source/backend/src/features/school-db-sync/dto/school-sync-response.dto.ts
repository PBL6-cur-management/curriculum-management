import { ApiProperty } from '@nestjs/swagger';
import {
  SchoolConflictEntity,
  SchoolMappingKind,
  SchoolSyncCadence,
  SchoolSyncMode,
  SchoolSyncProfile,
  SchoolSyncStatus,
  SchoolSyncTrigger,
} from '../../../generated/prisma/client.js';
import { SYNC_FAILURE } from '../school-sync.errors.js';

export const CONNECTION_TEST_CODES = [
  'CONNECTED',
  'CONNECTION_FAILED',
  'READ_ONLY_REQUIRED',
  'SOURCE_CONTRACT_INVALID',
  'CONNECTOR_UNAVAILABLE',
] as const satisfies readonly ('CONNECTED' | keyof typeof SYNC_FAILURE)[];
export type ConnectionTestCode = (typeof CONNECTION_TEST_CODES)[number];

export class SyncConfigurationDto {
  @ApiProperty() id!: string;
  @ApiProperty() revision!: number;
  @ApiProperty({ enum: SchoolSyncMode, enumName: 'SchoolSyncMode' }) mode!: SchoolSyncMode;
  @ApiProperty({ enum: SchoolSyncProfile, enumName: 'SchoolSyncProfile' }) profile!: SchoolSyncProfile;
  @ApiProperty() enabled!: boolean;
  @ApiProperty() sourceIdentity!: string;
  @ApiProperty({ nullable: true, type: String }) host!: string | null;
  @ApiProperty({ nullable: true, type: Number }) port!: number | null;
  @ApiProperty({ nullable: true, type: String }) database!: string | null;
  @ApiProperty({ nullable: true, type: String }) username!: string | null;
  @ApiProperty() passwordConfigured!: boolean;
  @ApiProperty() connectionRevision!: number;
  @ApiProperty({ nullable: true, type: Number }) verifiedConnectionRevision!: number | null;
  @ApiProperty({ enum: SchoolSyncCadence, enumName: 'SchoolSyncCadence' }) cadence!: SchoolSyncCadence;
  @ApiProperty() localTime!: string;
  @ApiProperty({ nullable: true, type: Number }) weekday!: number | null;
  @ApiProperty({ enum: ['Asia/Ho_Chi_Minh'] }) timeZone!: 'Asia/Ho_Chi_Minh';
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) nextRunAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) lastSuccessfulRunId!: string | null;
  @ApiProperty({ nullable: true, type: String }) lastSnapshotVersion!: string | null;
  @ApiProperty({ nullable: true, type: String }) activeRunId!: string | null;
  @ApiProperty() externalAllowed!: boolean;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class SyncConnectionTestDto {
  @ApiProperty() success!: boolean;
  @ApiProperty({ enum: CONNECTION_TEST_CODES, enumName: 'SyncConnectionTestCode' })
  code!: ConnectionTestCode;
  @ApiProperty() message!: string;
  @ApiProperty({ format: 'date-time' }) testedAt!: string;
  @ApiProperty() configurationRevision!: number;
}

export class SyncMappingDto {
  @ApiProperty({ enum: SchoolMappingKind, enumName: 'SchoolMappingKind' }) kind!: SchoolMappingKind;
  @ApiProperty() sourceCode!: string;
  @ApiProperty() targetCode!: string;
}

export class SyncMappingSetDto {
  @ApiProperty() revision!: number;
  @ApiProperty({ type: [SyncMappingDto] }) items!: SyncMappingDto[];
}

export class SyncReferenceOptionDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ nullable: true, type: String, format: 'date' }) startDate!: string | null;
}

export class SyncReferencePageDto {
  @ApiProperty({ type: [SyncReferenceOptionDto] }) items!: SyncReferenceOptionDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class SyncRunDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['SCHOOL_DB'] }) dataSource!: 'SCHOOL_DB';
  @ApiProperty({ enum: SchoolSyncProfile, enumName: 'SchoolSyncProfile' }) profile!: SchoolSyncProfile;
  @ApiProperty({ enum: SchoolSyncTrigger, enumName: 'SchoolSyncTrigger' }) trigger!: SchoolSyncTrigger;
  @ApiProperty({ nullable: true, type: String }) retryOfId!: string | null;
  @ApiProperty({ enum: SchoolSyncStatus, enumName: 'SchoolSyncStatus' }) status!: SchoolSyncStatus;
  @ApiProperty({ format: 'date-time' }) startedAt!: string;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) finishedAt!: string | null;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty() configurationRevision!: number;
  @ApiProperty({ nullable: true, type: String }) snapshotVersion!: string | null;
  @ApiProperty() recordCount!: number;
  @ApiProperty() studentCount!: number;
  @ApiProperty() resultCount!: number;
  @ApiProperty() classCount!: number;
  @ApiProperty() changedCount!: number;
  @ApiProperty() conflictCount!: number;
  @ApiProperty({ nullable: true, type: String }) errorCode!: string | null;
  @ApiProperty({ nullable: true, type: String }) errorMessage!: string | null;
  @ApiProperty() canRetry!: boolean;
}

export class SyncRunPageDto {
  @ApiProperty({ type: [SyncRunDto] }) items!: SyncRunDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class SyncConflictValueDto {
  @ApiProperty() field!: string;
  @ApiProperty({ nullable: true, type: String }) value!: string | null;
}

export class SyncConflictDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: SchoolConflictEntity, enumName: 'SchoolConflictEntity' }) entityType!: SchoolConflictEntity;
  @ApiProperty() recordKey!: string;
  @ApiProperty({ enum: ['EXCEL'] }) previousSource!: 'EXCEL';
  @ApiProperty({ enum: ['SCHOOL_DB'] }) selectedSource!: 'SCHOOL_DB';
  @ApiProperty({ type: [String] }) fields!: string[];
  @ApiProperty({ type: [SyncConflictValueDto] }) before!: SyncConflictValueDto[];
  @ApiProperty({ type: [SyncConflictValueDto] }) after!: SyncConflictValueDto[];
}

export class SyncConflictPageDto {
  @ApiProperty({ type: [SyncConflictDto] }) items!: SyncConflictDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}
