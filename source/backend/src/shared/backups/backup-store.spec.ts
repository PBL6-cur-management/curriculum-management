import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SET_MANIFEST } from './backup.constants.js';
import { BACKUP_ERRORS } from './backup.errors.js';
import type { BackupManifest, BackupRunRecord } from './backup.types.js';
import { BackupStore, runFromManifest } from './backup-store.js';

const SHA = 'a'.repeat(64);
const evidence = (name: string, size = '10') => ({
  path: name,
  sizeBytes: size,
  sha256: SHA,
});

const manifest = (id = 'daily-2026-10-30'): BackupManifest => ({
  catalogVersion: 1,
  projectionVersion: 1,
  backupId: id,
  scheduledFor: id.slice(6),
  snapshotAt: '2026-10-30T02:00:00.000Z',
  completedAt: '2026-10-30T02:01:00.000Z',
  sourceDatabaseName: 'ctdt_real',
  serverVersionNum: 180000,
  dumpClientMajor: 18,
  database: evidence('database.dump', '100'),
  files: [evidence('a.pdf', '5'), evidence('b.pdf', '7')],
  references: [],
  releasedContent: evidence('released-content.json'),
  releasedVersions: [],
  migrations: [],
});

const run = (
  id: string,
  status: BackupRunRecord['status'],
): BackupRunRecord => ({
  catalogVersion: 1,
  id,
  scheduledFor: id.slice(6),
  status,
  startedAt: '2026-10-30T02:00:00.000Z',
  completedAt: null,
  attempt: 2,
  snapshotAt: null,
  databaseBytes: null,
  fileBytes: null,
  fileCount: null,
  releasedVersionCount: null,
  durationMs: null,
  failure: null,
  retentionIntent: null,
  retentionFailure: null,
});

let root: string;
let store: BackupStore;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'f26-store-'));
  store = new BackupStore(root);
  await store.ensureLayout();
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function publishSet(id: string) {
  const stage = await store.createStaging(id);
  await writeFile(path.join(stage, SET_MANIFEST), JSON.stringify(manifest(id)));
  await store.publish(stage);
}

describe('layout and ids', () => {
  it('creates the six catalog folders', async () => {
    for (const name of [
      'sets',
      'runs',
      'drills',
      'upgrades',
      'staging',
      'trash',
    ] as const) {
      await expect(readFile(path.join(store.dir(name), 'x'))).rejects.toThrow();
    }
  });

  it('refuses a set path for an id that is not daily-YYYY-MM-DD', () => {
    for (const bad of ['../x', 'weekly-2026-10-30', 'daily-2026-1-3', '']) {
      expect(() => store.setDir(bad), bad).toThrowError();
    }
    expect(store.setDir('daily-2026-10-30')).toBe(
      path.join(root, 'sets', 'daily-2026-10-30'),
    );
  });
});

describe('publish and read', () => {
  it('a set appears whole under sets/ and its manifest reads back', async () => {
    await publishSet('daily-2026-10-30');
    expect(await store.hasSet('daily-2026-10-30')).toBe(true);
    expect(await store.listSetIds()).toEqual(['daily-2026-10-30']);
    expect(
      (await store.readManifest('daily-2026-10-30')).database.sizeBytes,
    ).toBe('100');
  });

  it('rejects a manifest whose id disagrees with its folder', async () => {
    const stage = await store.createStaging('daily-2026-10-30');
    await writeFile(
      path.join(stage, SET_MANIFEST),
      JSON.stringify(manifest('daily-2026-10-29')),
    );
    await store.publish(stage);
    await expect(store.readManifest('daily-2026-10-30')).rejects.toMatchObject({
      definition: BACKUP_ERRORS.CATALOG_INVALID,
    });
  });

  it('reports a corrupt JSON file as an invalid catalog, not a crash', async () => {
    await publishSet('daily-2026-10-30');
    await writeFile(
      path.join(store.setDir('daily-2026-10-30'), SET_MANIFEST),
      '{broken',
    );
    await expect(store.readManifest('daily-2026-10-30')).rejects.toMatchObject({
      definition: BACKUP_ERRORS.CATALOG_INVALID,
    });
  });
});

