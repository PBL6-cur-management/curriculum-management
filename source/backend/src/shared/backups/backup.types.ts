import {
  BACKUP_ID_PATTERN,
  BACKUP_POLICY,
  BACKUP_RUN_STATUSES,
  DELIVERY_TIERS,
  DRILL_CHECK_CODES,
  DRILL_STATUSES,
  type BackupRunStatus,
  type DeliveryTier,
  type DrillCheckCode,
  type DrillStatus,
} from './backup.constants.js';
import { BACKUP_ERRORS, BackupFailure } from './backup.errors.js';

export interface FileEvidence {
  path: string;
  sizeBytes: string;
  sha256: string;
}

export interface AttachmentReference {
  table: 'SyllabusAttachment' | 'ChangeRequestDocument';
  id: string;
  path: string;
  sizeBytes: string;
}

export interface ReleaseEvidence {
  versionId: string;
  sha256: string;
  nodeDigests: Record<string, string>;
  rowCounts: Record<string, number>;
}

export interface BackupManifest {
  catalogVersion: number;
  projectionVersion: number;
  backupId: string;
  scheduledFor: string;
  snapshotAt: string;
  completedAt: string;
  sourceDatabaseName: string;
  serverVersionNum: number;
  dumpClientMajor: number;
  database: FileEvidence;
  files: FileEvidence[];
  references: AttachmentReference[];
  releasedContent: FileEvidence;
  releasedVersions: ReleaseEvidence[];
  migrations: { name: string; checksum: string }[];
}

export interface FailureRecord {
  code: string;
  message: string;
}

export interface BackupRunRecord {
  catalogVersion: number;
  id: string;
  scheduledFor: string;
  status: BackupRunStatus;
  startedAt: string;
  completedAt: string | null;
  attempt: number;
  snapshotAt: string | null;
  databaseBytes: string | null;
  fileBytes: string | null;
  fileCount: number | null;
  releasedVersionCount: number | null;
  durationMs: number | null;
  failure: FailureRecord | null;
  // Internal: a set on its way to .trash (BE-05); never mapped to HTTP.
  retentionIntent: string | null;
  // Internal: a successful set whose old sets could not all be pruned; the set itself stays good.
  retentionFailure: FailureRecord | null;
}

export interface DrillCheckRecord {
  code: DrillCheckCode;
  passed: boolean;
  message: string;
}

export interface RestoreDrillRecord {
  catalogVersion: number;
  id: string;
  backupId: string;
  tier: DeliveryTier;
  operator: string;
  status: DrillStatus;
  startedAt: string;
  completedAt: string | null;
  recoveryMs: number | null;
  databaseRestoreMs: number | null;
  filesRestoreMs: number | null;
  verificationMs: number | null;
  releasedVersionCount: number | null;
  checks: DrillCheckRecord[];
  acceptedAt: string | null;
  acceptanceNote: string | null;
  failure: FailureRecord | null;
  // Internal, non-secret: which drill database and owned files folder this report verified.
  targetDatabase: string;
  targetServer: string;
  targetFilesDir: string;
  acceptedBy: string | null;
  verifications: { at: string; passed: boolean }[];
}

// ---- runtime validation: JSON.parse plus a cast is not a check (BE-03) ----

const invalid = (): never => {
  throw new BackupFailure(BACKUP_ERRORS.CATALOG_INVALID);
};
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : invalid());
const strOrNull = (v: unknown): string | null => (v === null ? null : str(v));
const count = (v: unknown): number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : invalid();
const countOrNull = (v: unknown): number | null =>
  v === null ? null : count(v);
const bytes = (v: unknown): string =>
  typeof v === 'string' && /^\d{1,20}$/.test(v) ? v : invalid();
const bytesOrNull = (v: unknown): string | null =>
  v === null ? null : bytes(v);
const sha = (v: unknown): string =>
  typeof v === 'string' && /^[a-f0-9]{64}$/.test(v) ? v : invalid();
const instant = (v: unknown): string =>
  typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : invalid();
const instantOrNull = (v: unknown): string | null =>
  v === null ? null : instant(v);
const day = (v: unknown): string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : invalid();
const oneOf = <T extends string>(values: readonly T[], v: unknown): T =>
  values.includes(v as T) ? (v as T) : invalid();
const array = (v: unknown): unknown[] => (Array.isArray(v) ? v : invalid());
const version = (v: unknown, expected: number): number =>
  v === expected ? v : invalid();
const failure = (v: unknown): FailureRecord | null =>
  v === null || v === undefined
    ? null
    : isObject(v)
      ? { code: str(v.code), message: str(v.message) }
      : invalid();

// Relative, '/'-separated, no traversal, drive letter, UNC or backslash alias.
export function safeRelativePath(v: unknown): string {
  const p = str(v);
  if (
    p.length === 0 ||
    p.startsWith('/') ||
    p.includes('\\') ||
    p.includes('\0') ||
    /^[a-zA-Z]:/.test(p) ||
    p.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    invalid();
  }
  return p;
}

const fileEvidence = (v: unknown): FileEvidence =>
  isObject(v)
    ? {
        path: safeRelativePath(v.path),
        sizeBytes: bytes(v.sizeBytes),
        sha256: sha(v.sha256),
      }
    : invalid();

const reference = (v: unknown): AttachmentReference =>
  isObject(v)
    ? {
        table: oneOf(['SyllabusAttachment', 'ChangeRequestDocument'], v.table),
        id: str(v.id),
        path: safeRelativePath(v.path),
        sizeBytes: bytes(v.sizeBytes),
      }
    : invalid();

