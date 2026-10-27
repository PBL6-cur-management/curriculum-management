import { randomUUID } from 'node:crypto';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import pg from 'pg';
import { inject } from 'vitest';

// Same images and init args as compose.yaml, so tests run against what production runs.
const POSTGRES_IMAGE = 'postgres:18';
const REDIS_IMAGE = 'redis:8';
const VIETNAMESE_ICU_INIT_ARGS =
  '--locale-provider=icu --icu-locale=vi-VN --locale=C.UTF-8';
// Every spec file runs its own app pool against this one server; the default 100 runs out.
const TEST_MAX_CONNECTIONS = '300';

// Created and migrated once per run by global-setup.ts; per-file databases are copies of it.
export const ICU_TEMPLATE_DATABASE = 'ctdt_template';

export interface TestPostgres {
  getConnectionUri(): string;
  stop(): Promise<unknown>;
}

export interface TestRedis {
  getHost(): string;
  getPort(): number;
  stop(): Promise<unknown>;
}

// Own containers, for global-setup.ts and for specs that must stop them (health).
export function startPostgresContainer({
  vietnameseCollation,
}: {
  vietnameseCollation: boolean;
}) {
  const container = new PostgreSqlContainer(POSTGRES_IMAGE).withCommand([
    'postgres',
    '-c',
    `max_connections=${TEST_MAX_CONNECTIONS}`,
  ]);
  if (vietnameseCollation) {
    container.withEnvironment({
      POSTGRES_INITDB_ARGS: VIETNAMESE_ICU_INIT_ARGS,
    });
  }
  return container.start();
}

export function startRedisContainer() {
  return new RedisContainer(REDIS_IMAGE).start();
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

// A fresh database on the shared container. With Vietnamese collation it is a copy of the
// migrated template and needs no migrations of its own; without it, an empty
// database with the libc default collation.
export async function startPostgres({
  vietnameseCollation,
}: {
  vietnameseCollation: boolean;
}): Promise<TestPostgres> {
  const name = `test_${randomUUID().replaceAll('-', '')}`;
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

// The shared Redis. stop() is a no-op: the run owns it, not the spec file.
export function startRedis(): Promise<TestRedis> {
  return Promise.resolve({
    getHost: () => inject('redisHost'),
    getPort: () => inject('redisPort'),
    stop: () => Promise.resolve(),
  });
}
