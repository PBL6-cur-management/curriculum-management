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
import { sendFile } from '../../shared/files/send-file.js';
import { ChangeRequestStatisticsService } from './change-request-statistics.service.js';
import {
  ChangeRequestStatisticsDto,
  ComparisonQueryDto,
  CreditDistributionDto,
  ProgramComparisonDto,
  StatisticsQueryDto,
  VersionQueryDto,
} from './dto/reports.dto.js';
import {
  ReportWorkbooksService,
  XLSX_MIME,
} from './report-workbooks.service.js';

const BINARY = { schema: { type: 'string', format: 'binary' } } as const;

// Read-only reports (F-23). Every Excel file is built from the same reader as the screen it exports.
@ApiTags('reports')
@ApiCookieAuth()
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly workbooks: ReportWorkbooksService,
    private readonly statistics: ChangeRequestStatisticsService,
  ) {}

  @Get('program-comparison')
  @RequirePermission(PERMISSIONS.REPORT_BENCHMARK)
  @ApiOkResponse({ type: ProgramComparisonDto })
  async comparison(
    @CurrentAccess() access: AccessContext,
    @Query() query: ComparisonQueryDto,
  ): Promise<ProgramComparisonDto> {
    return (
      await this.workbooks.comparison(
        access,
        query.leftVersionId,
        query.rightVersionId,
      )
    ).result;
  }

  @Get('program-comparison/export')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermission(PERMISSIONS.REPORT_BENCHMARK)
  @ApiProduces(XLSX_MIME)
  @ApiOkResponse(BINARY)
  async comparisonExport(
    @CurrentAccess() access: AccessContext,
    @Query() query: ComparisonQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.workbooks.comparisonFile(
      access,
      query.leftVersionId,
      query.rightVersionId,
    );
    return sendFile(response, file.body, file.fileName, file.mime);
  }

  @Get('credit-distribution')
  @RequirePermission(PERMISSIONS.REPORT_BENCHMARK)
  @ApiOkResponse({ type: CreditDistributionDto })
  async distribution(
    @CurrentAccess() access: AccessContext,
    @Query() query: VersionQueryDto,
  ): Promise<CreditDistributionDto> {
    return (await this.workbooks.distribution(access, query.versionId)).result;
  }

  @Get('credit-distribution/export')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermission(PERMISSIONS.REPORT_BENCHMARK)
  @ApiProduces(XLSX_MIME)
  @ApiOkResponse(BINARY)
  async distributionExport(
    @CurrentAccess() access: AccessContext,
    @Query() query: VersionQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.workbooks.distributionFile(access, query.versionId);
    return sendFile(response, file.body, file.fileName, file.mime);
  }

  @Get('versions/:versionId/matrices/export')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermission(PERMISSIONS.REPORT_EXPORT_ACCREDITATION)
  @ApiProduces(XLSX_MIME)
  @ApiOkResponse(BINARY)
  async matrices(
    @CurrentAccess() access: AccessContext,
    @Param('versionId') versionId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.workbooks.matricesFile(access, versionId);
    return sendFile(response, file.body, file.fileName, file.mime);
  }

  @Get('versions/:versionId/accreditation/export')
  @Header('Cache-Control', 'no-store, private')
  @RequirePermission(PERMISSIONS.REPORT_EXPORT_ACCREDITATION)
  @ApiProduces(XLSX_MIME)
  @ApiOkResponse(BINARY)
  async accreditation(
    @CurrentAccess() access: AccessContext,
    @Param('versionId') versionId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.workbooks.accreditationFile(access, versionId);
    return sendFile(response, file.body, file.fileName, file.mime);
  }

  @Get('change-request-statistics')
  @RequirePermission(PERMISSIONS.CHANGE_REQUEST_STATISTICS)
  @ApiOkResponse({ type: ChangeRequestStatisticsDto })
  changeRequestStatistics(
    @CurrentAccess() access: AccessContext,
    @Query() query: StatisticsQueryDto,
  ) {
    return this.statistics.read(access, query);
  }
}
