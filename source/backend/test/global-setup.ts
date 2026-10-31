import { Redis } from 'ioredis';
import pg from 'pg';
import type { TestProject } from 'vitest/node';
import {
  E2E_DATABASE_PREFIX,
  E2E_REDIS_DB,
  ICU_TEMPLATE_DATABASE,
} from './containers.js';
import { applyMigrations } from './migrations.js';

// The e2e run reuses the dev services from compose.yaml (`pnpm services:up`) instead of starting containers of
// its own. It only ever creates, and drops, databases named ctdt_e2e_* and empties its own Redis database (E2E_REDIS_DB);
// the dev database (ctdt_real) is never touched.
const ADMIN_URI =
  process.env.E2E_POSTGRES_ADMIN_URL ??
  'postgresql://ctdt:ctdt@localhost:5432/postgres';
const REDIS_HOST = process.env.E2E_REDIS_HOST ?? 'localhost';
const REDIS_PORT = Number(process.env.E2E_REDIS_PORT ?? 6379);

async function withAdmin<T>(run: (client: pg.Client) => Promise<T>) {
  const client = new pg.Client({ connectionString: ADMIN_URI });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `e2e: cannot reach PostgreSQL at ${new URL(ADMIN_URI).host}. Start the dev services first: pnpm services:up (${String(error)})`,
    );
  }
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

// Leftovers of an interrupted run: every e2e database, then the template.
async function dropE2eDatabases() {
  await withAdmin(async (client) => {
    const { rows } = await client.query<{ datname: string }>(
      `SELECT datname FROM pg_database WHERE datname LIKE $1`,
      [`${E2E_DATABASE_PREFIX}%`],
    );
    for (const { datname } of rows) {
      await client.query(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`);
    }
  });
}

async function clearE2eQueues() {
  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    db: E2E_REDIS_DB,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  try {
    await redis.connect();
  } catch (error) {
    throw new Error(
      `e2e: cannot reach Redis at ${REDIS_HOST}:${REDIS_PORT}. Start the dev services first: pnpm services:up (${String(error)})`,
    );
  }
  try {
    // Database E2E_REDIS_DB belongs to the e2e run alone (the app stays on 0), so it is emptied whole.
    await redis.flushdb();
  } finally {
    redis.disconnect();
  }
}

export default async function setup(project: TestProject) {
  await Promise.all([dropE2eDatabases(), clearE2eQueues()]);
  await withAdmin((client) =>
    client.query(
      `CREATE DATABASE "${ICU_TEMPLATE_DATABASE}" TEMPLATE template0 LOCALE_PROVIDER icu ICU_LOCALE 'vi-VN' LOCALE 'C.UTF-8'`,
    ),
  );
  const templateUri = new URL(ADMIN_URI);
  templateUri.pathname = `/${ICU_TEMPLATE_DATABASE}`;
  applyMigrations(templateUri.toString());

  project.provide('postgresAdminUri', ADMIN_URI);
  project.provide('redisHost', REDIS_HOST);
  project.provide('redisPort', REDIS_PORT);

  return async () => {
    await Promise.all([dropE2eDatabases(), clearE2eQueues()]);
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    postgresAdminUri: string;
    redisHost: string;
    redisPort: number;
  }
}
