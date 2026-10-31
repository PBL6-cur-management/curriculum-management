import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import {
  ChangeRequestStatus,
  ChangeRequestType,
} from '../../generated/prisma/client.js';
import { UserRefDto } from '../../shared/dtos/ref.dto.js';

export class ApprovalQueueQueryDto {
  @ApiPropertyOptional({
    enum: ChangeRequestType,
    enumName: 'ChangeRequestType',
  })
  @IsOptional()
  @IsEnum(ChangeRequestType)
  requestType?: ChangeRequestType;
}

export class DelegatedQueueRefDto {
  @ApiProperty() delegationId!: string;
  @ApiProperty({ type: UserRefDto }) delegator!: UserRefDto;
}

export class ApprovalQueueItemDto {
  @ApiProperty() requestId!: string;
  @ApiProperty() requestCode!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: ChangeRequestType, enumName: 'ChangeRequestType' })
  requestType!: ChangeRequestType;
  @ApiProperty({ enum: ChangeRequestStatus, enumName: 'ChangeRequestStatus' })
  status!: ChangeRequestStatus;
  @ApiProperty({ enum: [1, 2, 3] }) approvalLevel!: number;
  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'Group or program codes the caller stands for; null at level 3',
  })
  standsFor!: string | null;
  @ApiProperty({ type: UserRefDto }) createdBy!: UserRefDto;
  @ApiProperty({ description: 'ISO time the round was submitted' })
  submittedAt!: string;
  @ApiProperty({
    description: 'Whole days since the request entered its level',
  })
  daysWaiting!: number;
  @ApiProperty({
    type: [DelegatedQueueRefDto],
    description:
      'F-25: whose rows the caller decides here by delegation; empty for own work',
  })
  delegatedFor!: DelegatedQueueRefDto[];
}
