import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { CurrentAccess } from '../../shared/authz/current-access.decorator.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { RequirePermission } from '../../shared/authz/require-permission.decorator.js';
import { PassiveRequest } from '../../shared/session/passive-request.decorator.js';
import {
  BackupListQueryDto,
  BackupRunPageDto,
  BackupStatusDto,
  DrillListQueryDto,
  RestoreDrillPageDto,
} from './backups.dto.js';
import { BackupsService } from './backups.service.js';

// F-26 BE-07: read-only operations views. Backups run on the schedule; drills run from the CLI.
@ApiTags('operations')
@ApiCookieAuth()
@Controller('operations')
export class BackupsController {
  constructor(private readonly backups: BackupsService) {}

  @Get('backups/status')
  @RequirePermission(PERMISSIONS.BACKUP_VIEW)
  @PassiveRequest()
  @ApiOkResponse({ type: BackupStatusDto })
  status(@CurrentAccess() access: AccessContext): Promise<BackupStatusDto> {
    return this.backups.status(access);
  }

  @Get('backups')
  @RequirePermission(PERMISSIONS.BACKUP_VIEW)
  @PassiveRequest()
  @ApiOkResponse({ type: BackupRunPageDto })
  list(
    @Query() query: BackupListQueryDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<BackupRunPageDto> {
    return this.backups.list(query, access);
  }

  @Get('restore-drills')
  @RequirePermission(PERMISSIONS.BACKUP_VIEW)
  @PassiveRequest()
  @ApiOkResponse({ type: RestoreDrillPageDto })
  drills(
    @Query() query: DrillListQueryDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<RestoreDrillPageDto> {
    return this.backups.drills(query, access);
  }
}
