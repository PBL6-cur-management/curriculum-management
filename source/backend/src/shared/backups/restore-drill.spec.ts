import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { backupConfigFrom, type BackupConfig } from './backup-config.js';
import { BackupStore } from './backup-store.js';
import type { RestoreDrillRecord } from './backup.types.js';
import type { PostgresTools } from './postgres-tools.js';
import { RestoreDrill } from './restore-drill.js';

const DRILL_ID = '33333333-3333-4333-8333-333333333333';
// Every guard below throws before a tool or database is touched.
const tools = {} as PostgresTools;
const signal = () => new AbortController().signal;

function drill(patch: Partial<RestoreDrillRecord> = {}): RestoreDrillRecord {
  return {
    catalogVersion: 1,
    id: DRILL_ID,
    backupId: 'daily-2026-10-30',
    tier: 'B4',
    operator: 'operator-1',
    status: 'RESTORED',
    startedAt: '2026-10-30T10:00:00.000Z',
    completedAt: '2026-10-30T10:03:00.000Z',
    recoveryMs: 180_000,
    databaseRestoreMs: 90_000,
    filesRestoreMs: 30_000,
    verificationMs: 60_000,
    releasedVersionCount: 2,
    checks: [{ code: 'DUMP_HASH', passed: true, message: 'Khớp' }],
    acceptedAt: null,
    acceptanceNote: null,
    failure: null,
    targetDatabase: 'ctdt_restore_drill_a',
    targetServer: 'local:5432',
    targetFilesDir: 'D:\\drill\\files',
    acceptedBy: null,
    verifications: [],
    ...patch,
  };
}

let work: string;
let store: BackupStore;
let config: BackupConfig;

beforeEach(async () => {
  work = await mkdtemp(path.join(tmpdir(), 'f26-drill-'));
  store = new BackupStore(path.join(work, 'backups'));
  await store.ensureLayout();
  config = backupConfigFrom({
    BACKUP_ENABLED: 'true',
    BACKUP_ROOT: store.root,
    FILES_ROOT: path.join(work, 'files'),
    DATABASE_URL: 'postgresql://app@localhost:5432/ctdt_real',
    PG_DUMP_PATH: 'pg_dump',
    PG_RESTORE_PATH: 'pg_restore',
  });
});
afterEach(async () => {
  await rm(work, { recursive: true, force: true });
});

const code = (definition: string) => ({ definition: { code: definition } });

