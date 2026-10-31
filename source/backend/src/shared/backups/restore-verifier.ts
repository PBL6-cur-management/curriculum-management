import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';
import {
  SET_DUMP,
  SET_FILES,
  SET_MANIFEST,
  SET_RELEASED_CONTENT,
  type DrillCheckCode,
} from './backup.constants.js';
import { BACKUP_ERRORS, BackupFailure } from './backup.errors.js';
import {
  evidenceOf,
  readAttachmentReferences,
  verifyTree,
} from './backup-files.js';
import { readMigrations } from './backup-session.js';
import {
  parseManifest,
  type AttachmentReference,
  type BackupManifest,
  type DrillCheckRecord,
  type FileEvidence,
} from './backup.types.js';
import {
  canonicalJson,
  compareReleases,
  fingerprintReleasedContent,
  readReleasedRows,
} from './released-content.js';

export const check = (
  code: DrillCheckCode,
  passed: boolean,
  ok: string,
  bad: string,
): DrillCheckRecord => ({ code, passed, message: passed ? ok : bad });

// BE-06 `inspect`: a detached set checked with Node alone, no database, Redis or PostgreSQL tools.
export async function verifyDetachedBundle(
  directory: string,
  signal: AbortSignal,
): Promise<BackupManifest> {
  let raw: unknown;
  try {
    raw = JSON.parse(
      await readFile(path.join(directory, SET_MANIFEST), 'utf8'),
    );
  } catch {
    throw new BackupFailure(BACKUP_ERRORS.CATALOG_INVALID);
  }
  const manifest = parseManifest(raw);
  if (!(await sourceIntact(directory, manifest, signal))) {
    throw new BackupFailure(BACKUP_ERRORS.CHECKSUM_MISMATCH);
  }
  return manifest;
}

// The dump, the released-content evidence and every copied file still hash to what the manifest recorded.
export async function sourceIntact(
  directory: string,
  manifest: BackupManifest,
  signal: AbortSignal,
): Promise<boolean> {
  const sameFile = async (name: string, expected: FileEvidence) => {
    const actual = await evidenceOf(path.join(directory, name), name).catch(
      () => null,
    );
    return (
      actual?.sha256 === expected.sha256 &&
      actual.sizeBytes === expected.sizeBytes
    );
  };
  return (
    (await sameFile(SET_DUMP, manifest.database)) &&
    (await sameFile(SET_RELEASED_CONTENT, manifest.releasedContent)) &&
    (await verifyTree(path.join(directory, SET_FILES), manifest.files, signal))
  );
}

const referenceKey = (r: AttachmentReference) =>
  `${r.table}|${r.id}|${r.path}|${r.sizeBytes}`;

// The checks that read a restored database and its files folder. `allowExtraMigrations` is the
// post-upgrade re-verification: more completed migrations are fine, a changed or missing one is not.
export async function verifyRestoredData(
  target: pg.Client,
  filesDir: string,
  manifest: BackupManifest,
  signal: AbortSignal,
  allowExtraMigrations = false,
): Promise<DrillCheckRecord[]> {
  const checks: DrillCheckRecord[] = [];
  const filesOk = await verifyTree(filesDir, manifest.files, signal);
  checks.push(
    check(
      'FILE_HASHES',
      filesOk,
      `${manifest.files.length} tệp khớp mã kiểm tra và kích thước.`,
      'Có tệp phục hồi thiếu, thừa hoặc khác mã kiểm tra.',
    ),
  );
  const references = await readAttachmentReferences(target);
  const expected = manifest.references.map(referenceKey).sort();
  const actual = references.map(referenceKey).sort();
  const filePaths = new Set(manifest.files.map((file) => file.path));
  const refsOk =
    canonicalJson(expected) === canonicalJson(actual) &&
    references.every((reference) => filePaths.has(reference.path));
  checks.push(
    check(
      'DB_FILE_REFERENCES',
      refsOk,
      `${references.length} tham chiếu tệp đính kèm đều trỏ tới tệp đã phục hồi.`,
      'Tham chiếu tệp trong cơ sở dữ liệu không khớp bản sao lưu.',
    ),
  );
  const projection = fingerprintReleasedContent(
    await readReleasedRows(target),
    manifest.files,
  );
  const problems = compareReleases(
    manifest.releasedVersions,
    projection.versions,
  );
  const releasedOk =
    problems.length === 0 &&
    projection.versions.length >= manifest.releasedVersions.length;
  checks.push(
    check(
      'RELEASED_CONTENT',
      releasedOk,
      `${manifest.releasedVersions.length} phiên bản đã ban hành khớp nội dung.`,
      `Nội dung đã ban hành khác: ${problems.slice(0, 5).join('; ')}`,
    ),
  );
  const { rows: locale } = await target.query<{
    provider: string;
    locale: string | null;
    version: string;
  }>(
    `SELECT datlocprovider::text AS provider, datlocale AS locale, current_setting('server_version_num') AS version
       FROM pg_database WHERE datname = current_database()`,
  );
  const localeOk =
    locale[0]?.provider === 'i' &&
    (locale[0].locale ?? '').toLowerCase().startsWith('vi') &&
    Math.floor(Number(locale[0].version) / 10_000) ===
      Math.floor(manifest.serverVersionNum / 10_000);
  checks.push(
    check(
      'LOCALE',
      localeOk,
      'PostgreSQL cùng phiên bản chính, sắp xếp ICU tiếng Việt.',
      'Đích không phải PostgreSQL cùng phiên bản chính với ICU vi-VN.',
    ),
  );
  const migrations = await readMigrations(target);
  const have = new Map(migrations.completed.map((m) => [m.name, m.checksum]));
  const baselineOk = manifest.migrations.every(
    (m) => have.get(m.name) === m.checksum,
  );
  const migrationsOk =
    migrations.unfinished === 0 &&
    baselineOk &&
    (allowExtraMigrations ||
      migrations.completed.length === manifest.migrations.length);
  checks.push(
    check(
      'MIGRATIONS',
      migrationsOk,
      `${migrations.completed.length} migration đã hoàn tất, khớp bản sao lưu.`,
      'Danh sách migration khác bản sao lưu hoặc còn migration dở dang.',
    ),
  );
  return checks;
}
