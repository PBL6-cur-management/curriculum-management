import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { APP_TIME_ZONE } from '../../shared/time/today.js';

export const STUDENT_ENROLLMENT_QUEUE = 'student-enrollment';
export const STUDENT_ENROLLMENT_JOB = 'reconcile-enrollments';
export const STUDENT_ENROLLMENT_SCHEDULE = {
  ID: 'student-enrollment-daily',
  CRON: '10 0 * * *',
  ATTEMPTS: 3,
  BACKOFF_MS: 5_000,
  SHUTDOWN_GRACE_MS: 10_000,
  FAILED_JOBS_KEPT: 20,
} as const;

export interface EnrollmentReconciliationJob {
  // Absent = every program that has an open enrollment.
  programId?: string;
}

// The job reads the database, so a lost or repeated job cannot change the result. Redis holds the schedule only.
@Injectable()
export class EnrollmentReconciliationScheduler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(EnrollmentReconciliationScheduler.name);

  constructor(
    @InjectQueue(STUDENT_ENROLLMENT_QUEUE) private readonly queue: Queue,
  ) {}

  // Not awaited: BullMQ queues commands until Redis answers, so awaiting would hold the API at start-up while Redis is down.
  onApplicationBootstrap(): void {
    void this.schedule();
  }

  async schedule(): Promise<void> {
    const options = {
      attempts: STUDENT_ENROLLMENT_SCHEDULE.ATTEMPTS,
      backoff: {
        type: 'exponential',
        delay: STUDENT_ENROLLMENT_SCHEDULE.BACKOFF_MS,
      },
      removeOnComplete: true,
      removeOnFail: STUDENT_ENROLLMENT_SCHEDULE.FAILED_JOBS_KEPT,
    };
    const data: EnrollmentReconciliationJob = {};
    try {
      await this.queue.upsertJobScheduler(
        STUDENT_ENROLLMENT_SCHEDULE.ID,
        { pattern: STUDENT_ENROLLMENT_SCHEDULE.CRON, tz: APP_TIME_ZONE },
        { name: STUDENT_ENROLLMENT_JOB, data, opts: options },
      );
      // A fresh id per start-up: a completed boot job from an earlier run must not swallow this one.
      await this.queue.add(STUDENT_ENROLLMENT_JOB, data, {
        ...options,
        jobId: `enrollment-on-boot-${process.pid}-${Date.now()}`,
      });
    } catch (error) {
      this.logger.error(
        `Could not schedule the enrollment job: ${String(error)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
