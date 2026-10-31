import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleDestroy } from '@nestjs/common';
import { ProgramVersionStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { VersionActivator } from '../../shared/releases/version.activator.js';
import { todayDate } from '../../shared/time/today.js';
import {
  RELEASE_ACTIVATION_JOB,
  RELEASE_ACTIVATION_QUEUE,
} from './release-activation.scheduler.js';
import { safeError } from '../../shared/logging/app-logger.js';

const SHUTDOWN_GRACE_MS = 10_000;

@Processor(RELEASE_ACTIVATION_QUEUE)
export class ReleaseActivationProcessor
  extends WorkerHost
  implements OnModuleDestroy
{
  private readonly logger = new Logger(ReleaseActivationProcessor.name);
  private inFlight: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly activator: VersionActivator,
  ) {
    super();
  }

  async process(job: { name: string }): Promise<number> {
    if (job.name !== RELEASE_ACTIVATION_JOB) return 0;
    const run = this.reconcile();
    this.inFlight = run.catch(() => undefined);
    return run;
  }

  // Oldest release first, one transaction per version: a failing version is logged and the others still go.
  // The job then fails so BullMQ retries it; a version already Active is a no-op on the retry (K-7).
  async reconcile(today: Date = todayDate()): Promise<number> {
    const due = await this.prisma.programVersion.findMany({
      where: {
        status: ProgramVersionStatus.PENDING,
        effectiveSemester: { startDate: { lte: today } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    let activated = 0;
    const failed: string[] = [];
    for (const version of due) {
      try {
        const done = await this.prisma.$transaction((tx) =>
          this.activator.activate(tx, version.id, today),
        );
        if (done) {
          activated += 1;
          this.logger.log(`Version ${version.id} activated`);
        }
      } catch (error) {
        failed.push(version.id);
        this.logger.error(
          `release.activation_failed version=${version.id} errorType=${safeError(error).errorType}`,
        );
      }
    }
    if (failed.length > 0) {
      throw new Error(`Activation failed for ${failed.join(', ')}`);
    }
    return activated;
  }

  // The job in progress is given a moment to finish its transaction. The worker is then closed by force: a graceful
  // close waits on Redis's answer, which never comes when Redis is gone, and app.close() must always return. A job cut
  // off here is retried and finds its versions already Active or still Pending (K-7).
  async onModuleDestroy(): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const grace = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, SHUTDOWN_GRACE_MS);
    });
    try {
      await Promise.race([this.inFlight, grace]);
    } finally {
      clearTimeout(timer);
    }
    await this.worker.close(true);
  }
}
