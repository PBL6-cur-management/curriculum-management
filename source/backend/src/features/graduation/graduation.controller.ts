import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { CurrentAccess } from '../../shared/authz/current-access.decorator.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { RequirePermission } from '../../shared/authz/require-permission.decorator.js';
import { PassiveRequest } from '../../shared/session/passive-request.decorator.js';
import { GraduationService } from './graduation.service.js';
import {
  GraduationAuditDto,
  GraduationAuditPageDto,
  GraduationHistoryQueryDto,
  GraduationLookupQueryDto,
  GraduationOutcomeDto,
  GRADUATION_OUTCOME_SCHEMA,
  GraduationSaveDto,
} from './graduation.dto.js';
import { GraduationOptionsService } from './graduation-options.service.js';
import {
  GraduationProgramOptionDto,
  GraduationProgramOptionsQueryDto,
  GraduationStudentOptionPageDto,
  GraduationStudentOptionsQueryDto,
} from './graduation-options.dto.js';
import {
  GraduationReauditService,
  GraduationReauditTaskDto,
  GraduationReauditTaskPageDto,
} from './graduation-reaudit.service.js';

@ApiTags('graduation')
@ApiCookieAuth()
@ApiExtraModels(GraduationOutcomeDto)
@Controller()
export class GraduationController {
  constructor(
    private readonly graduation: GraduationService,
    private readonly options: GraduationOptionsService,
    private readonly reaudits: GraduationReauditService,
  ) {}

  @Get('students/:studentId/graduation')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermission(PERMISSIONS.GRADUATION_VIEW)
  @ApiOkResponse({ schema: GRADUATION_OUTCOME_SCHEMA })
  live(
    @CurrentAccess() access: AccessContext,
    @Param('studentId') studentId: string,
    @Query() query: GraduationLookupQueryDto,
  ) {
    return this.graduation.live(access, { studentId, ...query });
  }

  @Post('students/:studentId/graduation-audits')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermission(PERMISSIONS.GRADUATION_AUDIT)
  @ApiCreatedResponse({ type: GraduationAuditDto })
  save(
    @CurrentAccess() access: AccessContext,
    @Param('studentId') studentId: string,
    @Body() body: GraduationSaveDto,
  ) {
    return this.graduation.save(
      access,
      { studentId, programId: body.programId, semesterId: body.semesterId },
      body.requestKey,
    );
  }

  @Get('students/:studentId/graduation-audits')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermission(PERMISSIONS.GRADUATION_VIEW)
  @ApiOkResponse({ type: GraduationAuditPageDto })
  history(
    @CurrentAccess() access: AccessContext,
    @Param('studentId') studentId: string,
    @Query() query: GraduationHistoryQueryDto,
  ) {
    return this.graduation.history(
      access,
      { studentId, programId: query.programId, semesterId: query.semesterId },
      query,
    );
  }

  @Get('graduation-audits/:auditId')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermission(PERMISSIONS.GRADUATION_VIEW)
  @ApiOkResponse({ type: GraduationAuditDto })
  audit(@CurrentAccess() access: AccessContext, @Param('auditId') id: string) {
    return this.graduation.byId(access, id);
  }

  @Get('graduation/program-options')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermission(PERMISSIONS.GRADUATION_VIEW, PERMISSIONS.GRADUATION_AUDIT)
  @ApiOkResponse({ type: [GraduationProgramOptionDto] })
  programs(
    @CurrentAccess() access: AccessContext,
    @Query() query: GraduationProgramOptionsQueryDto,
  ) {
    return this.options.programs(access, query.semesterId);
  }

  @Get('graduation/student-options')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermission(PERMISSIONS.GRADUATION_VIEW, PERMISSIONS.GRADUATION_AUDIT)
  @ApiOkResponse({ type: GraduationStudentOptionPageDto })
  students(
    @CurrentAccess() access: AccessContext,
    @Query() query: GraduationStudentOptionsQueryDto,
  ) {
    return this.options.students(access, query);
  }

  @Get('students/:studentId/graduation-reaudit-tasks')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermission(PERMISSIONS.GRADUATION_AUDIT)
  @PassiveRequest()
  @ApiOkResponse({ type: GraduationReauditTaskPageDto })
  tasks(
    @CurrentAccess() access: AccessContext,
    @Param('studentId') studentId: string,
    @Query() query: GraduationHistoryQueryDto,
  ) {
    return this.reaudits.list(
      access,
      { studentId, programId: query.programId, semesterId: query.semesterId },
      query,
    );
  }

  @Post('graduation-reaudit-tasks/:taskId/retry')
  @Header('Cache-Control', 'no-store, private')
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.GRADUATION_AUDIT)
  @ApiOkResponse({ type: GraduationReauditTaskDto })
  retry(@CurrentAccess() access: AccessContext, @Param('taskId') id: string) {
    return this.reaudits.retry(access, id);
  }
}
