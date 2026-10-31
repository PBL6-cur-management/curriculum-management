import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Logger } from '@nestjs/common';
import {
  assertSafeRoots,
  backupIdOf,
  latestDueSlot,
  requireRoot,
  type BackupConfig,
} from './backup-config.js';
import {
  BACKUP_POLICY,
  SET_DUMP,
  SET_FILES,
  SET_MANIFEST,
  SET_RELEASED_CONTENT,
} from './backup.constants.js';
import { BACKUP_ERRORS, BackupFailure, failureOf } from './backup.errors.js';
import {
  assertReferenceCoverage,
  copyFiles,
  evidenceOf,
  readAttachmentReferences,
} from './backup-files.js';
import {
  majorOf,
  readMigrations,
  withBackupOperation,
  withExportedSnapshot,
} from './backup-session.js';
import { BackupStore, runFromManifest } from './backup-store.js';
import {
  parseManifest,
  type BackupManifest,
  type BackupRunRecord,
} from './backup.types.js';
import type { PostgresTools } from './postgres-tools.js';
import {
  canonicalJson,
  fingerprintReleasedContent,
  readReleasedRows,
} from './released-content.js';
import { applyRetention } from './backup-retention.js';

// BE-04: one daily slot becomes one complete database + files pair, or a FAILED record and no visible set.
export class BackupEngine {
  private readonly logger = new Logger(BackupEngine.name);

  constructor(
    private readonly config: BackupConfig,
    private readonly tools: PostgresTools,
  ) {}

  store(): BackupStore {
    return new BackupStore(requireRoot(this.config));
  }

  async runDue(now: Date, signal: AbortSignal): Promise<BackupRunRecord> {
    const store = this.store();
    await assertSafeRoots(store.root, this.config.filesRoot);
    const slot = latestDueSlot(now);
    const backupId = backupIdOf(slot);
    return withBackupOperation(this.config.databaseUrl, signal, async () => {
      await store.reconcile();
      // A replayed job or a restarted Redis finds the slot already done: reuse it, never dump twice.
      if (await store.hasSet(backupId)) {
        const manifest = await store.readManifest(backupId);
        const run =
          (await store.readRun(backupId)) ?? runFromManifest(manifest, null);
        await this.retain(store, run);
        return run;
      }
      const previous = await store.readRun(backupId);
      const started = new Date();
      const clock = performance.now();
      let run: BackupRunRecord = {
        catalogVersion: BACKUP_POLICY.CATALOG_VERSION,
        id: backupId,
        scheduledFor: slot,
        status: 'RUNNING',
        startedAt: started.toISOString(),
        completedAt: null,
        attempt: (previous?.attempt ?? 0) + 1,
        snapshotAt: null,
        databaseBytes: null,
        fileBytes: null,
        fileCount: null,
        releasedVersionCount: null,
        durationMs: null,
        failure: null,
        retentionIntent: null,
        retentionFailure: null,
      };
      await store.writeRun(run);
      const stage = await store.createStaging(backupId);
      try {
        const manifest = await this.produce(
          store,
          stage,
          slot,
          backupId,
          signal,
        );
        signal.throwIfAborted();
        await store.publish(stage);
        run = {
          ...runFromManifest(manifest, run),
          durationMs: Math.round(performance.now() - clock),
        };
        await store.writeRun(run);
      } catch (error) {
        await store.removeOwned(stage, 'staging').catch(() => undefined);
        run = {
          ...run,
          status: 'FAILED',
          completedAt: new Date().toISOString(),
          durationMs: Math.round(performance.now() - clock),
          failure: failureOf(error),
        };
        await store.writeRun(run);
        this.logger.warn(`Backup ${backupId} failed: ${run.failure!.code}`);
        throw error;
      }
      this.logger.log(`Backup ${backupId} published`);
      await this.retain(store, run);
      return run;
    });
  }

  // A good pair stays good when pruning fails; the failure is recorded beside it and the job retries cleanup.
  private async retain(store: BackupStore, run: BackupRunRecord) {
    try {
      await applyRetention(store);
      if (run.retentionFailure) {
        await store.writeRun({ ...run, retentionFailure: null });
      }
    } catch (error) {
      const failure = new BackupFailure(BACKUP_ERRORS.RETENTION_FAILED, true);
      await store.writeRun({ ...run, retentionFailure: failure.toRecord() });
      this.logger.warn(`Retention failed: ${String(error)}`);
      throw failure;
    }
  }

  private async produce(
    store: BackupStore,
    stage: string,
    slot: string,
    backupId: string,
    signal: AbortSignal,
  ): Promise<BackupManifest> {
    const clientMajor = await this.tools.clientMajor(signal);
    const dumpFile = path.join(stage, SET_DUMP);
    const snapshot = await withExportedSnapshot(
      this.config.databaseUrl,
      async (session) => {
        const serverMajor = majorOf(session.serverVersionNum);
        if (
          serverMajor !== clientMajor ||
          serverMajor !== BACKUP_POLICY.POSTGRES_MAJOR
        ) {
          throw new BackupFailure(BACKUP_ERRORS.TOOL_VERSION_MISMATCH);
        }
        const references = await readAttachmentReferences(session.client);
        const rows = await readReleasedRows(session.client);
        const migrations = await readMigrations(session.client);
        if (migrations.unfinished > 0) {
          throw new BackupFailure(BACKUP_ERRORS.DUMP_FAILED, true);
        }
        // pg_dump imports this snapshot, so it must finish while the transaction is still open.
        await this.tools.dump(
          dumpFile,
          session.snapshotId,
          this.config.databaseUrl,
          signal,
        );
        const listed = await this.tools.inspect(dumpFile, signal);
        if (listed.exitCode !== 0) {
          throw new BackupFailure(BACKUP_ERRORS.DUMP_FAILED, true);
        }
        return { session, references, rows, migrations: migrations.completed };
      },
    );
    const files = await copyFiles(
      this.config.filesRoot,
      path.join(stage, SET_FILES),
      signal,
    );
    assertReferenceCoverage(snapshot.references, files);
    const projection = fingerprintReleasedContent(snapshot.rows, files);
    const contentFile = path.join(stage, SET_RELEASED_CONTENT);
    await writeFile(contentFile, canonicalJson(projection), 'utf8');
    const manifest = parseManifest({
      catalogVersion: BACKUP_POLICY.CATALOG_VERSION,
      projectionVersion: BACKUP_POLICY.PROJECTION_VERSION,
      backupId,
      scheduledFor: slot,
      snapshotAt: snapshot.session.snapshotAt,
      completedAt: new Date().toISOString(),
      sourceDatabaseName: snapshot.session.sourceDatabaseName,
      serverVersionNum: snapshot.session.serverVersionNum,
      dumpClientMajor: clientMajor,
      database: await evidenceOf(dumpFile, SET_DUMP),
      files,
      references: snapshot.references,
      releasedContent: await evidenceOf(contentFile, SET_RELEASED_CONTENT),
      releasedVersions: projection.versions,
      migrations: snapshot.migrations,
    });
    await store.writeJson(path.join(stage, SET_MANIFEST), manifest);
    return manifest;
  }
}
