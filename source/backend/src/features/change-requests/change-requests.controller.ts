import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { CurrentAccess } from '../../shared/authz/current-access.decorator.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { AllowDelegate } from '../../shared/authz/allow-delegate.decorator.js';
import { RequirePermission } from '../../shared/authz/require-permission.decorator.js';
import { ChangeDiffDto } from '../../shared/change-requests/diff/change-diff.dto.js';
import {
  ReplaceAuthoredItemsDto,
  UserOptionDto,
  UserOptionQueryDto,
} from './authored-item.dto.js';
import { AuthoredItemsService } from './authored-items.service.js';
import { ChangeRequestDetailReader } from './change-request-detail.reader.js';
import {
  UploadChangeRequestDocumentDto,
  UploadDocumentFormDto,
} from './change-request-document.dto.js';
import { ChangeRequestDocumentsService } from './change-request-documents.service.js';
import {
  ChangeRequestQueryDto,
  ConflictQueryDto,
  CreateChangeRequestDto,
  UpdateChangeRequestDto,
} from './change-request.dto.js';
import {
  ChangeRequestDetailDto,
  ChangeRequestDocumentDto,
  ChangeRequestPageDto,
  ConflictDto,
} from './change-request-response.dto.js';
import { ChangeRequestsService } from './change-requests.service.js';
import { RequestItemsService } from './request-items.service.js';
import { SubmissionService } from './submission.service.js';
import { SubmitPreviewDto } from './submit-preview.dto.js';

// Authoring half of the request flow: create, edit, documents, submit, withdraw. Approval is F-14.
@ApiTags('change-requests')
@ApiCookieAuth()
@Controller('change-requests')
@RequirePermission(PERMISSIONS.CHANGE_REQUEST_VIEW)
export class ChangeRequestsController {
  constructor(
    private readonly requests: ChangeRequestsService,
    private readonly details: ChangeRequestDetailReader,
    private readonly authoredItems: AuthoredItemsService,
    private readonly items: RequestItemsService,
    private readonly submission: SubmissionService,
    private readonly documents: ChangeRequestDocumentsService,
  ) {}

  @Get()
  @ApiOkResponse({ type: ChangeRequestPageDto })
  list(
    @Query() query: ChangeRequestQueryDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.requests.list(query, access);
  }

  // Declared before ':id' so the literal paths win.
  @Get('conflicts')
  @ApiOkResponse({ type: [ConflictDto] })
  conflicts(
    @Query() query: ConflictQueryDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.requests.conflictsFor(query.targetType, query.targetId, access);
  }

  @Get('user-options')
  @RequirePermission(PERMISSIONS.CHANGE_REQUEST_CREATE_ORGANIZATIONAL)
  @ApiOkResponse({ type: [UserOptionDto] })
  userOptions(@Query() query: UserOptionQueryDto) {
    return this.authoredItems.userOptions(query.q);
  }

  // Who may create what is decided by the service: data types need changeRequest.create, ORGANIZATION its own permission.
  @Post()
  @ApiCreatedResponse({ type: ChangeRequestDetailDto })
  create(
    @Body() dto: CreateChangeRequestDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.requests.create(dto, access);
  }

  @AllowDelegate()
  @Get(':id')
  @ApiOkResponse({ type: ChangeRequestDetailDto })
  read(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return this.details.read(id, access);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ChangeRequestDetailDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateChangeRequestDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.requests.update(id, dto, access);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return this.requests.remove(id, access);
  }

  @Post(':id/rebase')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ChangeRequestDetailDto })
  rebase(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return this.requests.rebase(id, access);
  }

  @Put(':id/items')
  @ApiOkResponse({ type: ChangeRequestDetailDto })
  replaceItems(
    @Param('id') id: string,
    @Body() dto: ReplaceAuthoredItemsDto,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.authoredItems.replace(id, dto, access);
  }

  @AllowDelegate()
  @Get(':id/diff')
  @ApiOkResponse({ type: ChangeDiffDto })
  diff(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return this.items.diff(id, access);
  }

  @Get(':id/submit-preview')
  @ApiOkResponse({ type: SubmitPreviewDto })
  preview(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return this.submission.preview(id, access);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ChangeRequestDetailDto })
  submit(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return this.submission.submit(id, access);
  }

  @Post(':id/withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ChangeRequestDetailDto })
  withdraw(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return this.submission.withdraw(id, access);
  }

  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadDocumentFormDto })
  @ApiCreatedResponse({ type: ChangeRequestDocumentDto })
  upload(
    @Param('id') id: string,
    @Body() dto: UploadChangeRequestDocumentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.documents.upload(id, dto, file, access);
  }
}
