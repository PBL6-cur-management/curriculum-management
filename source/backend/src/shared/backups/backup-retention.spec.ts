import { describe, expect, it } from 'vitest';
import { BACKUP_POLICY } from './backup.constants.js';
import type { BackupRunRecord } from './backup.types.js';
import { applyRetention } from './backup-retention.js';
import type { BackupStore } from './backup-store.js';

const run = (
  id: string,
  completedAt: string | null,
  status: BackupRunRecord['status'] = 'SUCCEEDED',
): BackupRunRecord => ({
  catalogVersion: 1,
  id,
  scheduledFor: id.slice(6),
  status,
  startedAt: '2026-01-01T00:00:00.000Z',
  completedAt,
  attempt: 1,
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

// In-memory stand-in that records every call, so the order "intent, move, mark expired, remove" is checked.
function fakeStore(runs: BackupRunRecord[], published: string[]) {
  const calls: string[] = [];
  const store = {
    listSetIds: async () => published,
    listRuns: async () => runs,
    readManifest: async (id: string) => {
      calls.push(`read:${id}`);
    },
    writeRun: async (r: BackupRunRecord) => {
      calls.push(
        `write:${r.id}:${r.status}${r.retentionIntent ? ':intent' : ''}`,
      );
    },
    moveToTrash: async (id: string) => {
      calls.push(`trash:${id}`);
      return `trash/${id}`;
    },
    removeOwned: async (dir: string) => {
      calls.push(`remove:${dir}`);
    },
  };
  return { store: store as unknown as BackupStore, calls };
}

const days = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    return run(`daily-2026-01-${day}`, `2026-01-${day}T02:05:00.000Z`);
  });

describe('applyRetention', () => {
  it('keeps the newest 30 complete sets and expires only older ones', async () => {
    expect(BACKUP_POLICY.RETENTION_COUNT).toBe(30);
    const runs = days(31);
    const { store } = fakeStore(
      runs,
      runs.map((r) => r.id),
    );
    expect(await applyRetention(store)).toEqual(['daily-2026-01-01']);
  });

  it('does nothing at or below the limit', async () => {
    const runs = days(30);
    const { store, calls } = fakeStore(
      runs,
      runs.map((r) => r.id),
    );
    expect(await applyRetention(store)).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('never counts failed, interrupted or unpublished runs against a good set', async () => {
    const good = days(3);
    const noise = [
      run('daily-2026-02-01', '2026-02-01T02:05:00.000Z', 'FAILED'),
      run('daily-2026-02-02', '2026-02-02T02:05:00.000Z', 'INTERRUPTED'),
      run('daily-2026-02-03', '2026-02-03T02:05:00.000Z'), // succeeded but not published
    ];
    const { store } = fakeStore(
      [...good, ...noise],
      good.map((r) => r.id),
    );
    expect(await applyRetention(store, 2)).toEqual(['daily-2026-01-01']);
  });

  it('records the intent before moving and removes only after marking EXPIRED', async () => {
    const runs = days(2);
    const { store, calls } = fakeStore(
      runs,
      runs.map((r) => r.id),
    );
    await applyRetention(store, 1);
    expect(calls).toEqual([
      'read:daily-2026-01-01',
      'write:daily-2026-01-01:SUCCEEDED:intent',
      'trash:daily-2026-01-01',
      'write:daily-2026-01-01:EXPIRED',
      'remove:trash/daily-2026-01-01',
    ]);
  });

  it('breaks a completion-time tie by id so the order is deterministic', async () => {
    const same = '2026-01-01T02:05:00.000Z';
    const runs = [
      run('daily-2026-01-01', same),
      run('daily-2026-01-02', same),
      run('daily-2026-01-03', same),
    ];
    const { store } = fakeStore(
      runs,
      runs.map((r) => r.id),
    );
    // Newest by id wins the tie, so the two lowest ids are expired.
    expect(await applyRetention(store, 1)).toEqual([
      'daily-2026-01-02',
      'daily-2026-01-01',
    ]);
  });
});
