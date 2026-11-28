import { ApiProperty } from '@nestjs/swagger';
import {
  OrgUnitStatus,
  OrgUnitType,
  type Prisma,
} from '../../generated/prisma/client.js';

export class OrgUnitDto {
  @ApiProperty() id!: string;
  @ApiProperty() unitCode!: string;
  @ApiProperty() unitName!: string;
  @ApiProperty({ enum: OrgUnitType }) unitType!: OrgUnitType;
  @ApiProperty() isExternal!: boolean;
  @ApiProperty({ type: String, nullable: true }) parentUnitId!: string | null;
  @ApiProperty({ enum: OrgUnitStatus }) status!: OrgUnitStatus;
}

export const ORG_UNIT_SELECT = {
  id: true,
  unitCode: true,
  unitName: true,
  unitType: true,
  isExternal: true,
  parentUnitId: true,
  status: true,
} as const satisfies Prisma.OrgUnitSelect;

export function toOrgUnitDto(
  row: Prisma.OrgUnitGetPayload<{ select: typeof ORG_UNIT_SELECT }>,
): OrgUnitDto {
  return {
    id: row.id,
    unitCode: row.unitCode,
    unitName: row.unitName,
    unitType: row.unitType,
    isExternal: row.isExternal ?? false,
    parentUnitId: row.parentUnitId,
    status: row.status,
  };
}
