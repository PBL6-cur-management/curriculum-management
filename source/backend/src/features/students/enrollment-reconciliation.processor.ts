import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleDestroy } from '@nestjs/common';
import { EnrollmentStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import {
  EnrollmentReconciler,
  type ReconciliationCounts,
} from '../../shared/students/enrollment-reconciler.js';
import {
  STUDENT_ENROLLMENT_JOB,
  STUDENT_ENROLLMENT_QUEUE,
  STUDENT_ENROLLMENT_SCHEDULE,
  type EnrollmentReconciliationJob,
} from './enrollment-reconciliation.scheduler.js';

const emptyCounts = (): ReconciliationCounts => ({
  transitioned: 0,
  unchanged: 0,
  blocked: 0,
});

@Processor(STUDENT_ENROLLMENT_QUEUE)
export class EnrollmentReconciliationProcessor
  extends WorkerHost
  implements OnModuleDestroy
{
  private readonly logger = new Logger(EnrollmentReconciliationProcessor.name);
  private inFlight: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciler: EnrollmentReconciler,
  ) {
    super();
  }

  async process(job: {
    name: string;
    data?: EnrollmentReconciliationJob;
  }): Promise<ReconciliationCounts> {
    if (job.name !== STUDENT_ENROLLMENT_JOB) return emptyCounts();
    const run = this.reconcile(job.data?.programId);
    this.inFlight = run.catch(() => undefined);
    return run;
  }

  // One transaction per program: a failing program is logged and the others still go; the job then fails so BullMQ retries it, and a program already caught up is a no-op.
  async reconcile(programId?: string): Promise<ReconciliationCounts> {
    const programIds = programId ? [programId] : await this.openPrograms();
    const total = emptyCounts();
    const failed: string[] = [];
    for (const id of programIds) {
      try {
        const counts = await this.reconciler.reconcileProgram(id);
        total.transitioned += counts.transitioned;
        total.unchanged += counts.unchanged;
        total.blocked += counts.blocked;
      } catch (error) {
        failed.push(id);
        this.logger.error(`Reconciling ${id} failed: ${String(error)}`);
      }
    }
    if (failed.length > 0) {
      throw new Error(
        `Enrollment reconciliation failed for ${failed.join(', ')}`,
      );
    }
    return total;
  }

  private async openPrograms(): Promise<string[]> {
    const rows = await this.prisma.programEnrollment.findMany({
      where: {
        isException: false,
        status: EnrollmentStatus.ACTIVE,
        nextEnrollment: { is: null },
      },
      distinct: ['programId'],
      orderBy: { programId: 'asc' },
      select: { programId: true },
    });
    return rows.map((row) => row.programId);
  }

  // Gives the running job a moment to finish its transaction, then force-closes the worker: a graceful close waits on Redis, which never answers when Redis is gone.
  async onModuleDestroy(): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const grace = new Promise<void>((resolve) => {
      timer = setTimeout(
        resolve,
        STUDENT_ENROLLMENT_SCHEDULE.SHUTDOWN_GRACE_MS,
      );
    });
    try {
      await Promise.race([this.inFlight, grace]);
    } finally {
      clearTimeout(timer);
    }
    await this.worker.close(true);
  }
}
