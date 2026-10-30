import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  SchoolMappingKind,
  SchoolSyncCadence,
  SchoolSyncMode,
  SchoolSyncProfile,
  SchoolSyncStatus,
} from '../../../generated/prisma/client.js';
import { trimString } from '../../../shared/dtos/transforms.js';
import { PageQueryDto } from '../../../shared/pagination/page-query.dto.js';
import { SCHOOL_SYNC_LIMITS } from '../school-sync.constants.js';

const LOCAL_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const CODE = /^[\p{L}\p{N}._\-/ ]+$/u;

export class SaveSyncConfigurationDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) revision!: number;

  @ApiProperty({ enum: SchoolSyncMode, enumName: 'SchoolSyncMode' })
  @IsEnum(SchoolSyncMode)
  mode!: SchoolSyncMode;

  @ApiProperty({ enum: SchoolSyncProfile, enumName: 'SchoolSyncProfile' })
  @IsEnum(SchoolSyncProfile)
  profile!: SchoolSyncProfile;

  @ApiProperty() @IsBoolean() enabled!: boolean;

  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @Length(1, SCHOOL_SYNC_LIMITS.CODE_MAX)
  @Matches(CODE)
  sourceIdentity!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, SCHOOL_SYNC_LIMITS.HOST_MAX)
  @Matches(/^[A-Za-z0-9.-]+$/, { message: 'host is a server name, not a URL' })
  host?: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, SCHOOL_SYNC_LIMITS.NAME_MAX)
  @Matches(/^[A-Za-z0-9_]+$/)
  database?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, SCHOOL_SYNC_LIMITS.NAME_MAX)
  username?: string | null;

  // Absent keeps the saved password; a value replaces it. It is never sent back.
  @ApiPropertyOptional({ writeOnly: true })
  @IsOptional()
  @IsString()
  @Length(1, SCHOOL_SYNC_LIMITS.PASSWORD_MAX)
  password?: string;

  @ApiProperty({ enum: SchoolSyncCadence, enumName: 'SchoolSyncCadence' })
  @IsEnum(SchoolSyncCadence)
  cadence!: SchoolSyncCadence;

  @ApiProperty({ example: '02:00' }) @Matches(LOCAL_TIME) localTime!: string;

  @ApiPropertyOptional({ nullable: true, type: Number, minimum: 1, maximum: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  weekday?: number | null;
}

export class TestSyncConnectionDto {
  // The revision the operator is looking at; a newer saved configuration makes the test stale.
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) configurationRevision!: number;
}

export class SyncMappingInputDto {
  @ApiProperty({ enum: SchoolMappingKind, enumName: 'SchoolMappingKind' })
  @IsEnum(SchoolMappingKind)
  kind!: SchoolMappingKind;

  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @Length(1, SCHOOL_SYNC_LIMITS.CODE_MAX)
  sourceCode!: string;

  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @Length(1, SCHOOL_SYNC_LIMITS.CODE_MAX)
  targetCode!: string;
}

export class SaveSyncMappingsDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) revision!: number;

  @ApiProperty({ type: [SyncMappingInputDto] })
  @IsArray()
  @ArrayMaxSize(SCHOOL_SYNC_LIMITS.MAX_MAPPINGS)
  @ValidateNested({ each: true })
  @Type(() => SyncMappingInputDto)
  items!: SyncMappingInputDto[];
}

export class SyncReferenceQueryDto extends PageQueryDto {
  @ApiProperty({ enum: SchoolMappingKind, enumName: 'SchoolMappingKind' })
  @IsEnum(SchoolMappingKind)
  kind!: SchoolMappingKind;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(0, SCHOOL_SYNC_LIMITS.CODE_MAX)
  q?: string;
}

export class StartSyncRunDto {
  // Repeating the same id returns the same run instead of starting another.
  @ApiProperty({ format: 'uuid' }) @IsUUID() requestId!: string;
}

export class SyncRunQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: SchoolSyncStatus, enumName: 'SchoolSyncStatus' })
  @IsOptional()
  @IsEnum(SchoolSyncStatus)
  status?: SchoolSyncStatus;

  @ApiPropertyOptional({ format: 'date-time', description: 'Inclusive' })
  @IsOptional()
  @IsISO8601({ strict: true })
  startedFrom?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'Exclusive' })
  @IsOptional()
  @IsISO8601({ strict: true })
  startedTo?: string;
}
