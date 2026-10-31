import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { APP_TIME_ZONE } from '../../shared/time/today.js';
import { safeError } from '../../shared/logging/app-logger.js';

export const RELEASE_ACTIVATION_QUEUE = 'release-activation';
export const RELEASE_ACTIVATION_JOB = 'reconcile-due-versions';
// Every day just after midnight in the school's time zone.
export const RELEASE_ACTIVATION_CRON = '5 0 * * *';
const ACTIVATION_ATTEMPTS = 3;
const ACTIVATION_BACKOFF_MS = 10_000;
const FAILED_JOBS_KEPT = 20;

// The job carries nothing: it looks at the database, so a lost or repeated job cannot change the result (K-7).
export type ActivationJobPayload = Record<string, never>;

// PB-06: due Pending versions are activated at every start-up (a restart after the semester began catches up)
// and once a day. Redis holds the schedule only; the versions themselves are the truth.
@Injectable()
export class ReleaseActivationScheduler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ReleaseActivationScheduler.name);

  constructor(
    @InjectQueue(RELEASE_ACTIVATION_QUEUE) private readonly queue: Queue,
  ) {}

  // Not awaited: BullMQ queues commands until Redis answers, so awaiting here would hold the
  // whole API at start-up for as long as Redis is down. The jobs are sent once it connects.
  onApplicationBootstrap(): void {
    void this.schedule();
  }

  async schedule(): Promise<void> {
    const options = {
      attempts: ACTIVATION_ATTEMPTS,
      backoff: { type: 'exponential', delay: ACTIVATION_BACKOFF_MS },
      removeOnComplete: true,
      removeOnFail: FAILED_JOBS_KEPT,
    };
    try {
      await this.queue.upsertJobScheduler(
        RELEASE_ACTIVATION_JOB,
        { pattern: RELEASE_ACTIVATION_CRON, tz: APP_TIME_ZONE },
        { name: RELEASE_ACTIVATION_JOB, data: {}, opts: options },
      );
      // A fresh id per start-up: a completed boot job from an earlier run must not swallow this one.
      await this.queue.add(
        RELEASE_ACTIVATION_JOB,
        {},
        {
          ...options,
          jobId: `activation-on-boot-${process.pid}-${Date.now()}`,
        },
      );
    } catch (error) {
      // Redis down at start-up must not stop the API: the daily schedule or the next start-up reconciles.
      this.logger.error(
        `release.schedule_failed errorType=${safeError(error).errorType}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
