import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';
import {
  assertPlainDirectory,
  overlaps,
  requireRoot,
  type BackupConfig,
} from './backup-config.js';
import {
  BACKUP_POLICY,
  DELIVERY_TIERS,
  DRILL_DATABASE_NAME_PATTERN,
  SET_DUMP,
  SET_FILES,
  type DeliveryTier,
} from './backup.constants.js';
import { BACKUP_ERRORS, BackupFailure, failureOf } from './backup.errors.js';
import { copyFiles } from './backup-files.js';
import { connect, withBackupOperation } from './backup-session.js';
import { BackupStore } from './backup-store.js';
import type { DrillCheckRecord, RestoreDrillRecord } from './backup.types.js';
import { databaseNameOf, type PostgresTools } from './postgres-tools.js';
import { check, sourceIntact, verifyRestoredData } from './restore-verifier.js';

export interface RestoreDrillInput {
  backupId: string;
  tier: DeliveryTier;
  operator: string;
  targetDatabaseUrl: string;
  targetFilesRoot: string;
}

export interface DrillAcceptance {
  drillId: string;
  operator: string;
  passed: boolean;
  note: string;
}

const unsafe = () => new BackupFailure(BACKUP_ERRORS.DRILL_TARGET_UNSAFE);

function label(value: string, max: number): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) throw unsafe();
  return trimmed;
}

async function identity(client: pg.Client) {
  const { rows } = await client.query<{
    addr: string | null;
    port: number | null;
    db: string;
    sysid: string;
  }>(
    `SELECT host(inet_server_addr()) AS addr, inet_server_port() AS port, current_database() AS db,
            (SELECT system_identifier::text FROM pg_control_system()) AS sysid`,
  );
  return rows[0];
}

// BE-06: restore a published set into an operator-provisioned empty drill database and a new folder, then
// check it. Never the production database, never a reset, never an automatic cleanup of a failed target.
export class RestoreDrill {
  constructor(
    private readonly config: BackupConfig,
    private readonly tools: PostgresTools,
  ) {}

  private store(): BackupStore {
    return new BackupStore(requireRoot(this.config));
  }

  async restore(
    input: RestoreDrillInput,
    signal: AbortSignal,
  ): Promise<RestoreDrillRecord> {
    const store = this.store();
    const operator = label(input.operator, BACKUP_POLICY.OPERATOR_MAX);
    if (!DELIVERY_TIERS.includes(input.tier)) throw unsafe();
    const targetDatabase = databaseNameOf(input.targetDatabaseUrl);
    if (
      !DRILL_DATABASE_NAME_PATTERN.test(targetDatabase) ||
      targetDatabase === databaseNameOf(this.config.databaseUrl)
    ) {
      throw unsafe();
    }
    if (!path.isAbsolute(input.targetFilesRoot)) throw unsafe();
    const filesParent = await assertPlainDirectory(input.targetFilesRoot).catch(
      () => {
        throw unsafe();
      },
    );
    if (
      overlaps(filesParent, this.config.filesRoot) ||
      overlaps(filesParent, store.root)
    ) {
      throw unsafe();
    }

    return withBackupOperation(
      this.config.databaseUrl,
      signal,
      async (source) => {
        const manifest = await store.readManifest(input.backupId);
        if (targetDatabase === manifest.sourceDatabaseName) throw unsafe();
        const target = await connect(input.targetDatabaseUrl).catch(() => {
          throw unsafe();
        });
        try {
          const [sourceId, targetId] = await Promise.all([
            identity(source),
            identity(target),
          ]);
          if (
            sourceId.sysid === targetId.sysid &&
            sourceId.db === targetId.db
          ) {
            throw unsafe();
          }
          await assertEmptyTarget(target);
          // One fresh child per drill: the operator's folder itself is never written into or deleted.
          const filesDir = path.join(filesParent, `drill-${randomUUID()}`);
          await mkdir(filesDir);
          let drill: RestoreDrillRecord = {
            catalogVersion: BACKUP_POLICY.CATALOG_VERSION,
            id: randomUUID(),
            backupId: input.backupId,
            tier: input.tier,
            operator,
            status: 'RUNNING',
            startedAt: new Date().toISOString(),
            completedAt: null,
            recoveryMs: null,
            databaseRestoreMs: null,
            filesRestoreMs: null,
            verificationMs: null,
            releasedVersionCount: null,
            checks: [],
            acceptedAt: null,
            acceptanceNote: null,
            failure: null,
            targetDatabase,
            targetServer: `${targetId.addr ?? 'local'}:${targetId.port ?? ''}`,
            targetFilesDir: filesDir,
            acceptedBy: null,
            verifications: [],
          };
          await store.writeDrill(drill);
          const recovery = performance.now();
          const setDir = store.setDir(input.backupId);
          try {
            const intact = await sourceIntact(setDir, manifest, signal);
            drill.checks.push(
              check(
                'DUMP_HASH',
                intact,
                'Bản sao lưu nguyên vẹn (mã kiểm tra khớp).',
                'Bản sao lưu bị thay đổi hoặc hỏng.',
              ),
            );
            if (!intact)
              throw new BackupFailure(BACKUP_ERRORS.CHECKSUM_MISMATCH);

            const dbClock = performance.now();
            const restored = await this.tools.restore(
              path.join(setDir, SET_DUMP),
              input.targetDatabaseUrl,
              signal,
            );
            drill.databaseRestoreMs = Math.round(performance.now() - dbClock);
            drill.checks.push(
              check(
                'DB_RESTORE',
                restored.exitCode === 0,
                'pg_restore hoàn tất trong một giao dịch.',
                'pg_restore thất bại; đích được giữ nguyên để kiểm tra.',
              ),
            );
            if (restored.exitCode !== 0) {
              throw new BackupFailure(BACKUP_ERRORS.DRILL_RESTORE_FAILED);
            }

            const filesClock = performance.now();
            await copyFiles(path.join(setDir, SET_FILES), filesDir, signal);
            drill.filesRestoreMs = Math.round(performance.now() - filesClock);

            const verifyClock = performance.now();
            const fresh = await connect(input.targetDatabaseUrl);
            try {
              drill.checks.push(
                ...(await verifyRestoredData(
                  fresh,
                  filesDir,
                  manifest,
                  signal,
                )),
              );
            } finally {
              await fresh.end().catch(() => undefined);
            }
            drill.verificationMs = Math.round(performance.now() - verifyClock);
            drill.releasedVersionCount = manifest.releasedVersions.length;
            drill.recoveryMs = Math.round(performance.now() - recovery);
            drill.completedAt = new Date().toISOString();
            const passed = drill.checks.every((c) => c.passed);
            drill = {
              ...drill,
              status: passed ? 'RESTORED' : 'FAILED',
              failure: passed
                ? null
                : new BackupFailure(
                    BACKUP_ERRORS.DRILL_VERIFICATION_FAILED,
                  ).toRecord(),
              verifications: [{ at: drill.completedAt, passed }],
            };
          } catch (error) {
            drill = {
              ...drill,
              status: 'FAILED',
              completedAt: new Date().toISOString(),
              recoveryMs: Math.round(performance.now() - recovery),
              failure: failureOf(error),
            };
          }
          await store.writeDrill(drill);
          return drill;
        } finally {
          await target.end().catch(() => undefined);
        }
      },
    );
  }

