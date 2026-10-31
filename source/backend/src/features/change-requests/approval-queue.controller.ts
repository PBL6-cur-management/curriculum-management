import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { CurrentAccess } from '../../shared/authz/current-access.decorator.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { AllowDelegate } from '../../shared/authz/allow-delegate.decorator.js';
import { RequirePermission } from '../../shared/authz/require-permission.decorator.js';
import {
  ApprovalQueueItemDto,
  ApprovalQueueQueryDto,
} from './approval-queue.dto.js';
import { ApprovalQueueReader } from './approval-queue.reader.js';

// Its own path, so the queue never meets `/change-requests/:id`.
@ApiTags('change-requests')
@ApiCookieAuth()
@Controller('approval-queue')
@RequirePermission(PERMISSIONS.CHANGE_REQUEST_VIEW)
export class ApprovalQueueController {
  constructor(private readonly queue: ApprovalQueueReader) {}

  @AllowDelegate()
  @Get()
  @ApiOkResponse({ type: [ApprovalQueueItemDto] })
  read(
    @Query() query: ApprovalQueueQueryDto,
    @CurrentAccess() access: AccessContext,
  ): Promise<ApprovalQueueItemDto[]> {
    return this.queue.read(query, access);
  }
}
