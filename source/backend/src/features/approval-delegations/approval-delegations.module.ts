import { Module } from '@nestjs/common';
import { NotificationsSharedModule } from '../../shared/notifications/notifications-shared.module.js';
import { ApprovalDelegationsController } from './approval-delegations.controller.js';
import { ApprovalDelegationsService } from './approval-delegations.service.js';

@Module({
  imports: [NotificationsSharedModule],
  controllers: [ApprovalDelegationsController],
  providers: [ApprovalDelegationsService],
})
export class ApprovalDelegationsModule {}
