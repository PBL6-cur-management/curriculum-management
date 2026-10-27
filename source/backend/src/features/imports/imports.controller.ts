import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiAcceptedResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ImportType } from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { CurrentAccess } from '../../shared/authz/current-access.decorator.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { RequirePermission } from '../../shared/authz/require-permission.decorator.js';
import {
  CreateImportDto,
  CreateImportFormDto,
  ImportListQueryDto,
} from './dto/import.dto.js';
import {
  ImportBatchDetailDto,
  ImportBatchPageDto,
  ImportTargetDto,
  ImportTypeOptionDto,
} from './dto/import-response.dto.js';
import { IMPORT_LIMITS, XLSX_MIME } from './import.constants.js';
import { sendXlsx } from './import-mapping.js';
import { ImportsService } from './imports.service.js';

@ApiTags('imports')
@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Get('types')
  @RequirePermission(
    PERMISSIONS.DATA_IMPORT_EXCEL,
    PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL,
  )
  @ApiOkResponse({ type: [ImportTypeOptionDto] })
  types(@CurrentAccess() access: AccessContext) {
    return this.imports.types(access);
  }

  @Get('curriculum-targets')
  @RequirePermission(PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL)
  @ApiOkResponse({ type: [ImportTargetDto] })
  targets(@CurrentAccess() access: AccessContext) {
    return this.imports.curriculumTargets(access);
  }

  @Get('templates/:importType')
  @RequirePermission(
    PERMISSIONS.DATA_IMPORT_EXCEL,
    PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL,
  )
  @ApiProduces(XLSX_MIME)
  async template(
    @Param('importType', new ParseEnumPipe(ImportType)) importType: ImportType,
    @CurrentAccess() access: AccessContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.imports.template(importType, access);
    return sendXlsx(res, file.content, file.fileName);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(
    PERMISSIONS.DATA_IMPORT_EXCEL,
    PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL,
  )
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: IMPORT_LIMITS.FILE_MAX_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateImportFormDto })
  @ApiCreatedResponse({ type: ImportBatchDetailDto })
  create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreateImportDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.imports.create(file, dto, access);
  }

  @Get()
  @RequirePermission(
    PERMISSIONS.DATA_IMPORT_EXCEL,
    PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL,
  )
  @ApiOkResponse({ type: ImportBatchPageDto })
  list(
    @Query() query: ImportListQueryDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.imports.list(query, access);
  }

  @Get(':batchId')
  @RequirePermission(
    PERMISSIONS.DATA_IMPORT_EXCEL,
    PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL,
  )
  @ApiOkResponse({ type: ImportBatchDetailDto })
  detail(
    @Param('batchId') batchId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.imports.detail(batchId, access);
  }

  @Post(':batchId/commit')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission(
    PERMISSIONS.DATA_IMPORT_EXCEL,
    PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL,
  )
  @ApiAcceptedResponse({ type: ImportBatchDetailDto })
  commit(
    @Param('batchId') batchId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.imports.commit(batchId, access);
  }

  @Get(':batchId/file')
  @RequirePermission(
    PERMISSIONS.DATA_IMPORT_EXCEL,
    PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL,
  )
  @ApiProduces(XLSX_MIME)
  async file(
    @Param('batchId') batchId: string,
    @CurrentAccess() access: AccessContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.imports.file(batchId, access);
    return sendXlsx(res, file.content, file.fileName);
  }
}
