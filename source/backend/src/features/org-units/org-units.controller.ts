import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../shared/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../../shared/auth/authenticated-user.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { RequirePermission } from '../../shared/authz/require-permission.decorator.js';
import { AnyAuthenticated } from '../../shared/authz/any-authenticated.decorator.js';
import { CreateOrgUnitDto } from './create-org-unit.dto.js';
import { OrgUnitQueryDto } from './org-unit-query.dto.js';
import { UpdateOrgUnitDto } from './update-org-unit.dto.js';
import { OrgUnitDto } from './org-unit.dto.js';
import { OrgUnitsService } from './org-units.service.js';

@ApiTags('org-units')
@ApiCookieAuth()
@Controller('org-units')
export class OrgUnitsController {
  constructor(private readonly orgUnits: OrgUnitsService) {}

  @Get()
  @AnyAuthenticated()
  @ApiOkResponse({ type: [OrgUnitDto] })
  list(@Query() query: OrgUnitQueryDto): Promise<OrgUnitDto[]> {
    return this.orgUnits.list(query);
  }

  @Post()
  @RequirePermission(PERMISSIONS.ORG_UNIT_MANAGE)
  @ApiCreatedResponse({ type: OrgUnitDto })
  create(
    @Body() dto: CreateOrgUnitDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.orgUnits.create(dto, actor.id);
  }

  @Patch(':unitId')
  @RequirePermission(PERMISSIONS.ORG_UNIT_MANAGE)
  @ApiOkResponse({ type: OrgUnitDto })
  update(
    @Param('unitId') unitId: string,
    @Body() dto: UpdateOrgUnitDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.orgUnits.update(unitId, dto, actor.id);
  }

  @Post(':unitId/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSIONS.ORG_UNIT_MANAGE)
  @ApiOkResponse({ type: OrgUnitDto })
  deactivate(
    @Param('unitId') unitId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.orgUnits.deactivate(unitId, actor.id);
  }

  @Post(':unitId/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSIONS.ORG_UNIT_MANAGE)
  @ApiOkResponse({ type: OrgUnitDto })
  activate(
    @Param('unitId') unitId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.orgUnits.activate(unitId, actor.id);
  }
}
