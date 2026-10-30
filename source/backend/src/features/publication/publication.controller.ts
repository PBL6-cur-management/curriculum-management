import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
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
import { sendFile } from '../../shared/files/send-file.js';
import { ProgramPdfExportsService } from './pdf/program-pdf-exports.service.js';
import { ProgramHealthService } from './program-health.service.js';
import {
  CourseGraphDto,
  ProgramHealthDto,
  ProgramPdfExportDto,
  ProgramTimelineDto,
} from './publication.dto.js';
import { PublicationSourceReader } from './publication-source.reader.js';
import { VersionTimelineReader } from './version-timeline.reader.js';

// F-24: read-only projections of a program: requisite graph, issued timeline, health board, PDF.
@ApiTags('publication')
@ApiCookieAuth()
@Controller()
export class PublicationController {
  constructor(
    private readonly source: PublicationSourceReader,
    private readonly timeline: VersionTimelineReader,
    private readonly health: ProgramHealthService,
    private readonly pdf: ProgramPdfExportsService,
  ) {}

  @Get('programs/:programId/versions/:versionId/course-graph')
  @RequirePermission(PERMISSIONS.PROGRAM_VIEW)
  @ApiOkResponse({ type: CourseGraphDto })
  graph(
    @CurrentAccess() access: AccessContext,
    @Param('programId') programId: string,
    @Param('versionId') versionId: string,
  ): Promise<CourseGraphDto> {
    return this.source.graph(access, programId, versionId);
  }

  @Get('programs/:programId/version-timeline')
  @RequirePermission(PERMISSIONS.VERSION_VIEW_HISTORY)
  @ApiOkResponse({ type: ProgramTimelineDto })
  versionTimeline(
    @CurrentAccess() access: AccessContext,
    @Param('programId') programId: string,
  ): Promise<ProgramTimelineDto> {
    return this.timeline.read(access, programId);
  }

  @Get('programs/:programId/versions/:versionId/health')
  @RequirePermission(PERMISSIONS.PROGRAM_VIEW)
  @ApiOkResponse({ type: ProgramHealthDto })
  programHealth(
    @CurrentAccess() access: AccessContext,
    @Param('programId') programId: string,
    @Param('versionId') versionId: string,
  ): Promise<ProgramHealthDto> {
    return this.health.read(access, programId, versionId);
  }

  @Post('programs/:programId/versions/:versionId/pdf-exports')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission(PERMISSIONS.PROGRAM_VIEW)
  @ApiAcceptedResponse({ type: ProgramPdfExportDto })
  createPdf(
    @CurrentAccess() access: AccessContext,
    @Param('programId') programId: string,
    @Param('versionId') versionId: string,
  ): Promise<ProgramPdfExportDto> {
    return this.pdf.create(access, programId, versionId);
  }

  @Get('program-pdf-exports/:exportId')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermission(PERMISSIONS.PROGRAM_VIEW)
  @ApiOkResponse({ type: ProgramPdfExportDto })
  pdfStatus(
    @CurrentAccess() access: AccessContext,
    @Param('exportId') exportId: string,
  ): Promise<ProgramPdfExportDto> {
    return this.pdf.status(access, exportId);
  }

  @Get('program-pdf-exports/:exportId/file')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermission(PERMISSIONS.PROGRAM_VIEW)
  @ApiProduces('application/pdf')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  async pdfFile(
    @CurrentAccess() access: AccessContext,
    @Param('exportId') exportId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.pdf.file(access, exportId);
    response.set('Content-Length', String(file.sizeBytes));
    return sendFile(response, file.stream, file.fileName, 'application/pdf');
  }
}
