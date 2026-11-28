import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  CREDITS_MESSAGE,
  CREDITS_PATTERN,
  toWireDecimal,
} from '../../shared/decimal/decimal.js';
import { emptyToNull, trimString } from '../../shared/dtos/transforms.js';

export const TRACK_LIMITS = {
  CODE_MAX: 30,
  NAME_MAX: 200,
  DESC_MAX: 1000,
} as const;

export class ProgramTrackRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() trackCode!: string;
  @ApiProperty() trackName!: string;
}

export class ProgramTrackDto extends ProgramTrackRefDto {
  @ApiProperty({ nullable: true, type: String }) englishName!: string | null;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty({ nullable: true, type: String })
  compulsoryCredits!: string | null;
  @ApiProperty({ nullable: true, type: String })
  electiveCredits!: string | null;
  @ApiProperty() itemCount!: number;
  @ApiProperty() studentCount!: number;
}

export class CreateProgramTrackDto {
  @ApiProperty({ maxLength: TRACK_LIMITS.CODE_MAX, example: 'CNPM' })
  @Transform(trimString)
  @IsString()
  @Length(1, TRACK_LIMITS.CODE_MAX)
  trackCode!: string;

  @ApiProperty({ maxLength: TRACK_LIMITS.NAME_MAX, example: 'Công nghệ phần mềm' })
  @Transform(trimString)
  @IsString()
  @Length(1, TRACK_LIMITS.NAME_MAX)
  trackName!: string;

  @ApiPropertyOptional({ maxLength: TRACK_LIMITS.NAME_MAX, nullable: true, type: String })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(TRACK_LIMITS.NAME_MAX)
  englishName?: string | null;

  @ApiPropertyOptional({ maxLength: TRACK_LIMITS.DESC_MAX, nullable: true, type: String })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(TRACK_LIMITS.DESC_MAX)
  description?: string | null;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ nullable: true, type: String, example: '8' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @Matches(CREDITS_PATTERN, { message: CREDITS_MESSAGE })
  compulsoryCredits?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: '6' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @Matches(CREDITS_PATTERN, { message: CREDITS_MESSAGE })
  electiveCredits?: string | null;
}

export class UpdateProgramTrackDto extends PartialType(CreateProgramTrackDto) {}

export const TRACK_INCLUDE = {
  _count: { select: { curriculumItems: true, enrollments: true } },
} as const satisfies Prisma.ProgramTrackInclude;

export type TrackRow = Prisma.ProgramTrackGetPayload<{
  include: typeof TRACK_INCLUDE;
}>;

export function toProgramTrackDto(row: TrackRow): ProgramTrackDto {
  return {
    id: row.id,
    trackCode: row.trackCode,
    trackName: row.trackName,
    englishName: row.englishName,
    description: row.description,
    sortOrder: row.sortOrder,
    compulsoryCredits:
      row.compulsoryCredits === null
        ? null
        : toWireDecimal(row.compulsoryCredits),
    electiveCredits:
      row.electiveCredits === null ? null : toWireDecimal(row.electiveCredits),
    itemCount: row._count.curriculumItems,
    studentCount: row._count.enrollments ?? 0,
  };
}


export enum BulkAssignTrackMode {
  MOVE = 'MOVE',
  COPY = 'COPY',
}

export class BulkAssignTrackItemsDto {
  @ApiProperty({
    type: [String],
    description: 'Danh sách ID dòng CurriculumItem trong phiên bản',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  itemIds!: string[];

  @ApiProperty({
    type: [String],
    description: 'Danh sách ID ProgramTrack đích; mảng rỗng = đưa về Khung chung',
  })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  trackIds!: string[];

  @ApiProperty({ enum: BulkAssignTrackMode, enumName: 'BulkAssignTrackMode' })
  @IsEnum(BulkAssignTrackMode)
  mode!: BulkAssignTrackMode;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Tùy chọn ghi đè trạng thái tự chọn/bắt buộc',
  })
  @IsOptional()
  @IsBoolean()
  isElective?: boolean;
}

export class BulkAssignTrackResultDto {
  @ApiProperty() updated!: number;
  @ApiProperty() created!: number;
  @ApiProperty() skipped!: number;
}