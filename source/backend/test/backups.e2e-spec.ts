import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seedAccessControl } from '../prisma/seed-data/seed-access-control.js';
import { BackupStore } from '../src/shared/backups/backup-store.js';
import type {
  BackupRunRecord,
  RestoreDrillRecord,
} from '../src/shared/backups/backup.types.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { startPostgres, startRedis } from './containers.js';
import type { TestPostgres, TestRedis } from './containers.js';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import { createTestApp } from './test-app.js';
import { setAppEnv } from './test-env.js';

const BASE = '/api/operations';

function run(day: string, patch: Partial<BackupRunRecord> = {}) {
  return {
    catalogVersion: 1,
    id: `daily-${day}`,
    scheduledFor: day,
    status: 'SUCCEEDED',
    startedAt: `${day}T02:00:05.000+07:00`,
    completedAt: `${day}T02:10:00.000+07:00`,
    attempt: 1,
    snapshotAt: `${day}T02:00:05.000+07:00`,
    databaseBytes: '9007199254740993',
    fileBytes: '2048',
    fileCount: 3,
    releasedVersionCount: 2,
    durationMs: 595_000,
    failure: null,
    retentionIntent: null,
    retentionFailure: null,
    ...patch,
  } as BackupRunRecord;
}

function drill(id: string, patch: Partial<RestoreDrillRecord> = {}) {
  return {
    catalogVersion: 1,
    id,
    backupId: 'daily-2026-10-30',
    tier: 'B4',
    operator: 'operator-1',
    status: 'SUCCEEDED',
    startedAt: '2026-10-30T10:00:00.000Z',
    completedAt: '2026-10-30T10:03:00.000Z',
    recoveryMs: 180_000,
    databaseRestoreMs: 90_000,
    filesRestoreMs: 30_000,
    verificationMs: 60_000,
    releasedVersionCount: 2,
    checks: [{ code: 'DUMP_HASH', passed: true, message: 'Khớp' }],
    acceptedAt: '2026-10-30T11:00:00.000Z',
    acceptanceNote: 'Đã đi thử B4',
    failure: null,
    targetDatabase: 'ctdt_drill_secret_name',
    targetServer: 'drill-host.internal',
    targetFilesDir: 'D:\\secret\\drill-files',
    acceptedBy: 'operator-1',
    verifications: [],
    ...patch,
  } as RestoreDrillRecord;
}

const DRILL_A = '11111111-1111-4111-8111-111111111111';
const DRILL_B = '22222222-2222-4222-8222-222222222222';

