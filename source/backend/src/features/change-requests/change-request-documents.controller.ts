import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Res,
} from '@nestjs/common';
import { ApiCookieAuth, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { CurrentAccess } from '../../shared/authz/current-access.decorator.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { AllowDelegate } from '../../shared/authz/allow-delegate.decorator.js';
import { RequirePermission } from '../../shared/authz/require-permission.decorator.js';
import { ATTACHMENT_MIMES } from '../../shared/files/attachment-types.js';
import { sendFile } from '../../shared/files/send-file.js';
import { ChangeRequestDocumentsService } from './change-request-documents.service.js';

@ApiTags('change-requests')
@ApiCookieAuth()
@Controller('change-request-documents')
@RequirePermission(PERMISSIONS.CHANGE_REQUEST_VIEW)
export class ChangeRequestDocumentsController {
  constructor(private readonly documents: ChangeRequestDocumentsService) {}

  @AllowDelegate()
  @Get(':documentId/file')
  @ApiProduces(...ATTACHMENT_MIMES)
  async download(
    @Param('documentId') documentId: string,
    @CurrentAccess() access: AccessContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.documents.open(documentId, access);
    return sendFile(res, file.stream, file.fileName, file.mime);
  }

  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('documentId') documentId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.documents.remove(documentId, access);
  }
}
