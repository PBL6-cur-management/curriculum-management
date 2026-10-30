import {
  Body,
  Controller,
  Get,
  Header,
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
import { IntegrationClientStatus } from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { CurrentAccess } from '../../shared/authz/current-access.decorator.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { RequirePermission } from '../../shared/authz/require-permission.decorator.js';
import {
  CreateIntegrationClientDto,
  IntegrationClientDto,
  IntegrationClientPageDto,
  IntegrationClientQueryDto,
  IssuedIntegrationClientDto,
  UpdateIntegrationClientDto,
} from './dto/integration-client.dto.js';
import { IntegrationClientsService } from './integration-clients.service.js';

@ApiTags('integration-clients')
@ApiCookieAuth()
@RequirePermission(PERMISSIONS.INTEGRATION_CLIENT_MANAGE)
@Controller('integration-clients')
export class IntegrationClientsController {
  constructor(private readonly clients: IntegrationClientsService) {}

  @Get()
  @ApiOkResponse({ type: IntegrationClientPageDto })
  list(@Query() query: IntegrationClientQueryDto) {
    return this.clients.list(query);
  }

  @Post()
  @Header('Cache-Control', 'no-store, private')
  @ApiCreatedResponse({ type: IssuedIntegrationClientDto })
  create(
    @CurrentAccess() access: AccessContext,
    @Body() body: CreateIntegrationClientDto,
  ) {
    return this.clients.create(access, body);
  }

  @Patch(':id')
  @ApiOkResponse({ type: IntegrationClientDto })
  update(@Param('id') id: string, @Body() body: UpdateIntegrationClientDto) {
    return this.clients.update(id, body);
  }

  @Post(':id/lock')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: IntegrationClientDto })
  lock(@Param('id') id: string) {
    return this.clients.setStatus(id, IntegrationClientStatus.LOCKED);
  }

  @Post(':id/unlock')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: IntegrationClientDto })
  unlock(@Param('id') id: string) {
    return this.clients.setStatus(id, IntegrationClientStatus.ACTIVE);
  }
}