describe('backup operations API', () => {
  let postgres: TestPostgres;
  let redis: TestRedis;
  let app: NestExpressApplication;
  let root: string;
  let store: BackupStore;
  let r1: ReturnType<typeof request.agent>;
  let r2: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    [postgres, redis] = await Promise.all([
      startPostgres({ vietnameseCollation: true }),
      startRedis(),
    ]);
    setAppEnv(postgres, redis);
    // Backups stay disabled: this suite reads a hand-written catalog and must never spawn pg_dump.
    root = mkdtempSync(path.join(tmpdir(), 'ctdt-backups-api-'));
    process.env.BACKUP_ENABLED = 'false';
    process.env.BACKUP_ROOT = root;
    store = new BackupStore(root);
    await store.ensureLayout();
    await store.writeRun(run('2026-10-28'));
    await store.writeRun(
      run('2026-10-29', {
        status: 'FAILED',
        failure: { code: 'DUMP_FAILED', message: 'pg_dump thoát mã 1' },
      }),
    );
    await store.writeRun(run('2026-10-30'));
    await store.writeDrill(drill(DRILL_A));
    await store.writeDrill(
      drill(DRILL_B, { status: 'RESTORED', acceptedAt: null, tier: 'B5' }),
    );
    app = await createTestApp();
    await seedAccessControl(app.get(PrismaService));
    r1 = await loginAgent(app, await createAccount(app, 'bkr1', 'R1'));
    r2 = await loginAgent(
      app,
      await createAccount(app, 'bkr2', 'R2', { unitCode: 'KHOA_CNTT' }),
    );
  });

  afterAll(async () => {
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
    if (root && path.basename(root).startsWith('ctdt-backups-api-'))
      rmSync(root, { recursive: true, force: true });
  });

  it('refuses anonymous callers and roles without backup.view', async () => {
    await request(app.getHttpServer()).get(`${BASE}/backups/status`).expect(401);
    for (const path of ['/backups/status', '/backups', '/restore-drills'])
      await r2.get(`${BASE}${path}`).expect(403);
  });

  it('reports the disabled state without touching the catalog or any tool', async () => {
    const { body } = await r1.get(`${BASE}/backups/status`).expect(200);
    expect(body.state).toBe('DISABLED');
    expect(body.retentionCount).toBe(30);
    expect(body.timeZone).toBe('Asia/Ho_Chi_Minh');
    expect(body.lastAcceptedTier).toBe('B4');
    expect(body.lastRecoveryMs).toBe(180_000);
  });

  it('lists newest first, filters by status and pages before counting', async () => {
    const all = await r1.get(`${BASE}/backups`).expect(200);
    expect(all.body.total).toBe(3);
    expect(all.body.items.map((item: { id: string }) => item.id)).toEqual([
      'daily-2026-10-30',
      'daily-2026-10-29',
      'daily-2026-10-28',
    ]);

    const oldest = await r1.get(`${BASE}/backups?sort=oldest`).expect(200);
    expect(oldest.body.items[0].id).toBe('daily-2026-10-28');

    const failed = await r1.get(`${BASE}/backups?status=FAILED`).expect(200);
    expect(failed.body.total).toBe(1);
    expect(failed.body.items[0].failure).toEqual({
      code: 'DUMP_FAILED',
      message: 'pg_dump thoát mã 1',
    });

    const paged = await r1.get(`${BASE}/backups?page=2&pageSize=2`).expect(200);
    expect(paged.body.total).toBe(3);
    expect(paged.body.items).toHaveLength(1);

    const found = await r1.get(`${BASE}/backups?q=10-29`).expect(200);
    expect(found.body.total).toBe(1);
  });

  it('keeps byte counts as exact strings', async () => {
    const { body } = await r1.get(`${BASE}/backups?q=10-30`).expect(200);
    expect(body.items[0].databaseBytes).toBe('9007199254740993');
  });

  it('rejects an invalid enum, an oversized page and unknown filters', async () => {
    await r1.get(`${BASE}/backups?status=BOGUS`).expect(400);
    await r1.get(`${BASE}/backups?pageSize=100000`).expect(400);
    await r1.get(`${BASE}/restore-drills?tier=B9`).expect(400);
  });

  it('serialises drills with a whitelist: no target database, server, path or operator-only fields', async () => {
    const { body } = await r1.get(`${BASE}/restore-drills`).expect(200);
    expect(body.total).toBe(2);
    const text = JSON.stringify(body);
    for (const secret of [
      'ctdt_drill_secret_name',
      'drill-host.internal',
      'secret',
      'targetDatabase',
      'targetServer',
      'targetFilesDir',
      'verifications',
    ])
      expect(text).not.toContain(secret);
    const restored = body.items.find(
      (item: { id: string }) => item.id === DRILL_B,
    );
    expect(restored.status).toBe('RESTORED');
    expect(restored.acceptedAt).toBeNull();
  });

  it('filters drills by tier and by status', async () => {
    const byTier = await r1.get(`${BASE}/restore-drills?tier=B5`).expect(200);
    expect(byTier.body.items.map((item: { id: string }) => item.id)).toEqual([
      DRILL_B,
    ]);
    const byStatus = await r1
      .get(`${BASE}/restore-drills?status=SUCCEEDED`)
      .expect(200);
    expect(byStatus.body.total).toBe(1);
  });

  it('never writes anything: a GET leaves the catalog byte for byte unchanged', async () => {
    const before = JSON.stringify(await store.listRuns());
    await r1.get(`${BASE}/backups/status`).expect(200);
    await r1.get(`${BASE}/backups`).expect(200);
    expect(JSON.stringify(await store.listRuns())).toBe(before);
  });

  it('answers a sanitized 503 when the catalog is corrupt, not an empty history', async () => {
    const broken = path.join(store.dir('runs'), 'daily-2026-10-31.json');
    writeFileSync(broken, '{ not json');
    try {
      const res = await r1.get(`${BASE}/backups`).expect(503);
      expect(JSON.stringify(res.body)).not.toContain(root);
    } finally {
      rmSync(broken, { force: true });
    }
    await r1.get(`${BASE}/backups`).expect(200);
  });
});
