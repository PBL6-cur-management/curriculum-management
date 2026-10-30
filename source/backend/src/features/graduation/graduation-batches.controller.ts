import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { CurrentAccess } from '../../shared/authz/current-access.decorator.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { RequirePermission } from '../../shared/authz/require-permission.decorator.js';
import { PassiveRequest } from '../../shared/session/passive-request.decorator.js';
import { PageQueryDto } from '../../shared/pagination/page-query.dto.js';
import { sendFile } from '../../shared/files/send-file.js';
import { GraduationBatchesService } from './graduation-batches.service.js';
import { GraduationExportService } from './graduation-export.service.js';
import {
  GraduationBatchCreateDto,
  GraduationBatchDto,
  GraduationBatchExportQueryDto,
  GraduationBatchFilterDto,
  GraduationBatchItemPageDto,
  GraduationBatchItemQueryDto,
  GraduationBatchPageDto,
  GraduationBatchPreviewDto,
} from './graduation-batch.dto.js';

@ApiTags('graduation-batches')
@ApiCookieAuth()
@RequirePermission(PERMISSIONS.GRADUATION_AUDIT)
@Controller('graduation-batches')
export class GraduationBatchesController {
  constructor(
    private readonly batches: GraduationBatchesService,
    private readonly exporter: GraduationExportService,
  ) {}

  @Post('preview')
  @Header('Cache-Control', 'no-store, private')
  @HttpCode(200)
  @ApiOkResponse({ type: GraduationBatchPreviewDto })
  preview(
    @CurrentAccess() access: AccessContext,
    @Body() body: GraduationBatchFilterDto,
  ) {
    return this.batches.preview(access, body);
  }

  @Post()
  @Header('Cache-Control', 'no-store, private')
  @ApiCreatedResponse({ type: GraduationBatchDto })
  create(
    @CurrentAccess() access: AccessContext,
    @Body() body: GraduationBatchCreateDto,
  ) {
    return this.batches.create(access, body);
  }

  @Get()
  @Header('Cache-Control', 'no-store, private')
  @PassiveRequest()
  @ApiOkResponse({ type: GraduationBatchPageDto })
  list(@CurrentAccess() access: AccessContext, @Query() query: PageQueryDto) {
    return this.batches.list(access, query);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store, private')
  @PassiveRequest()
  @ApiOkResponse({ type: GraduationBatchDto })
  detail(@CurrentAccess() access: AccessContext, @Param('id') id: string) {
    return this.batches.detail(access, id);
  }

  @Get(':id/items')
  @Header('Cache-Control', 'no-store, private')
  @PassiveRequest()
  @ApiOkResponse({ type: GraduationBatchItemPageDto })
  items(
    @CurrentAccess() access: AccessContext,
    @Param('id') id: string,
    @Query() query: GraduationBatchItemQueryDto,
  ) {
    return this.batches.items(access, id, query);
  }

  @Get(':id/export')
  @Header('Cache-Control', 'no-store, private')
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  async export(
    @CurrentAccess() access: AccessContext,
    @Param('id') id: string,
    @Query() query: GraduationBatchExportQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.exporter.export(access, id, query);
    return sendFile(response, file.body, file.fileName, file.mime);
  }
}
