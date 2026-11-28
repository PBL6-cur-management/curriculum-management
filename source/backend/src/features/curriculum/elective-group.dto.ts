import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';
import { Prisma } from '../../generated/prisma/client.js';
import {
  CREDITS_MESSAGE,
  CREDITS_PATTERN,
  toWireDecimal,
} from '../../shared/decimal/decimal.js';
import { emptyToNull, trimString } from '../../shared/dtos/transforms.js';
import { rowCredits } from '../../shared/curriculum/row-course.js';
import { CURRICULUM_LIMITS } from './create-curriculum-item.dto.js';

export class CreateElectiveGroupDto {
  @ApiProperty({ maxLength: CURRICULUM_LIMITS.GROUP_CODE_MAX })
  @Transform(trimString)
  @IsString()
  @Length(1, CURRICULUM_LIMITS.GROUP_CODE_MAX)
  groupCode!: string;

  @ApiProperty({ maxLength: CURRICULUM_LIMITS.GROUP_NAME_MAX })
  @Transform(trimString)
  @IsString()
  @Length(1, CURRICULUM_LIMITS.GROUP_NAME_MAX)
  groupName!: string;

  @ApiPropertyOptional({ nullable: true, type: String, example: '6' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @Matches(CREDITS_PATTERN, { message: CREDITS_MESSAGE })
  minCredits?: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minCourses?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Định hướng / chuyên ngành con (null = tự chọn chung).',
  })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  trackId?: string | null;
}

export class UpdateElectiveGroupDto extends PartialType(
  CreateElectiveGroupDto,
) {}

export class AssignGroupItemsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(CURRICULUM_LIMITS.ITEMS_MAX)
  @ArrayUnique()
  @IsString({ each: true })
  itemIds!: string[];
}

export class ElectiveGroupDto {
  @ApiProperty() id!: string;
  @ApiProperty() groupCode!: string;
  @ApiProperty() groupName!: string;
  @ApiProperty({ nullable: true, type: String }) trackId!: string | null;
  @ApiProperty({ nullable: true, type: String }) minCredits!: string | null;
  @ApiProperty({ nullable: true, type: Number }) minCourses!: number | null;
  @ApiProperty({ type: [String] }) itemIds!: string[];
  @ApiProperty({ example: '15' }) listedCredits!: string;
  @ApiProperty() itemCount!: number;
}

export const GROUP_INCLUDE = {
  items: {
    select: {
      id: true,
      creditsSnapshot: true,
      course: { select: { credits: true } },
    },
    orderBy: [{ plannedSemester: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
  },
} as const satisfies Prisma.ElectiveGroupInclude;

export type GroupRow = Prisma.ElectiveGroupGetPayload<{
  include: typeof GROUP_INCLUDE;
}>;

export function toElectiveGroupDto(row: GroupRow): ElectiveGroupDto {
  return {
    id: row.id,
    groupCode: row.groupCode,
    groupName: row.groupName,
    trackId: row.trackId ?? null,
    minCredits: row.minCredits === null ? null : toWireDecimal(row.minCredits),
    minCourses: row.minCourses,
    itemIds: row.items.map((item) => item.id),
    listedCredits: toWireDecimal(
      row.items.reduce(
        (total, item) => total.plus(rowCredits(item)),
        new Prisma.Decimal(0),
      ),
    ),
    itemCount: row.items.length,
  };
}
