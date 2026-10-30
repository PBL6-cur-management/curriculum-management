import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnModuleDestroy } from '@nestjs/common';
import type { Job } from 'bullmq';
import { GRADUATION_LIMITS } from '../../shared/graduation/graduation.constants.js';
import { graduationExecutionError } from '../../shared/graduation/graduation-execution-error.js';
import { GraduationBatchRunner } from './graduation-batch.runner.js';
import {
  GRADUATION_JOB,
  GRADUATION_JOB_HANDLERS,
  GRADUATION_QUEUE,
  GraduationLeaseLostError,
  type GraduationJobData,
  type GraduationJobHandlers,
} from './graduation-jobs.constants.js';

@Processor(GRADUATION_QUEUE, {
  concurrency: GRADUATION_LIMITS.WORKER_CONCURRENCY,
})
export class GraduationProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(GraduationProcessor.name);
  private readonly inFlight = new Set<Promise<void>>();
  private closing = false;

  constructor(
    private readonly batches: GraduationBatchRunner,
    @Inject(GRADUATION_JOB_HANDLERS)
    private readonly handlers: GraduationJobHandlers,
  ) {
    super();
  }

  async process(job: Job<GraduationJobData>): Promise<void> {
    if (this.closing)
      throw new Error('Bộ xử lý đang dừng; tác vụ sẽ được phục hồi.');
    const work = this.execute(job);
    this.inFlight.add(work);
    try {
      await work;
    } finally {
      this.inFlight.delete(work);
    }
  }

  private async execute(job: Job<GraduationJobData>): Promise<void> {
    try {
      await this.dispatch(job);
    } catch (error) {
      if (error instanceof GraduationLeaseLostError) return;
      this.logger.error(
        `GRADUATION_JOB_FAILED job=${job.id ?? job.name} ${graduationExecutionError(error)}`,
      );
      if (
        job.attemptsMade + 1 >=
        (job.opts.attempts ?? GRADUATION_LIMITS.JOB_ATTEMPTS)
      ) {
        if (job.name === GRADUATION_JOB.RUN_BATCH && 'batchId' in job.data) {
          await this.batches.fail(job.data.batchId);
        }
      }
      throw error;
    }
  }

  private async dispatch(job: Job<GraduationJobData>): Promise<void> {
    switch (job.name) {
      case GRADUATION_JOB.RUN_BATCH:
        if (!('batchId' in job.data) || !job.data.batchId)
          throw new Error('Thiếu mã đợt xét.');
        return this.batches.run(job.data.batchId);
      case GRADUATION_JOB.SCAN_CHANGES:
        return this.handlers.scanChanges();
      case GRADUATION_JOB.RUN_REAUDIT:
        if (!('taskId' in job.data) || !job.data.taskId)
          throw new Error('Thiếu mã tác vụ xét lại.');
        return this.handlers.runReaudit(job.data.taskId);
      case GRADUATION_JOB.RECOVER:
        await this.batches.recover();
        await this.handlers.recoverReaudits();
        await this.handlers.scanChanges();
        return;
      default:
        throw new Error('Tên tác vụ xét tốt nghiệp không được hỗ trợ.');
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.closing = true;
    void this.worker
      .pause(true)
      .catch(() =>
        this.logger.warn('Không thể tạm ngừng worker; lease sẽ phục hồi.'),
      );
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        Promise.allSettled(this.inFlight),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, GRADUATION_LIMITS.SHUTDOWN_GRACE_MS);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    await this.worker.close(true);
  }
}