describe('runs and drills', () => {
  it('writes a run atomically and lists it back; a missing run is null', async () => {
    await store.writeRun(run('daily-2026-10-30', 'SUCCEEDED'));
    expect((await store.listRuns()).map((r) => r.id)).toEqual([
      'daily-2026-10-30',
    ]);
    expect(await store.readRun('daily-2026-10-30')).not.toBeNull();
    expect(await store.readRun('daily-2026-01-01')).toBeNull();
  });

  it('leaves no temp file behind after a write', async () => {
    await store.writeRun(run('daily-2026-10-30', 'SUCCEEDED'));
    const { readdir } = await import('node:fs/promises');
    expect(await readdir(store.dir('runs'))).toEqual(['daily-2026-10-30.json']);
  });

  it('refuses drill and upgrade ids that are not a uuid shape', async () => {
    await expect(store.readDrill('../../etc')).rejects.toMatchObject({
      definition: BACKUP_ERRORS.CATALOG_INVALID,
    });
    await expect(store.readUpgrade('nope')).rejects.toMatchObject({
      definition: BACKUP_ERRORS.CATALOG_INVALID,
    });
  });
});

describe('owned-directory safety', () => {
  it('removeOwned deletes a generated staging child and nothing else', async () => {
    const stage = await store.createStaging('daily-2026-10-30');
    await store.removeOwned(stage, 'staging');
    expect(await store.ownedChildren('staging')).toEqual([]);

    const outsider = path.join(root, 'sets');
    await expect(store.removeOwned(outsider, 'staging')).rejects.toMatchObject({
      definition: BACKUP_ERRORS.ROOT_INVALID,
    });
    await expect(
      store.removeOwned(store.dir('staging'), 'staging'),
    ).rejects.toMatchObject({ definition: BACKUP_ERRORS.ROOT_INVALID });
  });

  it('refuses a directory that merely looks like an owned name but is wrong kind or a link', async () => {
    const stage = await store.createStaging('daily-2026-10-30');
    await expect(store.removeOwned(stage, 'trash')).rejects.toMatchObject({
      definition: BACKUP_ERRORS.ROOT_INVALID,
    });
    const real = path.join(root, 'elsewhere');
    await mkdir(real);
    const link = path.join(
      store.dir('trash'),
      'daily-2026-10-30-00000000-0000-0000-0000-000000000000',
    );
    try {
      await symlink(real, link, 'dir');
    } catch {
      return; // links need privileges on Windows
    }
    await expect(store.removeOwned(link, 'trash')).rejects.toMatchObject({
      definition: BACKUP_ERRORS.ROOT_INVALID,
    });
  });
});

describe('reconcile after a crash', () => {
  it('removes dead staging, interrupts a RUNNING run with no set, and expires leftover trash', async () => {
    const stale = await store.createStaging('daily-2026-10-29');
    await store.writeRun(run('daily-2026-10-28', 'RUNNING'));

    await publishSet('daily-2026-10-27');
    await store.writeRun(run('daily-2026-10-27', 'SUCCEEDED'));
    const trash = await store.moveToTrash('daily-2026-10-27');

    await store.reconcile(new Date('2026-10-31T00:00:00.000Z'));

    expect(await store.ownedChildren('staging')).toEqual([]);
    expect(stale).toBeTruthy();
    expect((await store.readRun('daily-2026-10-28'))?.status).toBe(
      'INTERRUPTED',
    );
    expect((await store.readRun('daily-2026-10-27'))?.status).toBe('EXPIRED');
    expect(await store.ownedChildren('trash')).toEqual([]);
    expect(trash).toBeTruthy();
  });

  it('rebuilds the run record of a published set that died before its record was written', async () => {
    await publishSet('daily-2026-10-30');
    await store.reconcile();
    const rebuilt = await store.readRun('daily-2026-10-30');
    expect(rebuilt?.status).toBe('SUCCEEDED');
    expect(rebuilt?.fileCount).toBe(2);
  });
});

describe('runFromManifest', () => {
  it('derives sizes, counts and duration from the manifest', () => {
    const result = runFromManifest(manifest(), null);
    expect(result).toMatchObject({
      status: 'SUCCEEDED',
      databaseBytes: '100',
      fileBytes: '12',
      fileCount: 2,
      releasedVersionCount: 0,
      attempt: 1,
      durationMs: 60_000,
      failure: null,
    });
  });

  it('keeps the previous attempt count, start time and retention failure', () => {
    const previous = {
      ...run('daily-2026-10-30', 'FAILED'),
      retentionFailure: { code: 'X', message: 'y' },
    };
    const result = runFromManifest(manifest(), previous);
    expect(result.attempt).toBe(2);
    expect(result.startedAt).toBe(previous.startedAt);
    expect(result.retentionFailure).toEqual({ code: 'X', message: 'y' });
  });
});
