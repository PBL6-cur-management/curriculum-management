import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, Length } from 'class-validator';
import { ISO_DAY_LENGTH } from '../../shared/time/today.js';

export class PromoteCoordinatorDto {
  @ApiPropertyOptional({
    format: 'date',
    description: 'Ngày bắt đầu hiệu lực (mặc định: hôm nay).',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Length(ISO_DAY_LENGTH, ISO_DAY_LENGTH)
  validFrom?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Length(ISO_DAY_LENGTH, ISO_DAY_LENGTH)
  validTo?: string;
}

export class DemoteCoordinatorDto {
  @ApiPropertyOptional({
    format: 'date',
    description:
      'Ngày kết thúc hiệu lực điều phối (bỏ trống để hạ quyền ngay lập tức).',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Length(ISO_DAY_LENGTH, ISO_DAY_LENGTH)
  validTo?: string;
}
