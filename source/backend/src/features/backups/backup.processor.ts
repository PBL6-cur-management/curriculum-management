import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnModuleDestroy } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { BackupConfig } from '../../shared/backups/backup-config.js';
import { BACKUP_POLICY } from '../../shared/backups/backup.constants.js';
import { BackupEngine } from '../../shared/backups/backup-engine.js';
import { BACKUP_CONFIG, BACKUP_JOB, BACKUP_QUEUE } from './backup.providers.js';
import type { BackupJobPayload } from './backup.scheduler.js';

@Processor(BACKUP_QUEUE, { concurrency: 1 })
export class BackupProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(BackupProcessor.name);
  private readonly running = new Set<AbortController>();

  constructor(
    private readonly engine: BackupEngine,
    @Inject(BACKUP_CONFIG) private readonly config: BackupConfig,
  ) {
    super();
  }

  async process(job: Job<BackupJobPayload>): Promise<void> {
    if (job.name !== BACKUP_JOB) {
      throw new Error(`Unknown backup job ${job.name}`);
    }
    // Disabled after the job was queued: ignore it, never touch the sets.
    if (!this.config.enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      BACKUP_POLICY.OPERATION_TIMEOUT_MS,
    );
    this.running.add(controller);
    try {
      const run = await this.engine.runDue(new Date(), controller.signal);
      this.logger.log(`Backup ${run.id}: ${run.status}`);
    } finally {
      clearTimeout(timer);
      this.running.delete(controller);
    }
  }

  // A shutdown stops the dump/copy; the next locked run reconciles whatever was left as INTERRUPTED.
  onModuleDestroy(): void {
    for (const controller of this.running) controller.abort();
  }
}
