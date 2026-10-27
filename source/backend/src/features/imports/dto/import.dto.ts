import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  ImportType,
  ImportBatchStatus,
} from '../../../generated/prisma/client.js';
import { PageQueryDto } from '../../../shared/pagination/page-query.dto.js';

export class CreateImportDto {
  @ApiProperty({ enum: ImportType, enumName: 'ImportType' })
  @IsEnum(ImportType)
  importType!: ImportType;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  versionId?: string;
}
export class ImportListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ImportType, enumName: 'ImportType' })
  @IsOptional()
  @IsEnum(ImportType)
  importType?: ImportType;
  @ApiPropertyOptional({
    enum: ImportBatchStatus,
    enumName: 'ImportBatchStatus',
  })
  @IsOptional()
  @IsEnum(ImportBatchStatus)
  status?: ImportBatchStatus;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  mine?: boolean;
}
export class CreateImportFormDto extends CreateImportDto {
  @ApiProperty({ type: 'string', format: 'binary' }) file!: unknown;
}
