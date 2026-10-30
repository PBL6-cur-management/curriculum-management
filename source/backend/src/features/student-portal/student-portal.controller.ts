import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { CurrentAccess } from '../../shared/authz/current-access.decorator.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { RequirePermission } from '../../shared/authz/require-permission.decorator.js';
import { ATTACHMENT_MIMES } from '../../shared/files/attachment-types.js';
import { sendFile } from '../../shared/files/send-file.js';
import {
  PortalContextQueryDto,
  PortalCurriculumDto,
  PortalMeDto,
  PortalPloDto,
  PortalSemesterQueryDto,
  PortalSyllabusDto,
} from './dto/student-portal.dto.js';
import { StudentPortalService } from './student-portal.service.js';

// Personal data: never cached by a shared proxy or the browser's back/forward cache.
@ApiTags('student-portal')
@ApiCookieAuth()
@Controller('portal')
export class StudentPortalController {
  constructor(private readonly portal: StudentPortalService) {}

  @Get('me')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermission(PERMISSIONS.STUDENT_VIEW_PROGRESS)
  @ApiOkResponse({ type: PortalMeDto })
  me(
    @Query() query: PortalSemesterQueryDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.portal.me(access, query);
  }

  @Get('curriculum')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermission(PERMISSIONS.STUDENT_VIEW_PROGRESS)
  @ApiOkResponse({ type: PortalCurriculumDto })
  curriculum(
    @Query() query: PortalContextQueryDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.portal.curriculum(access, query);
  }

  @Get('plos')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermission(PERMISSIONS.STUDENT_VIEW_PROGRESS)
  @ApiOkResponse({ type: [PortalPloDto] })
  plos(
    @Query() query: PortalContextQueryDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.portal.plos(access, query);
  }

  @Get('curriculum-items/:itemId/syllabus')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermission(PERMISSIONS.STUDENT_VIEW_PROGRESS)
  @ApiOkResponse({ type: PortalSyllabusDto })
  syllabus(
    @Param('itemId') itemId: string,
    @Query() query: PortalContextQueryDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.portal.syllabus(access, itemId, query);
  }

  @Get('curriculum-items/:itemId/syllabus/attachments/:attachmentId/file')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermission(PERMISSIONS.STUDENT_VIEW_PROGRESS)
  @ApiProduces(...ATTACHMENT_MIMES)
  async attachment(
    @Param('itemId') itemId: string,
    @Param('attachmentId') attachmentId: string,
    @Query() query: PortalContextQueryDto,
    @CurrentAccess() access: AccessContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.portal.openAttachment(
      access,
      itemId,
      attachmentId,
      query,
    );
    return sendFile(res, file.stream, file.fileName, file.mime);
  }
}
