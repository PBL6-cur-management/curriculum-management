import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { CurrentAccess } from '../../shared/authz/current-access.decorator.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { RequirePermission } from '../../shared/authz/require-permission.decorator.js';
import { CurriculumExportService } from './curriculum-export.service.js';
import { XLSX_MIME } from './import.constants.js';
import { sendXlsx } from './import-mapping.js';

@ApiTags('imports')
@Controller('program-versions/:versionId/curriculum/export')
export class CurriculumExportController {
  constructor(private readonly exporter: CurriculumExportService) {}
  @Get()
  @RequirePermission(PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL)
  @ApiProduces(XLSX_MIME)
  async export(
    @Param('versionId') versionId: string,
    @CurrentAccess() access: AccessContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.exporter.export(versionId, access);
    return sendXlsx(res, file.content, file.fileName);
  }
}
