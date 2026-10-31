import { Inject, Injectable } from '@nestjs/common';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import {
  latestDueSlot,
  slotInstant,
  backupIdOf,
  type BackupConfig,
} from '../../shared/backups/backup-config.js';
import { BACKUP_POLICY } from '../../shared/backups/backup.constants.js';
import {
  BACKUP_ERRORS,
  BackupFailure,
} from '../../shared/backups/backup.errors.js';
import { BackupStore } from '../../shared/backups/backup-store.js';
import type {
  BackupRunRecord,
  RestoreDrillRecord,
} from '../../shared/backups/backup.types.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { COMMON_ERRORS } from '../../shared/exception/error-codes.js';
import { toPage } from '../../shared/pagination/page.js';
import { APP_TIME_ZONE } from '../../shared/time/today.js';
import { BACKUP_CONFIG } from './backup.providers.js';
import type {
  BackupListQueryDto,
  BackupRunDto,
  BackupRunPageDto,
  BackupStatusDto,
  DrillListQueryDto,
  RestoreDrillDto,
  RestoreDrillPageDto,
} from './backups.dto.js';

interface Catalog {
  runs: BackupRunRecord[];
  drills: RestoreDrillRecord[];
  sets: string[];
}

// BE-07: reads the small JSON catalog only. A GET never dumps, hashes, prunes, schedules or repairs.
@Injectable()
export class BackupsService {
  constructor(@Inject(BACKUP_CONFIG) private readonly config: BackupConfig) {}

  // Database metadata is school-wide by nature: only a direct, unscoped grant may read it.
  private assertDirectAll(access: AccessContext) {
    if (
      access.modeFor(PERMISSIONS.BACKUP_VIEW, {}) !== 'DIRECT' ||
      !access.scopeFor(PERMISSIONS.BACKUP_VIEW).all
    ) {
      throw new AppException(COMMON_ERRORS.PERMISSION_DENIED);
    }
  }

  private async catalog(): Promise<Catalog> {
    if (!this.config.root) return { runs: [], drills: [], sets: [] };
    const store = new BackupStore(this.config.root);
    try {
      const [runs, drills, sets] = await Promise.all([
        store.listRuns(),
        store.listDrills(),
        store.listSetIds(),
      ]);
      return { runs, drills, sets };
    } catch (error) {
      // An unreadable catalog is an outage, not an empty history.
      const definition =
        error instanceof BackupFailure &&
        error.definition.code === BACKUP_ERRORS.CATALOG_INVALID.code
          ? BACKUP_ERRORS.CATALOG_INVALID
          : BACKUP_ERRORS.CATALOG_UNAVAILABLE;
      throw new AppException({
        ...definition,
        status: BACKUP_ERRORS.CATALOG_UNAVAILABLE.status,
      });
    }
  }

  async status(
    access: AccessContext,
    now: Date = new Date(),
  ): Promise<BackupStatusDto> {
    this.assertDirectAll(access);
    const { runs, drills, sets } = await this.catalog();
    return computeStatus(this.config.enabled, runs, drills, sets, now);
  }

  async list(
    query: BackupListQueryDto,
    access: AccessContext,
  ): Promise<BackupRunPageDto> {
    this.assertDirectAll(access);
    const { runs } = await this.catalog();
    const q = query.q?.toLowerCase();
    const filtered = runs
      .filter((run) => !query.status || run.status === query.status)
      .filter(
        (run) =>
          !q ||
          run.id.toLowerCase().includes(q) ||
          run.scheduledFor.includes(q),
      )
      .sort((a, b) =>
        order(query.sort, a.scheduledFor, b.scheduledFor, a.id, b.id),
      );
    const start = (query.page - 1) * query.pageSize;
    return toPage(
      filtered.slice(start, start + query.pageSize).map(toRunDto),
      filtered.length,
      query,
    );
  }

  async drills(
    query: DrillListQueryDto,
    access: AccessContext,
  ): Promise<RestoreDrillPageDto> {
    this.assertDirectAll(access);
    const { drills } = await this.catalog();
    const q = query.q?.toLowerCase();
    const filtered = drills
      .filter((drill) => !query.tier || drill.tier === query.tier)
      .filter((drill) => !query.status || drill.status === query.status)
      .filter(
        (drill) =>
          !q ||
          [drill.id, drill.backupId, drill.operator].some((v) =>
            v.toLowerCase().includes(q),
          ),
      )
      .sort((a, b) => order(query.sort, a.startedAt, b.startedAt, a.id, b.id));
    const start = (query.page - 1) * query.pageSize;
    return toPage(
      filtered.slice(start, start + query.pageSize).map(toDrillDto),
      filtered.length,
      query,
    );
  }
}

