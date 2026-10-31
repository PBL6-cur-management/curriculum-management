import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { requireRoot, type BackupConfig } from './backup-config.js';
import { BACKUP_POLICY } from './backup.constants.js';
import { BACKUP_ERRORS, BackupFailure } from './backup.errors.js';
import { readAttachmentReferences, sha256File } from './backup-files.js';
import {
  readMigrations,
  withBackupOperation,
  withExportedSnapshot,
  type MigrationEvidence,
} from './backup-session.js';
import { BackupStore } from './backup-store.js';
import {
  migrationEvidence,
  releaseEvidence,
  type DrillCheckRecord,
  type FileEvidence,
  type ReleaseEvidence,
} from './backup.types.js';
import {
  compareReleases,
  fingerprintReleasedContent,
  readReleasedRows,
} from './released-content.js';
import { check } from './restore-verifier.js';

export interface UpgradeVerificationRecord {
  catalogVersion: number;
  id: string;
  operator: string;
  sourceDatabaseName: string;
  capturedAt: string;
  comparedAt: string | null;
  projectionVersion: number;
  releasedVersions: ReleaseEvidence[];
  migrations: MigrationEvidence[];
  checks: DrillCheckRecord[];
  state: 'BASELINE' | 'PASSED' | 'FAILED';
}

interface LiveGraph {
  sourceDatabaseName: string;
  releasedVersions: ReleaseEvidence[];
  migrations: MigrationEvidence[];
  unfinished: number;
}

// NFR-14 / CV-187: a fresh baseline right before an upgrade (writes and workers stopped), then the same
// projection right after the migration. The baseline is never rewritten from upgraded data.
export class UpgradeVerifier {
  constructor(private readonly config: BackupConfig) {}

  private store(): BackupStore {
    return new BackupStore(requireRoot(this.config));
  }

  private read(signal: AbortSignal): Promise<LiveGraph> {
    return withBackupOperation(this.config.databaseUrl, signal, () =>
      withExportedSnapshot(this.config.databaseUrl, async (session) => {
        const rows = await readReleasedRows(session.client);
        const references = await readAttachmentReferences(session.client);
        const migrations = await readMigrations(session.client);
        // Only signed syllabus files enter the projection; their live bytes are hashed in place.
        const files: FileEvidence[] = [];
        for (const reference of references) {
          if (reference.table !== 'SyllabusAttachment') continue;
          const file = path.join(
            this.config.filesRoot,
            ...reference.path.split('/'),
          );
          const sha256 = await sha256File(file).catch(() => null);
          if (sha256) {
            files.push({
              path: reference.path,
              sizeBytes: reference.sizeBytes,
              sha256,
            });
          }
        }
        return {
          sourceDatabaseName: session.sourceDatabaseName,
          releasedVersions: fingerprintReleasedContent(rows, files).versions,
          migrations: migrations.completed,
          unfinished: migrations.unfinished,
        };
      }),
    );
  }

  async capture(
    operator: string,
    signal: AbortSignal,
  ): Promise<UpgradeVerificationRecord> {
    const name = operator.trim();
    if (!name || name.length > BACKUP_POLICY.OPERATOR_MAX) {
      throw new BackupFailure(BACKUP_ERRORS.DRILL_TARGET_UNSAFE);
    }
    const store = this.store();
    await store.ensureLayout();
    const live = await this.read(signal);
    const record: UpgradeVerificationRecord = {
      catalogVersion: BACKUP_POLICY.CATALOG_VERSION,
      id: randomUUID(),
      operator: name,
      sourceDatabaseName: live.sourceDatabaseName,
      capturedAt: new Date().toISOString(),
      comparedAt: null,
      projectionVersion: BACKUP_POLICY.PROJECTION_VERSION,
      releasedVersions: live.releasedVersions,
      migrations: live.migrations,
      checks: [],
      state: 'BASELINE',
    };
    await store.writeUpgrade(record);
    return record;
  }

  async compare(
    evidenceId: string,
    signal: AbortSignal,
  ): Promise<UpgradeVerificationRecord> {
    const store = this.store();
    const baseline = parseUpgrade(await store.readUpgrade(evidenceId));
    const live = await this.read(signal);
    const problems = compareReleases(
      baseline.releasedVersions,
      live.releasedVersions,
    );
    const have = new Map(live.migrations.map((m) => [m.name, m.checksum]));
    const migrationsOk =
      live.unfinished === 0 &&
      baseline.migrations.every((m) => have.get(m.name) === m.checksum);
    const checks = [
      check(
        'RELEASED_CONTENT',
        problems.length === 0,
        `${baseline.releasedVersions.length} phiên bản đã ban hành không đổi sau nâng cấp.`,
        `Nội dung đã ban hành bị đổi: ${problems.slice(0, 5).join('; ')}`,
      ),
      check(
        'MIGRATIONS',
        migrationsOk,
        'Mọi migration cũ còn nguyên; migration mới đã hoàn tất.',
        'Migration cũ bị đổi/mất hoặc còn migration dở dang.',
      ),
    ];
    const compared: UpgradeVerificationRecord = {
      ...baseline,
      comparedAt: new Date().toISOString(),
      checks,
      state: checks.every((c) => c.passed) ? 'PASSED' : 'FAILED',
    };
    await store.writeUpgrade(compared);
    return compared;
  }
}

function parseUpgrade(raw: unknown): UpgradeVerificationRecord {
  const record = raw as Partial<UpgradeVerificationRecord> | null;
  if (
    !record ||
    record.catalogVersion !== BACKUP_POLICY.CATALOG_VERSION ||
    record.projectionVersion !== BACKUP_POLICY.PROJECTION_VERSION ||
    typeof record.id !== 'string' ||
    !Array.isArray(record.releasedVersions) ||
    !Array.isArray(record.migrations)
  ) {
    throw new BackupFailure(BACKUP_ERRORS.CATALOG_INVALID);
  }
  return {
    ...(record as UpgradeVerificationRecord),
    releasedVersions: record.releasedVersions.map(releaseEvidence),
    migrations: record.migrations.map(migrationEvidence),
  };
}
