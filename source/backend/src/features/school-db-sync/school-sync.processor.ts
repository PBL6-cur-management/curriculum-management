import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import {
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { APP_TIME_ZONE } from '../../shared/time/today.js';
import {
  SCHOOL_SYNC_JOBS,
  SCHOOL_SYNC_QUEUE,
  SCHOOL_SYNC_TICK_CRON,
} from './school-sync.constants.js';
import { SchoolSyncRunner, type RunJobPayload } from './school-sync.runner.js';

const SHUTDOWN_GRACE_MS = 10_000;

// One queue, two jobs: the minute tick (reconcile) and a run (execute). Both read their truth from PostgreSQL.
@Processor(SCHOOL_SYNC_QUEUE)
export class SchoolSyncProcessor
  extends WorkerHost
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SchoolSyncProcessor.name);
  private inFlight: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly runner: SchoolSyncRunner,
    @InjectQueue(SCHOOL_SYNC_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  // Not awaited, like the release scheduler: Redis being down must not hold the API at start-up.
  onApplicationBootstrap(): void {
    void this.queue
      .upsertJobScheduler(
        SCHOOL_SYNC_JOBS.TICK,
        { pattern: SCHOOL_SYNC_TICK_CRON, tz: APP_TIME_ZONE },
        { name: SCHOOL_SYNC_JOBS.TICK, data: {}, opts: { removeOnComplete: true, removeOnFail: 20 } },
      )
      .catch((error: unknown) =>
        this.logger.error(`Could not schedule the school sync tick: ${String(error)}`),
      );
  }

  async process(job: Job): Promise<void> {
    const work =
      job.name === SCHOOL_SYNC_JOBS.RUN
        ? this.runner.execute((job.data as RunJobPayload).runId)
        : job.name === SCHOOL_SYNC_JOBS.TICK
          ? this.runner.reconcile()
          : Promise.resolve();
    this.inFlight = work.catch(() => undefined);
    await work;
  }

  async onModuleDestroy(): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const grace = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, SHUTDOWN_GRACE_MS);
    });
    try {
      await Promise.race([this.inFlight, grace]);
    } finally {
      clearTimeout(timer);
      await this.worker.close(true).catch(() => undefined);
      await this.queue.close().catch(() => undefined);
    }
  }
}
