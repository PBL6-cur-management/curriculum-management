import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  SET_DUMP,
  SET_FILES,
  SET_MANIFEST,
  SET_RELEASED_CONTENT,
} from './backup.constants.js';
import { BACKUP_ERRORS } from './backup.errors.js';
import { evidenceOf } from './backup-files.js';
import {
  check,
  sourceIntact,
  verifyDetachedBundle,
} from './restore-verifier.js';
import { parseManifest, safeRelativePath } from './backup.types.js';

const signal = () => new AbortController().signal;
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'f26-verify-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

// A real, self-consistent detached set: dump, released-content evidence, one attachment, manifest.
async function buildSet() {
  await writeFile(path.join(dir, SET_DUMP), 'dump-bytes');
  await writeFile(path.join(dir, SET_RELEASED_CONTENT), '{"versions":[]}');
  await mkdir(path.join(dir, SET_FILES, 'syllabus'), { recursive: true });
  await writeFile(path.join(dir, SET_FILES, 'syllabus', 'a.pdf'), 'pdf');
  const manifest = {
    catalogVersion: 1,
    projectionVersion: 1,
    backupId: 'daily-2026-10-31',
    scheduledFor: '2026-10-31',
    snapshotAt: '2026-10-31T02:00:00.000Z',
    completedAt: '2026-10-31T02:01:00.000Z',
    sourceDatabaseName: 'ctdt_real',
    serverVersionNum: 180000,
    dumpClientMajor: 18,
    database: await evidenceOf(path.join(dir, SET_DUMP), SET_DUMP),
    files: [
      await evidenceOf(
        path.join(dir, SET_FILES, 'syllabus', 'a.pdf'),
        'syllabus/a.pdf',
      ),
    ],
    references: [],
    releasedContent: await evidenceOf(
      path.join(dir, SET_RELEASED_CONTENT),
      SET_RELEASED_CONTENT,
    ),
    releasedVersions: [],
    migrations: [],
  };
  await writeFile(path.join(dir, SET_MANIFEST), JSON.stringify(manifest));
  return manifest;
}

describe('check', () => {
  it('picks the success or the failure message by the outcome', () => {
    expect(check('FILE_HASHES', true, 'ok', 'bad')).toEqual({
      code: 'FILE_HASHES',
      passed: true,
      message: 'ok',
    });
    expect(check('LOCALE', false, 'ok', 'bad')).toEqual({
      code: 'LOCALE',
      passed: false,
      message: 'bad',
    });
  });
});

describe('verifyDetachedBundle (offline inspect)', () => {
  it('accepts an intact set and returns its manifest', async () => {
    await buildSet();
    const manifest = await verifyDetachedBundle(dir, signal());
    expect(manifest.backupId).toBe('daily-2026-10-31');
    expect(manifest.files).toHaveLength(1);
  });

  it('rejects a flipped byte in the dump, the evidence file or an attachment', async () => {
    for (const target of [
      SET_DUMP,
      SET_RELEASED_CONTENT,
      path.join(SET_FILES, 'syllabus', 'a.pdf'),
    ]) {
      await buildSet();
      await writeFile(path.join(dir, target), 'tampered!!');
      await expect(verifyDetachedBundle(dir, signal())).rejects.toMatchObject({
        definition: BACKUP_ERRORS.CHECKSUM_MISMATCH,
      });
    }
  });

  it('rejects an attachment that was added to the set after the manifest was written', async () => {
    await buildSet();
    await writeFile(path.join(dir, SET_FILES, 'surprise.txt'), 'x');
    expect(await sourceIntact(dir, await buildManifestOnly(), signal())).toBe(
      false,
    );
  });

  it('reports a missing or malformed manifest as an invalid catalog', async () => {
    await expect(verifyDetachedBundle(dir, signal())).rejects.toMatchObject({
      definition: BACKUP_ERRORS.CATALOG_INVALID,
    });
    await writeFile(path.join(dir, SET_MANIFEST), '{not json');
    await expect(verifyDetachedBundle(dir, signal())).rejects.toMatchObject({
      definition: BACKUP_ERRORS.CATALOG_INVALID,
    });
  });
});

async function buildManifestOnly() {
  const raw = JSON.parse(
    await (await import('node:fs/promises')).readFile(
      path.join(dir, SET_MANIFEST),
      'utf8',
    ),
  );
  return parseManifest(raw);
}

describe('manifest validation', () => {
  it('safeRelativePath refuses traversal, absolute, drive, UNC and backslash paths', () => {
    for (const bad of [
      '',
      '/etc/passwd',
      '../x',
      'a/../b',
      'a//b',
      './a',
      'C:/x',
      'a\\b',
      '\\\\server\\share',
    ]) {
      expect(() => safeRelativePath(bad), bad).toThrow();
    }
    expect(safeRelativePath('syllabus/2026/a.pdf')).toBe('syllabus/2026/a.pdf');
  });

  it('parseManifest refuses a wrong id, bad hash, duplicate path (case-insensitive) or wrong catalog version', async () => {
    const good = await buildSet();
    expect(() => parseManifest({ ...good, backupId: 'weekly-1' })).toThrow();
    expect(() =>
      parseManifest({
        ...good,
        database: { ...good.database, sha256: 'xyz' },
      }),
    ).toThrow();
    expect(() => parseManifest({ ...good, catalogVersion: 2 })).toThrow();
    const file = good.files[0];
    expect(() =>
      parseManifest({
        ...good,
        files: [file, { ...file, path: file.path.toUpperCase() }],
      }),
    ).toThrow();
  });
});
