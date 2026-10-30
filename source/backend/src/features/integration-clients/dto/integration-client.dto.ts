import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IntegrationClientStatus } from '../../../generated/prisma/client.js';
import { INTEGRATION } from '../../../shared/integration-access/integration.constants.js';
import { PageQueryDto } from '../../../shared/pagination/page-query.dto.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class IntegrationClientQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ maxLength: INTEGRATION.CLIENT_NAME_MAX })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(INTEGRATION.CLIENT_NAME_MAX)
  search?: string;

  @ApiPropertyOptional({
    enum: IntegrationClientStatus,
    enumName: 'IntegrationClientStatus',
  })
  @IsOptional()
  @IsEnum(IntegrationClientStatus)
  status?: IntegrationClientStatus;
}

export class CreateIntegrationClientDto {
  @ApiProperty({ maxLength: INTEGRATION.CLIENT_NAME_MAX })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(INTEGRATION.CLIENT_NAME_MAX)
  clientName!: string;

  @ApiPropertyOptional({
    default: INTEGRATION.DEFAULT_RATE_PER_MINUTE,
    minimum: 1,
    maximum: INTEGRATION.MAX_POSTGRES_INT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(INTEGRATION.MAX_POSTGRES_INT)
  rateLimit?: number;
}

export class UpdateIntegrationClientDto {
  @ApiPropertyOptional({ maxLength: INTEGRATION.CLIENT_NAME_MAX })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(INTEGRATION.CLIENT_NAME_MAX)
  clientName?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: INTEGRATION.MAX_POSTGRES_INT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(INTEGRATION.MAX_POSTGRES_INT)
  rateLimit?: number;
}

export class IntegrationClientDto {
  @ApiProperty() id!: string;
  @ApiProperty() clientName!: string;
  @ApiProperty({
    enum: IntegrationClientStatus,
    enumName: 'IntegrationClientStatus',
  })
  status!: IntegrationClientStatus;
  @ApiProperty() rateLimit!: number;
  @ApiProperty() createdByName!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastCalledAt!: string | null;
}

export class IntegrationClientPageDto {
  @ApiProperty({ type: [IntegrationClientDto] })
  items!: IntegrationClientDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class IssuedIntegrationClientDto {
  @ApiProperty({ type: IntegrationClientDto }) client!: IntegrationClientDto;
  @ApiProperty({
    description: 'Hiển thị một lần duy nhất; hệ thống chỉ lưu bản băm.',
  })
  apiKey!: string;
}
