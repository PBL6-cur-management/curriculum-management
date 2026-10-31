import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApprovalDelegationStatus } from '../../generated/prisma/client.js';
import { PageQueryDto } from '../../shared/pagination/page-query.dto.js';

export const DELEGATION_DIRECTIONS = ['OUTGOING', 'INCOMING'] as const;
export type DelegationDirection = (typeof DELEGATION_DIRECTIONS)[number];
export const DELEGABLE_LEVELS = [1, 2] as const;

export class DelegationUserOptionDto {
  @ApiProperty() id!: string;
  @ApiProperty() userCode!: string;
  @ApiProperty() fullName!: string;
}

export class DelegationLevelDto {
  @ApiProperty({ enum: DELEGABLE_LEVELS }) approvalLevel!: number;
  @ApiProperty() levelName!: string;
}

export class DelegationDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: DelegationUserOptionDto })
  delegator!: DelegationUserOptionDto;
  @ApiProperty({ type: DelegationUserOptionDto })
  delegate!: DelegationUserOptionDto;
  @ApiProperty({
    type: DelegationLevelDto,
    nullable: true,
    description: 'Null = every named level the delegator holds',
  })
  scope!: DelegationLevelDto | null;
  @ApiProperty({ description: 'YYYY-MM-DD, inclusive' }) validFrom!: string;
  @ApiProperty({ description: 'YYYY-MM-DD, inclusive' }) validTo!: string;
  @ApiProperty({
    enum: ApprovalDelegationStatus,
    enumName: 'ApprovalDelegationStatus',
  })
  status!: ApprovalDelegationStatus;
  @ApiProperty({
    description: 'Usable today: active, inside its days, both accounts active',
  })
  isEffectiveNow!: boolean;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ nullable: true, type: String }) revokedAt!: string | null;
  @ApiProperty({ type: DelegationUserOptionDto, nullable: true })
  createdBy!: DelegationUserOptionDto | null;
  @ApiProperty() canRevoke!: boolean;
}

export class DelegationPageDto {
  @ApiProperty({ type: [DelegationDto] }) items!: DelegationDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class DelegationAccessDto {
  @ApiProperty() canManage!: boolean;
  @ApiProperty({ description: 'May act for other people (R1)' })
  canManageOthers!: boolean;
  @ApiProperty({ description: 'A grant to the caller is usable today' })
  hasIncomingDelegation!: boolean;
}

export class DelegationQueryDto extends PageQueryDto {
  @ApiPropertyOptional({
    enum: ApprovalDelegationStatus,
    enumName: 'ApprovalDelegationStatus',
  })
  @IsOptional()
  @IsIn(Object.values(ApprovalDelegationStatus))
  status?: ApprovalDelegationStatus;

  @ApiPropertyOptional({ enum: DELEGATION_DIRECTIONS })
  @IsOptional()
  @IsIn(DELEGATION_DIRECTIONS)
  direction?: DelegationDirection;
}

export class UserSearchQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class LevelQueryDto {
  @ApiPropertyOptional({ description: 'R1 only; defaults to the caller' })
  @IsOptional()
  @IsString()
  delegatorId?: string;
}

export class CreateDelegationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  delegateId!: string;

  @ApiPropertyOptional({ description: 'R1 only; defaults to the caller' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  delegatorId?: string;

  @ApiPropertyOptional({
    enum: DELEGABLE_LEVELS,
    nullable: true,
    description: 'Null or absent = every named level the delegator holds',
  })
  @IsOptional()
  @IsIn([...DELEGABLE_LEVELS, null])
  scopeLevel?: number | null;

  @ApiProperty({ example: '2026-11-01' })
  @IsISO8601({ strict: true })
  validFrom!: string;

  @ApiProperty({ example: '2026-11-15' })
  @IsISO8601({ strict: true })
  validTo!: string;
}

export class RevokeDelegationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
