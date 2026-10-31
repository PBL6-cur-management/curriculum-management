import { InjectQueue } from '@nestjs/bullmq';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { BackupConfig } from '../../shared/backups/backup-config.js';
import { BACKUP_POLICY } from '../../shared/backups/backup.constants.js';
import { APP_TIME_ZONE } from '../../shared/time/today.js';
import { BACKUP_CONFIG, BACKUP_JOB, BACKUP_QUEUE } from './backup.providers.js';

// The job carries nothing: the latest due slot is computed when it runs, so a replay cannot invent a backup.
export type BackupJobPayload = Record<string, never>;

// BE-05: 02:00 Vietnam time every day plus one catch-up at start-up. Redis holds only the schedule; the
// published sets are the truth. Not awaited at start-up, like the release activation scheduler.
@Injectable()
export class BackupScheduler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(BackupScheduler.name);

  constructor(
    @InjectQueue(BACKUP_QUEUE) private readonly queue: Queue,
    @Inject(BACKUP_CONFIG) private readonly config: BackupConfig,
  ) {}

  onApplicationBootstrap(): void {
    void this.schedule();
  }

  async schedule(): Promise<void> {
    try {
      if (!this.config.enabled) {
        // Only this feature's scheduler; retained sets and other queues are untouched.
        await this.queue.removeJobScheduler(BACKUP_JOB);
        return;
      }
      const options = {
        attempts: BACKUP_POLICY.ATTEMPTS,
        backoff: { type: 'exponential', delay: BACKUP_POLICY.BACKOFF_MS },
        removeOnComplete: true,
        removeOnFail: BACKUP_POLICY.QUEUE_FAILED_JOBS_KEPT,
      };
      await this.queue.upsertJobScheduler(
        BACKUP_JOB,
        { pattern: BACKUP_POLICY.CRON, tz: APP_TIME_ZONE },
        { name: BACKUP_JOB, data: {}, opts: options },
      );
      await this.queue.add(
        BACKUP_JOB,
        {},
        { ...options, jobId: `backup-on-boot-${process.pid}-${Date.now()}` },
      );
    } catch (error) {
      this.logger.error(`Could not schedule backups: ${String(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
