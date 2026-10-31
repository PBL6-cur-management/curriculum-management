import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  BACKUP_POLICY,
  BACKUP_RUN_STATUSES,
  BACKUP_STATES,
  DELIVERY_TIERS,
  DRILL_CHECK_CODES,
  DRILL_STATUSES,
  SORT_ORDERS,
  type BackupRunStatus,
  type BackupState,
  type DeliveryTier,
  type DrillCheckCode,
  type DrillStatus,
  type SortOrder,
} from '../../shared/backups/backup.constants.js';
import { PageQueryDto } from '../../shared/pagination/page-query.dto.js';

export class OperationFailureDto {
  @ApiProperty({ description: 'Stable BACKUP_/DRILL_ code' })
  code!: string;

  @ApiProperty({ description: 'Vietnamese cause and next action' })
  message!: string;
}

export class BackupStatusDto {
  @ApiProperty({ enum: BACKUP_STATES, enumName: 'BackupState' })
  state!: BackupState;

  @ApiProperty({ example: BACKUP_POLICY.CRON })
  schedule!: string;

  @ApiProperty({ example: 'Asia/Ho_Chi_Minh' })
  timeZone!: string;

  @ApiProperty({ description: 'Fixed policy: complete sets kept' })
  retentionCount!: number;

  @ApiProperty({ description: 'Complete published sets now on disk' })
  retainedCount!: number;

  @ApiProperty({ description: 'Latest due day (YYYY-MM-DD)' })
  dueSlot!: string;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  lastSuccessfulAt!: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Machine recovery time of the latest accepted drill',
  })
  lastRecoveryMs!: number | null;

  @ApiProperty({
    enum: DELIVERY_TIERS,
    enumName: 'DeliveryTier',
    nullable: true,
  })
  lastAcceptedTier!: DeliveryTier | null;

  @ApiProperty({ type: String, nullable: true })
  currentRunId!: string | null;

  @ApiProperty({ type: OperationFailureDto, nullable: true })
  lastFailure!: OperationFailureDto | null;
}

export class BackupRunDto {
  @ApiProperty({ example: 'daily-2026-10-31' })
  id!: string;

  @ApiProperty({ description: 'Due day, not the snapshot day' })
  scheduledFor!: string;

  @ApiProperty({ enum: BACKUP_RUN_STATUSES, enumName: 'BackupRunStatus' })
  status!: BackupRunStatus;

  @ApiProperty({ format: 'date-time' })
  startedAt!: string;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  completedAt!: string | null;

  @ApiProperty()
  attempt!: number;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  snapshotAt!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Decimal byte count',
  })
  databaseBytes!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Decimal byte count',
  })
  fileBytes!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  fileCount!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  releasedVersionCount!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  durationMs!: number | null;

  @ApiProperty({ type: OperationFailureDto, nullable: true })
  failure!: OperationFailureDto | null;
}

export class DrillCheckDto {
  @ApiProperty({ enum: DRILL_CHECK_CODES, enumName: 'DrillCheckCode' })
  code!: DrillCheckCode;

  @ApiProperty()
  passed!: boolean;

  @ApiProperty()
  message!: string;
}

export class RestoreDrillDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  backupId!: string;

  @ApiProperty({ enum: DELIVERY_TIERS, enumName: 'DeliveryTier' })
  tier!: DeliveryTier;

  @ApiProperty()
  operator!: string;

  @ApiProperty({ enum: DRILL_STATUSES, enumName: 'DrillStatus' })
  status!: DrillStatus;

  @ApiProperty({ format: 'date-time' })
  startedAt!: string;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  completedAt!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  recoveryMs!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  databaseRestoreMs!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  filesRestoreMs!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  verificationMs!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  releasedVersionCount!: number | null;

  @ApiProperty({ type: [DrillCheckDto] })
  checks!: DrillCheckDto[];

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  acceptedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  acceptanceNote!: string | null;

  @ApiProperty({ type: OperationFailureDto, nullable: true })
  failure!: OperationFailureDto | null;
}

export class BackupRunPageDto {
  @ApiProperty({ type: [BackupRunDto] })
  items!: BackupRunDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

export class RestoreDrillPageDto {
  @ApiProperty({ type: [RestoreDrillDto] })
  items!: RestoreDrillDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

class OperationsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ maxLength: BACKUP_POLICY.SEARCH_MAX })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(BACKUP_POLICY.SEARCH_MAX)
  q?: string;

  @ApiPropertyOptional({ enum: SORT_ORDERS, default: 'newest' })
  @IsOptional()
  @IsIn(SORT_ORDERS)
  sort?: SortOrder;
}

export class BackupListQueryDto extends OperationsQueryDto {
  @ApiPropertyOptional({
    enum: BACKUP_RUN_STATUSES,
    enumName: 'BackupRunStatus',
  })
  @IsOptional()
  @IsIn(BACKUP_RUN_STATUSES)
  status?: BackupRunStatus;
}

export class DrillListQueryDto extends OperationsQueryDto {
  @ApiPropertyOptional({ enum: DELIVERY_TIERS, enumName: 'DeliveryTier' })
  @IsOptional()
  @IsIn(DELIVERY_TIERS)
  tier?: DeliveryTier;

  @ApiPropertyOptional({ enum: DRILL_STATUSES, enumName: 'DrillStatus' })
  @IsOptional()
  @IsIn(DRILL_STATUSES)
  status?: DrillStatus;
}
