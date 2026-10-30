import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { CurrentAccess } from '../../shared/authz/current-access.decorator.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { RequirePermission } from '../../shared/authz/require-permission.decorator.js';
import { RegistrationEligibilityReader } from '../../shared/registration-eligibility/registration-eligibility.reader.js';
import { RegistrationEligibilityQueryDto } from './dto/registration-eligibility-query.dto.js';
import { RegistrationEligibilityDto } from './dto/registration-eligibility.dto.js';
import { toRegistrationEligibilityDto } from './registration-eligibility.mapper.js';

@ApiTags('registration-eligibility')
@ApiCookieAuth()
@Controller('students/:studentId/registration-eligibility')
export class RegistrationEligibilityController {
  constructor(private readonly eligibility: RegistrationEligibilityReader) {}
  @Get()
  @Header('Cache-Control', 'no-store, private')
  @RequirePermission(PERMISSIONS.STUDENT_VIEW_REGISTRATION_ELIGIBILITY)
  @ApiOkResponse({ type: RegistrationEligibilityDto })
  async read(
    @Param('studentId') studentId: string,
    @Query() query: RegistrationEligibilityQueryDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<RegistrationEligibilityDto> {
    return toRegistrationEligibilityDto(
      await this.eligibility.forAccess(access).evaluate({
        studentId,
        programId: query.programId,
        semesterId: query.semesterId,
      }),
    );
  }
}
