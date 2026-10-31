import pg from 'pg';
import { BACKUP_POLICY } from './backup.constants.js';
import { BACKUP_ERRORS, BackupFailure } from './backup.errors.js';

export interface SnapshotSession {
  client: pg.Client;
  snapshotId: string;
  snapshotAt: string;
  sourceDatabaseName: string;
  serverVersionNum: number;
}

export interface MigrationEvidence {
  name: string;
  checksum: string;
}

export function connect(url: string): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: url });
  return client.connect().then(() => client);
}

// D5: one dedicated session holds advisory lock 5002 for the whole operation (dump, publish, prune or drill),
// so two processes never write the same root at once. It is never a pooled connection.
export async function withBackupOperation<T>(
  databaseUrl: string,
  signal: AbortSignal,
  run: (client: pg.Client) => Promise<T>,
): Promise<T> {
  const client = await connect(databaseUrl).catch(() => {
    throw new BackupFailure(BACKUP_ERRORS.DUMP_FAILED, true);
  });
  let lost = false;
  client.on('error', () => {
    lost = true;
  });
  try {
    const { rows } = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS acquired',
      [BACKUP_POLICY.OPERATION_LOCK_KEY],
    );
    if (!rows[0].acquired) throw new BackupFailure(BACKUP_ERRORS.BUSY, true);
    try {
      const result = await run(client);
      if (lost || signal.aborted) {
        throw new BackupFailure(BACKUP_ERRORS.TIMEOUT, true);
      }
      return result;
    } finally {
      if (!lost) {
        await client
          .query('SELECT pg_advisory_unlock($1)', [
            BACKUP_POLICY.OPERATION_LOCK_KEY,
          ])
          .catch(() => undefined);
      }
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

// A read-only repeatable-read transaction whose snapshot pg_dump imports: references, released content and
// migrations are read at exactly the state the dump holds. The transaction stays open until `run` returns.
export async function withExportedSnapshot<T>(
  databaseUrl: string,
  run: (snapshot: SnapshotSession) => Promise<T>,
): Promise<T> {
  const client = await connect(databaseUrl);
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows } = await client.query<{
      snapshot_id: string;
      snapshot_at: Date;
      database: string;
      version: string;
    }>(
      `SELECT pg_export_snapshot() AS snapshot_id, clock_timestamp() AS snapshot_at,
              current_database() AS database, current_setting('server_version_num') AS version`,
    );
    const session: SnapshotSession = {
      client,
      snapshotId: rows[0].snapshot_id,
      snapshotAt: rows[0].snapshot_at.toISOString(),
      sourceDatabaseName: rows[0].database,
      serverVersionNum: Number(rows[0].version),
    };
    try {
      return await run(session);
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

// Completed migrations only; one still running or rolled back makes a new set unsafe to call good.
export async function readMigrations(
  client: pg.Client,
): Promise<{ completed: MigrationEvidence[]; unfinished: number }> {
  const { rows } = await client.query<{
    migration_name: string;
    checksum: string;
    finished_at: Date | null;
    rolled_back_at: Date | null;
  }>(
    `SELECT migration_name, checksum, finished_at, rolled_back_at
       FROM "_prisma_migrations" ORDER BY migration_name, id`,
  );
  return {
    completed: rows
      .filter((row) => row.finished_at && !row.rolled_back_at)
      .map((row) => ({ name: row.migration_name, checksum: row.checksum })),
    unfinished: rows.filter((row) => !row.finished_at && !row.rolled_back_at)
      .length,
  };
}

export function majorOf(serverVersionNum: number): number {
  return Math.floor(serverVersionNum / 10_000);
}
