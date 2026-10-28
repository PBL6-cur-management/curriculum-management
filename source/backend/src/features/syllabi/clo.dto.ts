import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  emptyToNull,
  trimString,
  trimUpperCase,
} from '../../shared/dtos/transforms.js';
import { SYLLABUS_LIMITS } from './syllabus.errors.js';

export class CreateCloDto {
  @ApiProperty({ example: 'CLO1', description: 'Trimmed and upper-cased' })
  @Transform(trimUpperCase)
  @IsString()
  @Length(1, SYLLABUS_LIMITS.CLO_CODE_MAX)
  cloCode!: string;

  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @Length(1, SYLLABUS_LIMITS.CLO_TEXT_MAX)
  description!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(SYLLABUS_LIMITS.CLO_TEXT_MAX)
  englishDescription?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(SYLLABUS_LIMITS.COGNITIVE_LEVEL_MAX)
  cognitiveLevel?: string | null;
}

export class UpdateCloDto extends PartialType(CreateCloDto) {}

export class ReorderClosDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(SYLLABUS_LIMITS.CLOS_MAX)
  @ArrayUnique()
  @IsString({ each: true })
  ids!: string[];
}

export class CloDto {
  @ApiProperty() id!: string;
  @ApiProperty() cloCode!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ nullable: true, type: String }) englishDescription!:
    string | null;
  @ApiProperty({ nullable: true, type: String }) cognitiveLevel!: string | null;
  @ApiProperty({ description: '1-based, contiguous' }) sortOrder!: number;
  @ApiProperty({
    type: [String],
    description: 'Codes of the programs that link this CLO to a PLO, sorted',
  })
  linkedPrograms!: string[];
  @ApiProperty({
    description: 'Assessment components mapped to this CLO in this revision',
  })
  assessmentLinkCount!: number;
}

export const CLO_INCLUDE = {
  ploLinks: {
    select: {
      coursePlo: {
        select: {
          curriculumItem: {
            select: {
              version: {
                select: { program: { select: { programCode: true } } },
              },
            },
          },
        },
      },
    },
  },
  _count: { select: { assessmentLinks: true } },
} as const satisfies Prisma.CLOInclude;
export type CloRow = Prisma.CLOGetPayload<{ include: typeof CLO_INCLUDE }>;

export function toCloDto(row: CloRow): CloDto {
  const programs = new Set(
    row.ploLinks.map(
      (link) => link.coursePlo.curriculumItem.version.program.programCode,
    ),
  );
  return {
    id: row.id,
    cloCode: row.cloCode,
    description: row.description,
    englishDescription: row.englishDescription,
    cognitiveLevel: row.cognitiveLevel,
    sortOrder: row.sortOrder,
    linkedPrograms: [...programs].sort(),
    assessmentLinkCount: row._count.assessmentLinks,
  };
}