const digestMap = (v: unknown): Record<string, string> =>
  isObject(v)
    ? Object.fromEntries(Object.entries(v).map(([k, d]) => [k, sha(d)]))
    : invalid();
const countMap = (v: unknown): Record<string, number> =>
  isObject(v)
    ? Object.fromEntries(Object.entries(v).map(([k, n]) => [k, count(n)]))
    : invalid();

export const releaseEvidence = (v: unknown): ReleaseEvidence =>
  isObject(v)
    ? {
        versionId: str(v.versionId),
        sha256: sha(v.sha256),
        nodeDigests: digestMap(v.nodeDigests),
        rowCounts: countMap(v.rowCounts),
      }
    : invalid();

export const migrationEvidence = (v: unknown) =>
  isObject(v) ? { name: str(v.name), checksum: str(v.checksum) } : invalid();

function unique<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) invalid();
    seen.add(k);
  }
  return items;
}

export function parseManifest(raw: unknown): BackupManifest {
  if (!isObject(raw)) return invalid();
  const backupId = str(raw.backupId);
  if (!BACKUP_ID_PATTERN.test(backupId)) invalid();
  const files = unique(array(raw.files).map(fileEvidence), (f) =>
    f.path.toLowerCase(),
  );
  return {
    catalogVersion: version(raw.catalogVersion, BACKUP_POLICY.CATALOG_VERSION),
    projectionVersion: version(
      raw.projectionVersion,
      BACKUP_POLICY.PROJECTION_VERSION,
    ),
    backupId,
    scheduledFor: day(raw.scheduledFor),
    snapshotAt: instant(raw.snapshotAt),
    completedAt: instant(raw.completedAt),
    sourceDatabaseName: str(raw.sourceDatabaseName),
    serverVersionNum: count(raw.serverVersionNum),
    dumpClientMajor: count(raw.dumpClientMajor),
    database: fileEvidence(raw.database),
    files,
    references: unique(
      array(raw.references).map(reference),
      (r) => `${r.table}:${r.id}`,
    ),
    releasedContent: fileEvidence(raw.releasedContent),
    releasedVersions: unique(
      array(raw.releasedVersions).map(releaseEvidence),
      (r) => r.versionId,
    ),
    migrations: array(raw.migrations).map(migrationEvidence),
  };
}

export function parseRun(raw: unknown): BackupRunRecord {
  if (!isObject(raw)) return invalid();
  const id = str(raw.id);
  if (!BACKUP_ID_PATTERN.test(id)) invalid();
  return {
    catalogVersion: version(raw.catalogVersion, BACKUP_POLICY.CATALOG_VERSION),
    id,
    scheduledFor: day(raw.scheduledFor),
    status: oneOf(BACKUP_RUN_STATUSES, raw.status),
    startedAt: instant(raw.startedAt),
    completedAt: instantOrNull(raw.completedAt),
    attempt: count(raw.attempt),
    snapshotAt: instantOrNull(raw.snapshotAt),
    databaseBytes: bytesOrNull(raw.databaseBytes),
    fileBytes: bytesOrNull(raw.fileBytes),
    fileCount: countOrNull(raw.fileCount),
    releasedVersionCount: countOrNull(raw.releasedVersionCount),
    durationMs: countOrNull(raw.durationMs),
    failure: failure(raw.failure),
    retentionIntent: raw.retentionIntent ? str(raw.retentionIntent) : null,
    retentionFailure: failure(raw.retentionFailure),
  };
}

const check = (v: unknown): DrillCheckRecord =>
  isObject(v)
    ? {
        code: oneOf(DRILL_CHECK_CODES, v.code),
        passed: typeof v.passed === 'boolean' ? v.passed : invalid(),
        message: str(v.message),
      }
    : invalid();

export function parseDrill(raw: unknown): RestoreDrillRecord {
  if (!isObject(raw)) return invalid();
  const id = str(raw.id);
  if (!/^[0-9a-f-]{36}$/.test(id)) invalid();
  return {
    catalogVersion: version(raw.catalogVersion, BACKUP_POLICY.CATALOG_VERSION),
    id,
    backupId: str(raw.backupId),
    tier: oneOf(DELIVERY_TIERS, raw.tier),
    operator: str(raw.operator),
    status: oneOf(DRILL_STATUSES, raw.status),
    startedAt: instant(raw.startedAt),
    completedAt: instantOrNull(raw.completedAt),
    recoveryMs: countOrNull(raw.recoveryMs),
    databaseRestoreMs: countOrNull(raw.databaseRestoreMs),
    filesRestoreMs: countOrNull(raw.filesRestoreMs),
    verificationMs: countOrNull(raw.verificationMs),
    releasedVersionCount: countOrNull(raw.releasedVersionCount),
    checks: array(raw.checks).map(check),
    acceptedAt: instantOrNull(raw.acceptedAt),
    acceptanceNote: strOrNull(raw.acceptanceNote),
    failure: failure(raw.failure),
    targetDatabase: str(raw.targetDatabase),
    targetServer: str(raw.targetServer),
    targetFilesDir: str(raw.targetFilesDir),
    acceptedBy: strOrNull(raw.acceptedBy ?? null),
    verifications: array(raw.verifications).map((v) =>
      isObject(v)
        ? {
            at: instant(v.at),
            passed: typeof v.passed === 'boolean' ? v.passed : invalid(),
          }
        : invalid(),
    ),
  };
}
