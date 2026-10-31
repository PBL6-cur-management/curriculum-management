import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BACKUP_PROVIDERS, BACKUP_QUEUE } from './backup.providers.js';
import { BackupProcessor } from './backup.processor.js';
import { BackupScheduler } from './backup.scheduler.js';
import { BackupsController } from './backups.controller.js';
import { BackupsService } from './backups.service.js';

// F-26: daily database + files backups, and the read-only status of backups and restore drills.
@Module({
  imports: [BullModule.registerQueue({ name: BACKUP_QUEUE })],
  controllers: [BackupsController],
  providers: [
    ...BACKUP_PROVIDERS,
    BackupsService,
    BackupProcessor,
    BackupScheduler,
  ],
})
export class BackupsModule {}
