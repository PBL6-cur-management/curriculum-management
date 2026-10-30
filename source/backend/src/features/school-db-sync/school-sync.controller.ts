import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { CurrentAccess } from '../../shared/authz/current-access.decorator.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { RequirePermission } from '../../shared/authz/require-permission.decorator.js';
import { PageQueryDto } from '../../shared/pagination/page-query.dto.js';
import {
  SaveSyncConfigurationDto,
  SaveSyncMappingsDto,
  StartSyncRunDto,
  SyncReferenceQueryDto,
  SyncRunQueryDto,
  TestSyncConnectionDto,
} from './dto/school-sync.dto.js';
import {
  SyncConfigurationDto,
  SyncConflictPageDto,
  SyncConnectionTestDto,
  SyncMappingSetDto,
  SyncReferencePageDto,
  SyncRunDto,
  SyncRunPageDto,
} from './dto/school-sync-response.dto.js';
import { SchoolSyncService } from './school-sync.service.js';

// MH-12 / MH-13. Every route also requires the Academic Office role itself (checked in the service).
@ApiTags('school-db-sync')
@Controller('school-db-sync')
@RequirePermission(PERMISSIONS.SYNC_CONFIGURE)
export class SchoolSyncController {
  constructor(private readonly sync: SchoolSyncService) {}

  @Get('configuration')
  @ApiOkResponse({ type: SyncConfigurationDto })
  getConfiguration(@CurrentAccess() access: AccessContext): Promise<SyncConfigurationDto> {
    return this.sync.getConfiguration(access);
  }

  @Put('configuration')
  @ApiOkResponse({ type: SyncConfigurationDto })
  saveConfiguration(
    @Body() dto: SaveSyncConfigurationDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<SyncConfigurationDto> {
    return this.sync.saveConfiguration(dto, access);
  }

  @Post('connection-test')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SyncConnectionTestDto })
  testConnection(
    @Body() dto: TestSyncConnectionDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<SyncConnectionTestDto> {
    return this.sync.testConnection(dto, access);
  }

  @Get('mappings')
  @ApiOkResponse({ type: SyncMappingSetDto })
  getMappings(@CurrentAccess() access: AccessContext): Promise<SyncMappingSetDto> {
    return this.sync.getMappings(access);
  }

  @Put('mappings')
  @ApiOkResponse({ type: SyncMappingSetDto })
  saveMappings(
    @Body() dto: SaveSyncMappingsDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<SyncMappingSetDto> {
    return this.sync.saveMappings(dto, access);
  }

  @Get('reference-options')
  @ApiOkResponse({ type: SyncReferencePageDto })
  referenceOptions(
    @Query() query: SyncReferenceQueryDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<SyncReferencePageDto> {
    return this.sync.referenceOptions(query, access);
  }

  @Post('runs')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({ type: SyncRunDto })
  startRun(
    @Body() dto: StartSyncRunDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<SyncRunDto> {
    return this.sync.startRun(dto, access);
  }

  @Get('runs')
  @ApiOkResponse({ type: SyncRunPageDto })
  listRuns(
    @Query() query: SyncRunQueryDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<SyncRunPageDto> {
    return this.sync.listRuns(query, access);
  }

  @Get('runs/:runId')
  @ApiOkResponse({ type: SyncRunDto })
  getRun(
    @Param('runId') runId: string,
    @CurrentAccess() access: AccessContext,
  ): Promise<SyncRunDto> {
    return this.sync.getRun(runId, access);
  }

  @Get('runs/:runId/conflicts')
  @ApiOkResponse({ type: SyncConflictPageDto })
  listConflicts(
    @Param('runId') runId: string,
    @Query() query: PageQueryDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<SyncConflictPageDto> {
    return this.sync.listConflicts(runId, query, access);
  }

  @Post('runs/:runId/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({ type: SyncRunDto })
  retryRun(
    @Param('runId') runId: string,
    @Body() dto: StartSyncRunDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<SyncRunDto> {
    return this.sync.retryRun(runId, dto, access);
  }
}
