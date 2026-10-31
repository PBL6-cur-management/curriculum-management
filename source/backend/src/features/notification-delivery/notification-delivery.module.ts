import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NotificationsSharedModule } from '../../shared/notifications/notifications-shared.module.js';
import { ApprovalMaintenanceService } from './approval-maintenance.service.js';
import { EMAIL_QUEUE, MAINTENANCE_QUEUE } from './delivery.constants.js';
import {
  ApprovalMaintenanceProcessor,
  EmailPumpProcessor,
} from './delivery.processors.js';
import { DeliveryScheduler } from './delivery.scheduler.js';
import { EmailPumpService } from './email-pump.service.js';
import { MailerService } from './mailer.service.js';

// F-25: the email outbox pump and the nightly delegation/reminder pass.
@Module({
  imports: [
    BullModule.registerQueue(
      { name: EMAIL_QUEUE },
      { name: MAINTENANCE_QUEUE },
    ),
    NotificationsSharedModule,
  ],
  providers: [
    MailerService,
    EmailPumpService,
    ApprovalMaintenanceService,
    EmailPumpProcessor,
    ApprovalMaintenanceProcessor,
    DeliveryScheduler,
  ],
  exports: [EmailPumpService, ApprovalMaintenanceService],
})
export class NotificationDeliveryModule {}
