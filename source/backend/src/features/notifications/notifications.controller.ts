import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Body,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../shared/auth/authenticated-user.js';
import { CurrentUser } from '../../shared/auth/current-user.decorator.js';
import { AnyAuthenticated } from '../../shared/authz/any-authenticated.decorator.js';
import { PassiveRequest } from '../../shared/session/passive-request.decorator.js';
import {
  NotificationDto,
  NotificationPageDto,
  NotificationPreferenceDto,
  NotificationQueryDto,
  UpdateNotificationPreferenceDto,
  UnreadCountDto,
} from './notification.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('notifications')
@ApiCookieAuth()
@Controller('notifications')
@AnyAuthenticated()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOkResponse({ type: NotificationPageDto })
  list(
    @Query() query: NotificationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notifications.list(user.id, query);
  }

  // A background poll: it neither renews the idle timer nor counts as activity (NFR-08).
  @Get('unread-count')
  @PassiveRequest()
  @ApiOkResponse({ type: UnreadCountDto })
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.unreadCount(user.id);
  }

  @Get('preferences')
  @ApiOkResponse({ type: NotificationPreferenceDto })
  preferences(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.preferences(user.id);
  }

  @Patch('preferences')
  @ApiOkResponse({ type: NotificationPreferenceDto })
  updatePreferences(
    @Body() dto: UpdateNotificationPreferenceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notifications.updatePreferences(user.id, dto.emailEnabled);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UnreadCountDto })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: NotificationDto })
  markRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markRead(user.id, id);
  }
}
