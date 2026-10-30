import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { CurrentAccess } from '../../shared/authz/current-access.decorator.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { RequirePermission } from '../../shared/authz/require-permission.decorator.js';
import { EligibilityStudentsQueryDto } from './dto/registration-eligibility-query.dto.js';
import { EligibilityStudentPageDto } from './dto/registration-eligibility.dto.js';
import { EligibilityStudentsService } from './eligibility-students.service.js';

@ApiTags('registration-eligibility')
@ApiCookieAuth()
@Controller('programs/:programId/registration-eligibility/students')
export class EligibilityStudentsController {
  constructor(private readonly students: EligibilityStudentsService) {}
  @Get()
  @Header('Cache-Control', 'no-store, private')
  @RequirePermission(PERMISSIONS.STUDENT_VIEW_REGISTRATION_ELIGIBILITY)
  @ApiOkResponse({ type: EligibilityStudentPageDto })
  list(
    @Param('programId') programId: string,
    @Query() query: EligibilityStudentsQueryDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<EligibilityStudentPageDto> {
    return this.students.list(programId, query, access);
  }
}
