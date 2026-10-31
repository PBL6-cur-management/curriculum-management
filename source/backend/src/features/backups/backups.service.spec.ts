import { describe, expect, it } from 'vitest';
import type {
  BackupRunRecord,
  RestoreDrillRecord,
} from '../../shared/backups/backup.types.js';
import { computeStatus } from './backups.service.js';

// 2026-10-31 09:00 Vietnam time: the 02:00 slot of 2026-10-31 is due, 7 hours ago.
const NOW = new Date('2026-10-31T09:00:00.000+07:00');
const SLOT = '2026-10-31';

function run(overrides: Partial<BackupRunRecord>): BackupRunRecord {
  return {
    catalogVersion: 1,
    id: `daily-${SLOT}`,
    scheduledFor: SLOT,
    status: 'SUCCEEDED',
    startedAt: '2026-10-31T02:00:05.000+07:00',
    completedAt: '2026-10-31T02:10:00.000+07:00',
    attempt: 1,
    snapshotAt: '2026-10-31T02:00:05.000+07:00',
    databaseBytes: '1024',
    fileBytes: '2048',
    fileCount: 3,
    releasedVersionCount: 2,
    durationMs: 595_000,
    failure: null,
    retentionIntent: null,
    retentionFailure: null,
    ...overrides,
  };
}

function drill(overrides: Partial<RestoreDrillRecord>): RestoreDrillRecord {
  return {
    status: 'SUCCEEDED',
    acceptedAt: '2026-10-31T08:00:00.000+07:00',
    recoveryMs: 120_000,
    tier: 'DELIVERY',
    ...overrides,
  } as RestoreDrillRecord;
}

describe('computeStatus', () => {
  it('is DISABLED whenever backups are switched off', () => {
    const status = computeStatus(false, [run({})], [], [`daily-${SLOT}`], NOW);
    expect(status.state).toBe('DISABLED');
  });

  it('is READY when the due slot has a published successful set', () => {
    const status = computeStatus(true, [run({})], [], [`daily-${SLOT}`], NOW);
    expect(status.state).toBe('READY');
    expect(status.dueSlot).toBe(SLOT);
    expect(status.retainedCount).toBe(1);
    expect(status.lastSuccessfulAt).toBe('2026-10-31T02:10:00.000+07:00');
    expect(status.lastFailure).toBeNull();
  });

  it('is OVERDUE with no sets once the grace period after the slot has passed', () => {
    const status = computeStatus(true, [], [], [], NOW);
    expect(status.state).toBe('OVERDUE');
    expect(status.retainedCount).toBe(0);
    expect(status.lastSuccessfulAt).toBeNull();
  });

  it('is READY inside the grace period after the slot instant', () => {
    const justAfter = new Date('2026-10-31T03:00:00.000+07:00');
    expect(computeStatus(true, [], [], [], justAfter).state).toBe('READY');
  });

  it('ignores a SUCCEEDED run whose set was never published', () => {
    const status = computeStatus(true, [run({})], [], [], NOW);
    expect(status.state).toBe('OVERDUE');
    expect(status.retainedCount).toBe(0);
  });

  it('reports a failure newer than the last success as FAILED', () => {
    const failed = run({
      id: 'daily-2026-10-31-retry',
      status: 'FAILED',
      startedAt: '2026-10-31T05:00:00.000+07:00',
      completedAt: '2026-10-31T05:01:00.000+07:00',
      failure: { code: 'DUMP_FAILED', message: 'pg_dump exited with 1' },
    });
    const status = computeStatus(
      true,
      [run({}), failed],
      [],
      [`daily-${SLOT}`],
      NOW,
    );
    expect(status.state).toBe('FAILED');
    expect(status.lastFailure).toEqual({
      code: 'DUMP_FAILED',
      message: 'pg_dump exited with 1',
    });
  });

  it('does not report a failure older than the last success', () => {
    const failed = run({
      id: 'daily-2026-10-30',
      scheduledFor: '2026-10-30',
      status: 'FAILED',
      startedAt: '2026-10-30T02:00:00.000+07:00',
      completedAt: '2026-10-30T02:01:00.000+07:00',
      failure: { code: 'DUMP_FAILED', message: 'old failure' },
    });
    const status = computeStatus(
      true,
      [failed, run({})],
      [],
      [`daily-${SLOT}`],
      NOW,
    );
    expect(status.state).toBe('READY');
    expect(status.lastFailure).toBeNull();
  });

  it('shows a fresh RUNNING record as RUNNING with its id', () => {
    const running = run({
      id: 'daily-2026-10-31',
      status: 'RUNNING',
      startedAt: '2026-10-31T08:50:00.000+07:00',
      completedAt: null,
    });
    const status = computeStatus(true, [running], [], [], NOW);
    expect(status.state).toBe('RUNNING');
    expect(status.currentRunId).toBe('daily-2026-10-31');
  });

  it('shows a RUNNING record past the operation timeout as a failure, not as running', () => {
    const stale = run({
      status: 'RUNNING',
      startedAt: '2026-10-31T02:00:00.000+07:00',
      completedAt: null,
    });
    const status = computeStatus(true, [stale], [], [], NOW);
    expect(status.state).toBe('FAILED');
    expect(status.currentRunId).toBeNull();
    expect(status.lastFailure).not.toBeNull();
  });

  it('keeps a good set READY when only its own old-set pruning failed', () => {
    const status = computeStatus(
      true,
      [run({ retentionFailure: { code: 'PRUNE_FAILED', message: 'locked' } })],
      [],
      [`daily-${SLOT}`],
      NOW,
    );
    // The failure carries the set's own completion time, so it is not newer than the success.
    expect(status.state).toBe('READY');
    expect(status.retainedCount).toBe(1);
    expect(status.lastFailure).toBeNull();
  });

  it('takes the recovery time and tier from the latest accepted drill only', () => {
    const drills = [
      drill({
        acceptedAt: '2026-10-01T08:00:00.000+07:00',
        recoveryMs: 900_000,
      }),
      drill({
        acceptedAt: '2026-10-30T08:00:00.000+07:00',
        recoveryMs: 120_000,
      }),
      drill({ status: 'RESTORED', acceptedAt: null, recoveryMs: 1 }),
    ];
    const status = computeStatus(
      true,
      [run({})],
      drills,
      [`daily-${SLOT}`],
      NOW,
    );
    expect(status.lastRecoveryMs).toBe(120_000);
    expect(status.lastAcceptedTier).toBe('DELIVERY');
  });

  it('keeps recovery fields null when no drill was ever accepted', () => {
    const status = computeStatus(
      true,
      [run({})],
      [drill({ status: 'RESTORED', acceptedAt: null })],
      [`daily-${SLOT}`],
      NOW,
    );
    expect(status.lastRecoveryMs).toBeNull();
    expect(status.lastAcceptedTier).toBeNull();
  });
});
