import { randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
} from 'node:fs/promises';
import path from 'node:path';
import { isInside } from './backup-config.js';
import {
  BACKUP_ID_PATTERN,
  BACKUP_POLICY,
  SET_MANIFEST,
} from './backup.constants.js';
import { BACKUP_ERRORS, BackupFailure } from './backup.errors.js';
import {
  parseDrill,
  parseManifest,
  parseRun,
  type BackupManifest,
  type BackupRunRecord,
  type RestoreDrillRecord,
} from './backup.types.js';

const DIRS = {
  sets: 'sets',
  runs: 'runs',
  drills: 'drills',
  upgrades: 'upgrades',
  staging: '.staging',
  trash: '.trash',
} as const;
// <backup id>-<uuid>: the only names this store ever creates under .staging and .trash.
const OWNED_NAME = /^daily-\d{4}-\d{2}-\d{2}-[0-9a-f-]{36}$/;

// D2: the catalog lives beside the sets, not in the database it backs up, so it survives losing that database.
// Every JSON write is temp-then-rename; a published set directory is never written again.
export class BackupStore {
  constructor(readonly root: string) {}

  dir(name: keyof typeof DIRS): string {
    return path.join(this.root, DIRS[name]);
  }

  setDir(backupId: string): string {
    if (!BACKUP_ID_PATTERN.test(backupId)) {
      throw new BackupFailure(BACKUP_ERRORS.CATALOG_INVALID);
    }
    return path.join(this.dir('sets'), backupId);
  }

  async ensureLayout(): Promise<void> {
    for (const name of Object.keys(DIRS) as (keyof typeof DIRS)[]) {
      await mkdir(this.dir(name), { recursive: true });
    }
  }

  async writeJson(file: string, value: unknown): Promise<void> {
    const temp = `${file}.${randomUUID()}.tmp`;
    const handle = await open(temp, 'wx');
    try {
      await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temp, file);
  }

  private async readJson(file: string): Promise<unknown> {
    try {
      return JSON.parse(await readFile(file, 'utf8')) as unknown;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw error;
      throw new BackupFailure(BACKUP_ERRORS.CATALOG_INVALID);
    }
  }

