import { Module } from '@nestjs/common';
import { NotificationsSharedModule } from '../../shared/notifications/notifications-shared.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [NotificationsSharedModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
