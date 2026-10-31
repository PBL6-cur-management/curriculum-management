import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { inject } from 'vitest';

// Every database the e2e run creates starts with this prefix; global-setup drops them all before and after.
export const E2E_DATABASE_PREFIX = 'ctdt_e2e_';
// Migrated once per run by global-setup.ts; per-file databases are copies of it.
export const ICU_TEMPLATE_DATABASE = `${E2E_DATABASE_PREFIX}template`;
// BullMQ prefix root for every spec file (test-env.ts adds a per-file suffix).
export const E2E_QUEUE_PREFIX = 'ctdt-e2e-';
// The dev app stays on Redis database 0; the e2e run uses its own, so neither sees the other's queues.
export const E2E_REDIS_DB = 1;

export interface TestPostgres {
  getConnectionUri(): string;
  stop(): Promise<unknown>;
}

export interface TestRedis {
  getHost(): string;
  getPort(): number;
  stop(): Promise<unknown>;
}

async function withAdmin<T>(run: (client: pg.Client) => Promise<T>) {
  const client = new pg.Client({
    connectionString: inject('postgresAdminUri'),
  });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

// A fresh database on the dev PostgreSQL (compose.yaml). With Vietnamese collation it is a copy of the
// migrated template and needs no migrations of its own; without it, an empty database with the libc default.
export async function startPostgres({
  vietnameseCollation,
}: {
  vietnameseCollation: boolean;
}): Promise<TestPostgres> {
  const name = `${E2E_DATABASE_PREFIX}${randomUUID().replaceAll('-', '')}`;
  const source = vietnameseCollation
    ? `TEMPLATE "${ICU_TEMPLATE_DATABASE}"`
    : `TEMPLATE template0 LOCALE_PROVIDER libc LOCALE 'C.UTF-8'`;
  // Postgres refuses to copy a template while another session is connected to it.
  await withAdmin((client) =>
    client.query(`CREATE DATABASE "${name}" ${source}`),
  );
  const uri = new URL(inject('postgresAdminUri'));
  uri.pathname = `/${name}`;
  return {
    getConnectionUri: () => uri.toString(),
    stop: () =>
      withAdmin((client) =>
        client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`),
      ),
  };
}

// The shared dev Redis. stop() is a no-op: queues are isolated by prefix and cleared by global-setup.
export function startRedis(): Promise<TestRedis> {
  return Promise.resolve({
    getHost: () => inject('redisHost'),
    getPort: () => inject('redisPort'),
    stop: () => Promise.resolve(),
  });
}
