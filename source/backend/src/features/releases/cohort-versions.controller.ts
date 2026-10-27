import {
  Body,
  Controller,
  Get,
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
import type { AccessContext } from '../../shared/authz/access-context.js';
import { CurrentAccess } from '../../shared/authz/current-access.decorator.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { RequirePermission } from '../../shared/authz/require-permission.decorator.js';
import { CohortVersionsService } from './cohort-versions.service.js';
import {
  AppliedCohortVersionDto,
  AppliedVersionQueryDto,
  AssignCohortVersionsDto,
  CohortVersionListDto,
  UpdateCohortVersionDto,
} from './dto/cohort-version.dto.js';

@ApiTags('releases')
@ApiCookieAuth()
@Controller('programs/:programId')
export class CohortVersionsController {
  constructor(private readonly cohorts: CohortVersionsService) {}

  @Get('cohort-versions')
  @RequirePermission(PERMISSIONS.VERSION_ASSIGN_COHORT)
  @ApiOkResponse({ type: CohortVersionListDto })
  list(
    @Param('programId') programId: string,
    @CurrentAccess() access: AccessContext,
  ): Promise<CohortVersionListDto> {
    return this.cohorts.list(programId, access);
  }

  @Post('cohort-versions')
  @RequirePermission(PERMISSIONS.VERSION_ASSIGN_COHORT)
  @ApiCreatedResponse({ type: CohortVersionListDto })
  assign(
    @Param('programId') programId: string,
    @Body() dto: AssignCohortVersionsDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<CohortVersionListDto> {
    return this.cohorts.assign(programId, dto, access);
  }

  @Patch('cohort-versions/:assignmentId')
  @RequirePermission(PERMISSIONS.VERSION_ASSIGN_COHORT)
  @ApiOkResponse({ type: CohortVersionListDto })
  update(
    @Param('programId') programId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: UpdateCohortVersionDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<CohortVersionListDto> {
    return this.cohorts.update(programId, assignmentId, dto, access);
  }

  @Get('cohorts/:cohortId/applied-version')
  @RequirePermission(PERMISSIONS.VERSION_ASSIGN_COHORT)
  @ApiOkResponse({ type: AppliedCohortVersionDto })
  applied(
    @Param('programId') programId: string,
    @Param('cohortId') cohortId: string,
    @Query() query: AppliedVersionQueryDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<AppliedCohortVersionDto> {
    return this.cohorts.applied(programId, cohortId, query.semesterId, access);
  }
}
