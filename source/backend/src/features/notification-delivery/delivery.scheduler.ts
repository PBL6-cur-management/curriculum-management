import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { APP_TIME_ZONE } from '../../shared/time/today.js';
import {
  EMAIL_PUMP_EVERY_MS,
  EMAIL_PUMP_JOB,
  EMAIL_QUEUE,
  MAINTENANCE_CRON,
  MAINTENANCE_JOB,
  MAINTENANCE_QUEUE,
} from './delivery.constants.js';

const FAILED_JOBS_KEPT = 20;

// Redis holds the schedule only; deliveries, grants and the reminder ledger live in the database.
// Not awaited at start-up, like the release activation scheduler: Redis being down must not hold the API.
@Injectable()
export class DeliveryScheduler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(DeliveryScheduler.name);

  constructor(
    @InjectQueue(EMAIL_QUEUE) private readonly email: Queue,
    @InjectQueue(MAINTENANCE_QUEUE) private readonly maintenance: Queue,
  ) {}

  onApplicationBootstrap(): void {
    void this.schedule();
  }

  async schedule(): Promise<void> {
    const options = { removeOnComplete: true, removeOnFail: FAILED_JOBS_KEPT };
    try {
      await this.email.upsertJobScheduler(
        EMAIL_PUMP_JOB,
        { every: EMAIL_PUMP_EVERY_MS },
        { name: EMAIL_PUMP_JOB, data: {}, opts: options },
      );
      await this.maintenance.upsertJobScheduler(
        MAINTENANCE_JOB,
        { pattern: MAINTENANCE_CRON, tz: APP_TIME_ZONE },
        { name: MAINTENANCE_JOB, data: {}, opts: options },
      );
      await this.maintenance.add(
        MAINTENANCE_JOB,
        {},
        {
          ...options,
          jobId: `maintenance-on-boot-${process.pid}-${Date.now()}`,
        },
      );
    } catch (error) {
      this.logger.error(`Could not schedule delivery jobs: ${String(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.email.close(), this.maintenance.close()]);
  }
}