  private async listJson<T>(
    dir: string,
    parse: (raw: unknown) => T,
  ): Promise<T[]> {
    const names = await readdir(dir).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return [] as string[];
      throw new BackupFailure(BACKUP_ERRORS.CATALOG_UNAVAILABLE);
    });
    const items: T[] = [];
    for (const name of names.filter((n) => n.endsWith('.json')).sort()) {
      items.push(parse(await this.readJson(path.join(dir, name))));
    }
    return items;
  }

  async readManifest(backupId: string): Promise<BackupManifest> {
    const manifest = parseManifest(
      await this.readJson(path.join(this.setDir(backupId), SET_MANIFEST)),
    );
    if (manifest.backupId !== backupId) {
      throw new BackupFailure(BACKUP_ERRORS.CATALOG_INVALID);
    }
    return manifest;
  }

  async hasSet(backupId: string): Promise<boolean> {
    return (await lstat(this.setDir(backupId)).catch(() => null)) !== null;
  }

  async listSetIds(): Promise<string[]> {
    const names = await readdir(this.dir('sets')).catch(() => [] as string[]);
    return names.filter((name) => BACKUP_ID_PATTERN.test(name)).sort();
  }

  listRuns(): Promise<BackupRunRecord[]> {
    return this.listJson(this.dir('runs'), parseRun);
  }

  listDrills(): Promise<RestoreDrillRecord[]> {
    return this.listJson(this.dir('drills'), parseDrill);
  }

  async readRun(backupId: string): Promise<BackupRunRecord | null> {
    try {
      return parseRun(
        await this.readJson(path.join(this.dir('runs'), `${backupId}.json`)),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async readDrill(drillId: string): Promise<RestoreDrillRecord> {
    if (!/^[0-9a-f-]{36}$/.test(drillId)) {
      throw new BackupFailure(BACKUP_ERRORS.CATALOG_INVALID);
    }
    return parseDrill(
      await this.readJson(path.join(this.dir('drills'), `${drillId}.json`)),
    );
  }

  writeRun(run: BackupRunRecord): Promise<void> {
    return this.writeJson(path.join(this.dir('runs'), `${run.id}.json`), run);
  }

  writeDrill(drill: RestoreDrillRecord): Promise<void> {
    return this.writeJson(
      path.join(this.dir('drills'), `${drill.id}.json`),
      drill,
    );
  }

  async writeUpgrade(record: { id: string }): Promise<void> {
    await this.writeJson(
      path.join(this.dir('upgrades'), `${record.id}.json`),
      record,
    );
  }

  async readUpgrade(id: string): Promise<unknown> {
    if (!/^[0-9a-f-]{36}$/.test(id)) {
      throw new BackupFailure(BACKUP_ERRORS.CATALOG_INVALID);
    }
    return this.readJson(path.join(this.dir('upgrades'), `${id}.json`));
  }

  // Exclusive creation: two attempts never share a staging folder.
  async createStaging(backupId: string): Promise<string> {
    const dir = path.join(this.dir('staging'), `${backupId}-${randomUUID()}`);
    await mkdir(dir);
    return dir;
  }

  // The visibility boundary: a set appears under sets/ whole or not at all.
  async publish(stage: string): Promise<void> {
    await this.assertOwned(stage, 'staging');
    const backupId = path.basename(stage).slice(0, 'daily-YYYY-MM-DD'.length);
    await rename(stage, this.setDir(backupId));
  }

  async moveToTrash(backupId: string): Promise<string> {
    const target = path.join(this.dir('trash'), `${backupId}-${randomUUID()}`);
    await rename(this.setDir(backupId), target);
    return target;
  }

  async removeOwned(dir: string, kind: 'staging' | 'trash'): Promise<void> {
    await this.assertOwned(dir, kind);
    await rm(dir, { recursive: true, force: true });
  }

  // Only a generated child of exactly .staging or .trash, never a link, never the parent itself.
  private async assertOwned(dir: string, kind: 'staging' | 'trash') {
    const parent = this.dir(kind);
    const stats = await lstat(dir).catch(() => null);
    if (
      path.dirname(path.resolve(dir)) !== path.resolve(parent) ||
      !isInside(parent, dir) ||
      !OWNED_NAME.test(path.basename(dir)) ||
      !stats?.isDirectory() ||
      stats.isSymbolicLink()
    ) {
      throw new BackupFailure(BACKUP_ERRORS.ROOT_INVALID);
    }
  }

  async ownedChildren(kind: 'staging' | 'trash'): Promise<string[]> {
    const names = await readdir(this.dir(kind)).catch(() => [] as string[]);
    return names
      .filter((name) => OWNED_NAME.test(name))
      .map((name) => path.join(this.dir(kind), name));
  }

  // Run under the operation lock: nothing else is writing. Leftover staging was a dead attempt; leftover trash
  // was an expiry in progress; a published set without a SUCCEEDED run died between rename and its record.
  async reconcile(now: Date = new Date()): Promise<void> {
    await this.ensureLayout();
    for (const stage of await this.ownedChildren('staging')) {
      await this.removeOwned(stage, 'staging');
    }
    for (const run of await this.listRuns()) {
      if (run.status === 'RUNNING' && !(await this.hasSet(run.id))) {
        await this.writeRun({
          ...run,
          status: 'INTERRUPTED',
          completedAt: now.toISOString(),
          failure: new BackupFailure(BACKUP_ERRORS.TIMEOUT).toRecord(),
        });
      }
    }
    for (const trash of await this.ownedChildren('trash')) {
      const backupId = path.basename(trash).slice(0, 'daily-YYYY-MM-DD'.length);
      const run = await this.readRun(backupId);
      if (run && run.status !== 'EXPIRED') {
        await this.writeRun({
          ...run,
          status: 'EXPIRED',
          retentionIntent: null,
        });
      }
      await this.removeOwned(trash, 'trash');
    }
    for (const backupId of await this.listSetIds()) {
      const run = await this.readRun(backupId);
      if (run?.status === 'SUCCEEDED') continue;
      const manifest = await this.readManifest(backupId);
      await this.writeRun(runFromManifest(manifest, run));
    }
  }
}

export function runFromManifest(
  manifest: BackupManifest,
  previous: BackupRunRecord | null,
): BackupRunRecord {
  const fileBytes = manifest.files.reduce(
    (sum, file) => sum + BigInt(file.sizeBytes),
    0n,
  );
  return {
    catalogVersion: BACKUP_POLICY.CATALOG_VERSION,
    id: manifest.backupId,
    scheduledFor: manifest.scheduledFor,
    status: 'SUCCEEDED',
    startedAt: previous?.startedAt ?? manifest.snapshotAt,
    completedAt: manifest.completedAt,
    attempt: previous?.attempt ?? 1,
    snapshotAt: manifest.snapshotAt,
    databaseBytes: manifest.database.sizeBytes,
    fileBytes: fileBytes.toString(),
    fileCount: manifest.files.length,
    releasedVersionCount: manifest.releasedVersions.length,
    durationMs: Math.max(
      0,
      Date.parse(manifest.completedAt) -
        Date.parse(previous?.startedAt ?? manifest.snapshotAt),
    ),
    failure: null,
    retentionIntent: null,
    retentionFailure: previous?.retentionFailure ?? null,
  };
}