  // Re-checks a restored target, e.g. after an upgrade migration. It never resets the recovery clock, and a
  // failure turns an accepted report into FAILED so its badge cannot lie.
  async verify(
    drillId: string,
    targetDatabaseUrl: string,
    signal: AbortSignal,
  ): Promise<DrillCheckRecord[]> {
    const store = this.store();
    const drill = await store.readDrill(drillId);
    if (databaseNameOf(targetDatabaseUrl) !== drill.targetDatabase) {
      throw unsafe();
    }
    const manifest = await store.readManifest(drill.backupId);
    const target = await connect(targetDatabaseUrl);
    try {
      const checks = await verifyRestoredData(
        target,
        drill.targetFilesDir,
        manifest,
        signal,
        true,
      );
      const passed = checks.every((c) => c.passed);
      await store.writeDrill({
        ...drill,
        status:
          !passed && drill.status === 'SUCCEEDED' ? 'FAILED' : drill.status,
        failure:
          !passed && drill.status === 'SUCCEEDED'
            ? new BackupFailure(
                BACKUP_ERRORS.DRILL_VERIFICATION_FAILED,
              ).toRecord()
            : drill.failure,
        verifications: [
          ...drill.verifications,
          { at: new Date().toISOString(), passed },
        ],
      });
      return checks;
    } finally {
      await target.end().catch(() => undefined);
    }
  }

  // D7: RESTORED is a machine fact; SUCCEEDED needs a person who walked the B4 scenarios on the restored copy.
  async accept(input: DrillAcceptance): Promise<RestoreDrillRecord> {
    const store = this.store();
    const drill = await store.readDrill(input.drillId);
    const operator = label(input.operator, BACKUP_POLICY.OPERATOR_MAX);
    const note = label(input.note, BACKUP_POLICY.ACCEPTANCE_NOTE_MAX);
    const outcome = input.passed ? 'SUCCEEDED' : 'FAILED';
    if (drill.acceptedAt) {
      if (
        drill.status === outcome &&
        drill.acceptedBy === operator &&
        drill.acceptanceNote === note
      ) {
        return drill;
      }
      throw new BackupFailure(BACKUP_ERRORS.DRILL_ALREADY_DECIDED);
    }
    if (drill.status !== 'RESTORED' || !drill.checks.every((c) => c.passed)) {
      throw new BackupFailure(BACKUP_ERRORS.DRILL_NOT_ACCEPTABLE);
    }
    const accepted: RestoreDrillRecord = {
      ...drill,
      status: outcome,
      acceptedAt: new Date().toISOString(),
      acceptanceNote: note,
      acceptedBy: operator,
      failure: input.passed
        ? null
        : new BackupFailure(BACKUP_ERRORS.DRILL_ACCEPTANCE_FAILED).toRecord(),
    };
    await store.writeDrill(accepted);
    return accepted;
  }
}

// An operator-provisioned, never-used database: no tables, views, sequences, functions or types of its own.
async function assertEmptyTarget(target: pg.Client): Promise<void> {
  const { rows } = await target.query<{ objects: string }>(
    `SELECT (
       (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%')
     + (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname NOT IN ('pg_catalog', 'information_schema'))
     + (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%')
     )::text AS objects`,
  );
  if (rows[0].objects !== '0') throw unsafe();
}
