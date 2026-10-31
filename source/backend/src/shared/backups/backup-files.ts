import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { lstat, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type pg from 'pg';
import { TRANSPORT_SUFFIX } from './backup.constants.js';
import { BACKUP_ERRORS, BackupFailure } from './backup.errors.js';
import type { AttachmentReference, FileEvidence } from './backup.types.js';

// Files that must never sit among attachments; their presence means the root is misconfigured, not data.
const FORBIDDEN_NAME = /^\.env(\..*)?$/i;

export async function evidenceOf(
  file: string,
  name: string,
): Promise<FileEvidence> {
  const { size } = await stat(file);
  return {
    path: name,
    sizeBytes: String(size),
    sha256: await sha256File(file),
  };
}

export async function sha256File(file: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(file), hash);
  return hash.digest('hex');
}

// Every regular file under `root`, as '/'-separated relative paths, sorted. Links and devices refuse the tree.
export async function listFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string, prefix: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        throw new BackupFailure(BACKUP_ERRORS.ROOT_INVALID);
      }
      if (entry.isDirectory()) {
        await walk(full, relative);
      } else if (entry.isFile()) {
        if (FORBIDDEN_NAME.test(entry.name)) {
          throw new BackupFailure(BACKUP_ERRORS.ROOT_INVALID);
        }
        if (!entry.name.endsWith(TRANSPORT_SUFFIX)) out.push(relative);
      } else {
        throw new BackupFailure(BACKUP_ERRORS.ROOT_INVALID);
      }
    }
  }
  await walk(root, '');
  return out.sort();
}

// BE-04 step 4: copy every durable final file, hashing while copying. A file that vanishes or changes size or
// time under us fails the attempt (it retries); it is never skipped.
export async function copyFiles(
  source: string,
  target: string,
  signal: AbortSignal,
): Promise<FileEvidence[]> {
  const evidence: FileEvidence[] = [];
  for (const relative of await listFiles(source)) {
    signal.throwIfAborted();
    const from = path.join(source, ...relative.split('/'));
    const to = path.join(target, ...relative.split('/'));
    const before = await lstat(from).catch(() => null);
    if (!before) throw new BackupFailure(BACKUP_ERRORS.SOURCE_CHANGED, true);
    await mkdir(path.dirname(to), { recursive: true });
    const hash = createHash('sha256');
    let size = 0n;
    try {
      await pipeline(
        createReadStream(from),
        new Transform({
          transform(chunk: Buffer, _encoding, done) {
            hash.update(chunk);
            size += BigInt(chunk.length);
            done(null, chunk);
          },
        }),
        createWriteStream(to, { flags: 'wx' }),
        { signal },
      );
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') throw error;
      throw new BackupFailure(BACKUP_ERRORS.SOURCE_CHANGED, true);
    }
    const after = await stat(from).catch(() => null);
    if (
      !after ||
      BigInt(after.size) !== size ||
      after.mtimeMs !== before.mtimeMs
    ) {
      throw new BackupFailure(BACKUP_ERRORS.SOURCE_CHANGED, true);
    }
    evidence.push({
      path: relative,
      sizeBytes: size.toString(),
      sha256: hash.digest('hex'),
    });
  }
  return evidence;
}

// Re-hash a copied tree against its evidence: same paths, sizes and bytes, nothing missing or extra.
export async function verifyTree(
  root: string,
  expected: readonly FileEvidence[],
  signal: AbortSignal,
): Promise<boolean> {
  const present = await listFiles(root).catch(() => null);
  if (!present || present.length !== expected.length) return false;
  const wanted = new Map(expected.map((file) => [file.path, file]));
  for (const relative of present) {
    signal.throwIfAborted();
    const file = wanted.get(relative);
    if (!file) return false;
    const full = path.join(root, ...relative.split('/'));
    const stats = await stat(full);
    if (String(stats.size) !== file.sizeBytes) return false;
    if ((await sha256File(full)) !== file.sha256) return false;
  }
  return true;
}

export async function readAttachmentReferences(
  client: pg.Client,
): Promise<AttachmentReference[]> {
  const { rows } = await client.query<AttachmentReference>(
    `SELECT 'SyllabusAttachment' AS "table", id, "filePath" AS path, "sizeBytes"::text AS "sizeBytes"
       FROM "SyllabusAttachment"
     UNION ALL
     SELECT 'ChangeRequestDocument' AS "table", id, "filePath" AS path, "sizeBytes"::text AS "sizeBytes"
       FROM "ChangeRequestDocument"
     ORDER BY "table", id`,
  );
  return rows;
}

// BE-04 step 5: every byte the snapshot points at was copied, at its recorded size. Extra files are harmless.
export function assertReferenceCoverage(
  references: readonly AttachmentReference[],
  files: readonly FileEvidence[],
): void {
  const byPath = new Map(files.map((file) => [file.path, file]));
  for (const reference of references) {
    const file = byPath.get(reference.path);
    if (!file || file.sizeBytes !== reference.sizeBytes) {
      throw new BackupFailure(BACKUP_ERRORS.FILE_MISSING, true);
    }
  }
}
