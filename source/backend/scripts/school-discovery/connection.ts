// Read-only access helpers for discovering the school's SQL Server (see docs/reference/dut-school-db-discovery.md).
// Secrets live in an env file outside the repository (default D:/dut-mirror/.env); nothing here is hard-coded.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'dotenv';
import sql from 'mssql';

export const MIRROR_ROOT = process.env.DUT_MIRROR_ROOT ?? 'D:/dut-mirror';

export interface SchoolAccount {
  user: string;
  password: string;
}

export interface DiscoveryEnv {
  tunnelPort: number;
  accounts: SchoolAccount[];
  mirrorPort: number;
  mirrorPassword: string | undefined;
}

export function loadEnv(): DiscoveryEnv {
  const file = process.env.DUT_MIRROR_ENV ?? join(MIRROR_ROOT, '.env');
  const env = parse(readFileSync(file, 'utf8'));
  const accounts: SchoolAccount[] = [];
  for (let n = 1; env[`SCHOOL_SQL_USER_${n}`]; n++) {
    accounts.push({
      user: env[`SCHOOL_SQL_USER_${n}`],
      password: env[`SCHOOL_SQL_PASS_${n}`] ?? '',
    });
  }
  return {
    tunnelPort: Number(env.SCHOOL_SQL_TUNNEL_PORT ?? 14330),
    accounts,
    mirrorPort: Number(env.MIRROR_SQL_PORT ?? 14333),
    mirrorPassword: env.MIRROR_SA_PASSWORD,
  };
}

const BASE_OPTIONS = {
  server: '127.0.0.1',
  options: { encrypt: false, trustServerCertificate: true },
  requestTimeout: 600_000,
  connectionTimeout: 30_000,
  pool: { max: 1, min: 0 },
};

/** Connects to the school server through the local SSH tunnel. Callers only issue SELECTs. */
export function schoolPool(
  env: DiscoveryEnv,
  account: SchoolAccount,
  database: string,
): Promise<sql.ConnectionPool> {
  return new sql.ConnectionPool({
    ...BASE_OPTIONS,
    port: env.tunnelPort,
    user: account.user,
    password: account.password,
    database,
  }).connect();
}

export function mirrorPool(
  env: DiscoveryEnv,
  database = 'master',
): Promise<sql.ConnectionPool> {
  if (!env.mirrorPassword) throw new Error('MIRROR_SA_PASSWORD is not set');
  return new sql.ConnectionPool({
    ...BASE_OPTIONS,
    port: env.mirrorPort,
    user: 'sa',
    password: env.mirrorPassword,
    database,
  }).connect();
}

/** Every read runs at READ UNCOMMITTED so the production server never waits on our locks. */
export async function readQuery<T>(
  pool: sql.ConnectionPool,
  text: string,
): Promise<T[]> {
  const result = await pool
    .request()
    .query<T>(
      `SET NOCOUNT ON; SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; ${text}`,
    );
  return result.recordset ?? [];
}

export function quoteName(name: string): string {
  return `[${name.replace(/]/g, ']]')}]`;
}