describe('RestoreDrill.accept', () => {
  it('turns a restored drill into SUCCEEDED without touching the recovery clock', async () => {
    await store.writeDrill(drill());
    const accepted = await new RestoreDrill(config, tools).accept({
      drillId: DRILL_ID,
      operator: ' hieu ',
      passed: true,
      note: 'Đã đi thử B4',
    });
    expect(accepted).toMatchObject({
      status: 'SUCCEEDED',
      acceptedBy: 'hieu',
      acceptanceNote: 'Đã đi thử B4',
      recoveryMs: 180_000,
      failure: null,
    });
    expect((await store.readDrill(DRILL_ID)).status).toBe('SUCCEEDED');
  });

  it('records a failed walkthrough as FAILED with the acceptance failure', async () => {
    await store.writeDrill(drill());
    const failed = await new RestoreDrill(config, tools).accept({
      drillId: DRILL_ID,
      operator: 'hieu',
      passed: false,
      note: 'Không đăng nhập được',
    });
    expect(failed.status).toBe('FAILED');
    expect(failed.failure?.code).toBe('DRILL_ACCEPTANCE_FAILED');
  });

  it('repeats the same decision idempotently but refuses a different one', async () => {
    await store.writeDrill(drill());
    const runner = new RestoreDrill(config, tools);
    const input = {
      drillId: DRILL_ID,
      operator: 'hieu',
      passed: true,
      note: 'Đã đi thử B4',
    };
    const first = await runner.accept(input);
    expect(await runner.accept(input)).toEqual(first);
    await expect(
      runner.accept({ ...input, note: 'Ghi chú khác' }),
    ).rejects.toMatchObject(code('DRILL_ALREADY_DECIDED'));
    await expect(
      runner.accept({ ...input, passed: false }),
    ).rejects.toMatchObject(code('DRILL_ALREADY_DECIDED'));
  });

  it('refuses a drill that is not RESTORED or has a failed check', async () => {
    const runner = new RestoreDrill(config, tools);
    const input = {
      drillId: DRILL_ID,
      operator: 'hieu',
      passed: true,
      note: 'x',
    };
    await store.writeDrill(drill({ status: 'FAILED' }));
    await expect(runner.accept(input)).rejects.toMatchObject(
      code('DRILL_NOT_ACCEPTABLE'),
    );
    await store.writeDrill(
      drill({
        checks: [{ code: 'FILE_HASHES', passed: false, message: 'Lệch' }],
      }),
    );
    await expect(runner.accept(input)).rejects.toMatchObject(
      code('DRILL_NOT_ACCEPTABLE'),
    );
  });

  it('rejects a blank operator or note', async () => {
    await store.writeDrill(drill());
    const runner = new RestoreDrill(config, tools);
    await expect(
      runner.accept({
        drillId: DRILL_ID,
        operator: '  ',
        passed: true,
        note: 'x',
      }),
    ).rejects.toMatchObject(code('DRILL_TARGET_UNSAFE'));
    await expect(
      runner.accept({
        drillId: DRILL_ID,
        operator: 'hieu',
        passed: true,
        note: '',
      }),
    ).rejects.toMatchObject(code('DRILL_TARGET_UNSAFE'));
  });
});

describe('RestoreDrill.restore guards', () => {
  const base = {
    backupId: 'daily-2026-10-30',
    tier: 'B4' as const,
    operator: 'hieu',
    targetDatabaseUrl: 'postgresql://app@localhost:5432/ctdt_restore_drill_a',
  };

  it('refuses a target database that is not named as a drill target', async () => {
    await expect(
      new RestoreDrill(config, tools).restore(
        {
          ...base,
          targetDatabaseUrl: 'postgresql://app@localhost:5432/ctdt_copy',
          targetFilesRoot: work,
        },
        signal(),
      ),
    ).rejects.toMatchObject(code('DRILL_TARGET_UNSAFE'));
  });

  it('refuses the production database even under a drill-like URL host', async () => {
    const same = backupConfigFrom({
      BACKUP_ENABLED: 'true',
      BACKUP_ROOT: store.root,
      FILES_ROOT: path.join(work, 'files'),
      DATABASE_URL: 'postgresql://app@localhost:5432/ctdt_restore_drill_a',
      PG_DUMP_PATH: 'pg_dump',
      PG_RESTORE_PATH: 'pg_restore',
    });
    await expect(
      new RestoreDrill(same, tools).restore(
        { ...base, targetFilesRoot: work },
        signal(),
      ),
    ).rejects.toMatchObject(code('DRILL_TARGET_UNSAFE'));
  });

  it('refuses an unknown tier, a relative files folder and one overlapping the backup root', async () => {
    const runner = new RestoreDrill(config, tools);
    await expect(
      runner.restore(
        { ...base, tier: 'B9' as never, targetFilesRoot: work },
        signal(),
      ),
    ).rejects.toMatchObject(code('DRILL_TARGET_UNSAFE'));
    await expect(
      runner.restore({ ...base, targetFilesRoot: 'drill-files' }, signal()),
    ).rejects.toMatchObject(code('DRILL_TARGET_UNSAFE'));
    await expect(
      runner.restore({ ...base, targetFilesRoot: store.root }, signal()),
    ).rejects.toMatchObject(code('DRILL_TARGET_UNSAFE'));
  });
});
