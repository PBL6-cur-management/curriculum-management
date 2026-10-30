import { randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { GRADUATION_LIMITS } from '../../shared/graduation/graduation.constants.js';
import {
  GRADUATION_JOB,
  GRADUATION_JOB_OPTIONS,
  GRADUATION_QUEUE,
} from './graduation-jobs.constants.js';

@Injectable()
export class GraduationScheduler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(GraduationScheduler.name);
  private retryTimer?: NodeJS.Timeout;
  private closing = false;

  constructor(@InjectQueue(GRADUATION_QUEUE) private readonly queue: Queue) {}

  onApplicationBootstrap(): void {
    void this.schedule();
  }

  async schedule(): Promise<void> {
    try {
      for (const name of [
        GRADUATION_JOB.SCAN_CHANGES,
        GRADUATION_JOB.RECOVER,
      ]) {
        if (this.closing) return;
        await this.queue.upsertJobScheduler(
          name,
          { every: GRADUATION_LIMITS.SCAN_INTERVAL_MS },
          { name, data: {}, opts: GRADUATION_JOB_OPTIONS },
        );
      }
      if (!this.closing)
        await this.queue.add(
          GRADUATION_JOB.RECOVER,
          {},
          {
            ...GRADUATION_JOB_OPTIONS,
            jobId: `graduation-boot-${randomUUID()}`,
          },
        );
    } catch {
      this.logger.error(
        'GRADUATION_JOB_FAILED: không đăng ký được lịch phục hồi; sẽ thử lại.',
      );
      if (!this.closing) {
        this.retryTimer = setTimeout(() => {
          void this.schedule();
        }, GRADUATION_LIMITS.SCAN_INTERVAL_MS);
        this.retryTimer.unref();
      }
    }
  }

  async enqueueBatch(batchId: string): Promise<void> {
    await this.queue.add(
      GRADUATION_JOB.RUN_BATCH,
      { batchId },
      {
        ...GRADUATION_JOB_OPTIONS,
        jobId: `graduation-batch-${batchId}`,
      },
    );
  }

  async enqueueReaudit(taskId: string): Promise<void> {
    await this.queue.add(
      GRADUATION_JOB.RUN_REAUDIT,
      { taskId },
      {
        ...GRADUATION_JOB_OPTIONS,
        jobId: `graduation-reaudit-${taskId}`,
      },
    );
  }

  onModuleDestroy(): void {
    this.closing = true;
    clearTimeout(this.retryTimer);
  }
}
