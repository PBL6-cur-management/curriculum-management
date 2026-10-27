import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { CurrentAccess } from '../../shared/authz/current-access.decorator.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { RequirePermission } from '../../shared/authz/require-permission.decorator.js';
import {
  PinnedSyllabusComparisonDto,
  VersionComparisonDto,
  VersionComparisonQueryDto,
} from './dto/version-comparison.dto.js';
import { VersionComparisonService } from './version-comparison.service.js';

@ApiTags('releases')
@ApiCookieAuth()
@Controller('programs/:programId/version-comparison')
export class VersionComparisonController {
  constructor(private readonly comparison: VersionComparisonService) {}

  @Get()
  @RequirePermission(PERMISSIONS.VERSION_COMPARE)
  @ApiOkResponse({ type: VersionComparisonDto })
  compare(
    @Param('programId') programId: string,
    @Query() query: VersionComparisonQueryDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<VersionComparisonDto> {
    return this.comparison.compare(programId, query, access);
  }

  @Get('syllabi/:courseId')
  @RequirePermission(PERMISSIONS.VERSION_COMPARE)
  @ApiOkResponse({ type: PinnedSyllabusComparisonDto })
  syllabi(
    @Param('programId') programId: string,
    @Param('courseId') courseId: string,
    @Query() query: VersionComparisonQueryDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<PinnedSyllabusComparisonDto> {
    return this.comparison.syllabi(programId, courseId, query, access);
  }
}