function order(
  sort: 'newest' | 'oldest' | undefined,
  a: string,
  b: string,
  aId: string,
  bId: string,
): number {
  const byValue = a === b ? aId.localeCompare(bId) : a.localeCompare(b);
  return sort === 'oldest' ? byValue : -byValue;
}

const isStale = (run: BackupRunRecord, now: Date) =>
  now.getTime() - Date.parse(run.startedAt) >
  BACKUP_POLICY.OPERATION_TIMEOUT_MS;

// Precedence: disabled, running, a failure newer than the last success, a missed slot past its grace, ready.
export function computeStatus(
  enabled: boolean,
  runs: readonly BackupRunRecord[],
  drills: readonly RestoreDrillRecord[],
  sets: readonly string[],
  now: Date,
): BackupStatusDto {
  const dueSlot = latestDueSlot(now);
  const published = new Set(sets);
  const successes = runs
    .filter((run) => run.status === 'SUCCEEDED' && published.has(run.id))
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  const lastSuccess = successes[0] ?? null;
  const running = runs.find(
    (run) => run.status === 'RUNNING' && !isStale(run, now),
  );
  // A RUNNING record past the timeout is shown as a failure until a locked run reconciles it.
  const failures = runs
    .filter(
      (run) =>
        run.status === 'FAILED' ||
        run.status === 'INTERRUPTED' ||
        (run.status === 'RUNNING' && isStale(run, now)) ||
        run.retentionFailure !== null,
    )
    .map((run) => ({
      at: run.completedAt ?? run.startedAt,
      failure:
        run.failure ??
        run.retentionFailure ??
        new BackupFailure(BACKUP_ERRORS.TIMEOUT).toRecord(),
    }))
    .sort((a, b) => b.at.localeCompare(a.at));
  const lastFailure =
    failures[0] &&
    (!lastSuccess || failures[0].at > (lastSuccess.completedAt ?? ''))
      ? failures[0].failure
      : null;
  const dueDone = successes.some((run) => run.id === backupIdOf(dueSlot));
  const overdue =
    !dueDone &&
    now.getTime() >
      slotInstant(dueSlot).getTime() + BACKUP_POLICY.OVERDUE_GRACE_MS;
  const accepted = drills
    .filter((drill) => drill.status === 'SUCCEEDED' && drill.acceptedAt)
    .sort((a, b) => (b.acceptedAt ?? '').localeCompare(a.acceptedAt ?? ''));
  const state = !enabled
    ? 'DISABLED'
    : running
      ? 'RUNNING'
      : lastFailure
        ? 'FAILED'
        : overdue
          ? 'OVERDUE'
          : 'READY';
  return {
    state,
    schedule: BACKUP_POLICY.CRON,
    timeZone: APP_TIME_ZONE,
    retentionCount: BACKUP_POLICY.RETENTION_COUNT,
    retainedCount: successes.length,
    dueSlot,
    lastSuccessfulAt: lastSuccess?.completedAt ?? null,
    lastRecoveryMs: accepted[0]?.recoveryMs ?? null,
    lastAcceptedTier: accepted[0]?.tier ?? null,
    currentRunId: running?.id ?? null,
    lastFailure,
  };
}

// Whitelisted fields only: internal retention and target identity never leave the server.
export function toRunDto(run: BackupRunRecord): BackupRunDto {
  return {
    id: run.id,
    scheduledFor: run.scheduledFor,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    attempt: run.attempt,
    snapshotAt: run.snapshotAt,
    databaseBytes: run.databaseBytes,
    fileBytes: run.fileBytes,
    fileCount: run.fileCount,
    releasedVersionCount: run.releasedVersionCount,
    durationMs: run.durationMs,
    failure: run.failure && {
      code: run.failure.code,
      message: run.failure.message,
    },
  };
}

export function toDrillDto(drill: RestoreDrillRecord): RestoreDrillDto {
  return {
    id: drill.id,
    backupId: drill.backupId,
    tier: drill.tier,
    operator: drill.operator,
    status: drill.status,
    startedAt: drill.startedAt,
    completedAt: drill.completedAt,
    recoveryMs: drill.recoveryMs,
    databaseRestoreMs: drill.databaseRestoreMs,
    filesRestoreMs: drill.filesRestoreMs,
    verificationMs: drill.verificationMs,
    releasedVersionCount: drill.releasedVersionCount,
    checks: drill.checks.map((check) => ({
      code: check.code,
      passed: check.passed,
      message: check.message,
    })),
    acceptedAt: drill.acceptedAt,
    // The accepting operator is named in the note when it is someone else (BE-06).
    acceptanceNote:
      drill.acceptanceNote &&
      (drill.acceptedBy && drill.acceptedBy !== drill.operator
        ? `${drill.acceptanceNote} (nghiệm thu: ${drill.acceptedBy})`
        : drill.acceptanceNote),
    failure: drill.failure && {
      code: drill.failure.code,
      message: drill.failure.message,
    },
  };
}
