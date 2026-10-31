import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { AnyAuthenticated } from '../../shared/authz/any-authenticated.decorator.js';
import { CurrentAccess } from '../../shared/authz/current-access.decorator.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { RequirePermission } from '../../shared/authz/require-permission.decorator.js';
import { PassiveRequest } from '../../shared/session/passive-request.decorator.js';
import { ApprovalDelegationsService } from './approval-delegations.service.js';
import {
  CreateDelegationDto,
  DelegationAccessDto,
  DelegationDto,
  DelegationLevelDto,
  DelegationPageDto,
  DelegationQueryDto,
  DelegationUserOptionDto,
  LevelQueryDto,
  RevokeDelegationDto,
  UserSearchQueryDto,
} from './delegation.dto.js';

// MH-14 (F-25). Reading is open to every signed-in user (a delegate sees what they received);
// creating and revoking need delegation.manage, and the service checks whose grant it is.
@ApiTags('approval-delegations')
@ApiCookieAuth()
@Controller('approval-delegations')
export class ApprovalDelegationsController {
  constructor(private readonly delegations: ApprovalDelegationsService) {}

  @Get()
  @AnyAuthenticated()
  @ApiOkResponse({ type: DelegationPageDto })
  list(
    @Query() query: DelegationQueryDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.delegations.list(access, query);
  }

  @Get('access')
  @AnyAuthenticated()
  @PassiveRequest()
  @ApiOkResponse({ type: DelegationAccessDto })
  access(@CurrentAccess() access: AccessContext) {
    return this.delegations.access(access);
  }

  @Get('recipients')
  @RequirePermission(PERMISSIONS.DELEGATION_MANAGE)
  @ApiOkResponse({ type: [DelegationUserOptionDto] })
  recipients(
    @Query() query: UserSearchQueryDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.delegations.recipients(access, query.q);
  }

  @Get('delegators')
  @RequirePermission(PERMISSIONS.DELEGATION_MANAGE)
  @ApiOkResponse({ type: [DelegationUserOptionDto] })
  delegators(
    @Query() query: UserSearchQueryDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.delegations.delegators(access, query.q);
  }

  @Get('levels')
  @RequirePermission(PERMISSIONS.DELEGATION_MANAGE)
  @ApiOkResponse({ type: [DelegationLevelDto] })
  levels(
    @Query() query: LevelQueryDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.delegations.levels(access, query.delegatorId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.DELEGATION_MANAGE)
  @ApiCreatedResponse({ type: DelegationDto })
  create(
    @Body() dto: CreateDelegationDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.delegations.create(access, dto);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSIONS.DELEGATION_MANAGE)
  @ApiOkResponse({ type: DelegationDto })
  revoke(
    @Param('id') id: string,
    @Body() dto: RevokeDelegationDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.delegations.revoke(access, id, dto.reason);
  }
}
