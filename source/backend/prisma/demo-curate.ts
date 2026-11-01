import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

// Demo only: removes rows that test runs left in the shared demo database (`pnpm db:demo-curate [--dry-run]`).
// Roots: any `*Code` holding 16 hex digits, hex usernames, and placeholder change-request titles.
// Same walk as e2e-purge: required-FK children go too, optional FKs are set to NULL. Take a dump first.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const MAX_PASSES = 50;
// A request's working copy (sourceRequestId) belongs to it: it goes with the request instead of being detached.
const owned = (key: { column: string }) => key.column === 'sourceRequestId';

interface ForeignKey {
  child: string;
  column: string;
  parent: string;
  nullable: boolean;
}

const q = (sql: string, ...values: unknown[]) =>
  prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql, ...values);

async function foreignKeys(): Promise<ForeignKey[]> {
  const rows = await q(`
    SELECT c.conrelid::regclass::text AS child, a.attname AS column,
           c.confrelid::regclass::text AS parent, NOT a.attnotnull AS nullable
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_attribute p ON p.attrelid = c.confrelid AND p.attnum = c.confkey[1]
    WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
      AND array_length(c.conkey, 1) = 1 AND p.attname = 'id'`);
  return rows.map((row) => ({
    child: String(row.child),
    column: String(row.column),
    parent: String(row.parent),
    nullable: Boolean(row.nullable),
  }));
}

async function tablesWithId(): Promise<Set<string>> {
  const rows = await q(`
    SELECT a.attrelid::regclass::text AS table FROM pg_attribute a
    JOIN pg_class k ON k.oid = a.attrelid
    WHERE a.attname = 'id' AND k.relkind = 'r' AND k.relnamespace = 'public'::regnamespace`);
  return new Set(rows.map((row) => String(row.table)));
}

async function roots(withId: Set<string>): Promise<Map<string, Set<string>>> {
  const marked = new Map<string, Set<string>>();
  const add = async (table: string, sql: string, ...values: unknown[]) => {
    if (!withId.has(table)) return;
    const ids = (await q(sql, ...values)).map((row) => String(row.id));
    if (!ids.length) return;
    const set = marked.get(table) ?? new Set<string>();
    ids.forEach((id) => set.add(id));
    marked.set(table, set);
  };
  // Every test-generated code carries 16 hex digits (uniqueSuffix); real DUT codes never do.
  const codeColumns = await q(`
    SELECT a.attrelid::regclass::text AS table, a.attname AS column FROM pg_attribute a
    JOIN pg_class k ON k.oid = a.attrelid
    WHERE k.relkind = 'r' AND k.relnamespace = 'public'::regnamespace
      AND a.attname LIKE '%Code' AND a.atttypid = 'text'::regtype`);
  for (const { table, column } of codeColumns)
    await add(
      String(table),
      `SELECT id FROM ${String(table)} WHERE "${String(column)}" ~ '[0-9A-F]{16}'`,
    );
  await add(
    '"User"',
    `SELECT id FROM "User" WHERE username ~ '[0-9a-f]{16}' OR username LIKE 'e2e.%'`,
  );
  // Test Excel imports pin their program with ON DELETE RESTRICT.
  await add(
    '"ImportBatch"',
    `SELECT b.id FROM "ImportBatch" b JOIN "Program" p ON p.id = b."programId"
     WHERE p."programCode" ~ '[0-9A-F]{16}'`,
  );
  await add(
    '"ChangeRequest"',
    `SELECT id FROM "ChangeRequest"
     WHERE title ~ '^Đề xuất [0-9A-F]{16}$' OR title ~ '^[0-9A-F]{16}a+$' OR title = 'Testing'`,
  );
  // --title <regex>: also remove requests whose title matches, e.g. drafts a failed seed left behind.
  const titleFlag = process.argv.indexOf('--title');
  if (titleFlag > 0 && process.argv[titleFlag + 1])
    await add(
      '"ChangeRequest"',
      `SELECT id FROM "ChangeRequest" WHERE title ~ $1`,
      process.argv[titleFlag + 1],
    );
  return marked;
}

// Follows required foreign keys from marked rows until nothing new is reached.
async function closure(
  marked: Map<string, Set<string>>,
  keys: ForeignKey[],
  withId: Set<string>,
) {
  for (let changed = true; changed;) {
    changed = false;
    for (const key of keys) {
      const parents = marked.get(key.parent);
      if (
        (key.nullable && !owned(key)) ||
        !parents?.size ||
        !withId.has(key.child)
      )
        continue;
      const set = marked.get(key.child) ?? new Set<string>();
      for (const row of await q(
        `SELECT id FROM ${key.child} WHERE "${key.column}" = ANY($1)`,
        [...parents],
      )) {
        if (!set.has(String(row.id))) {
          set.add(String(row.id));
          changed = true;
        }
      }
      marked.set(key.child, set);
    }
  }
}

async function attempt(sql: string, ...values: unknown[]): Promise<number> {
  try {
    return await prisma.$executeRawUnsafe(sql, ...values);
  } catch {
    return 0;
  }
}

try {
  const [keys, withId] = await Promise.all([foreignKeys(), tablesWithId()]);
  const marked = await roots(withId);
  await closure(marked, keys, withId);
  if (process.argv.includes('--dry-run')) {
    for (const [table, ids] of [...marked].sort())
      if (ids.size) console.log(`  would delete ${ids.size} from ${table}`);
    process.exit(0);
  }
  // Call records are append-only at runtime; the purge is the one owner-level maintenance path (F-21).
  const clients = [...(marked.get('"IntegrationClient"') ?? [])];
  if (clients.length)
    await prisma.$transaction([
      prisma.$executeRawUnsafe(
        `SET LOCAL ctdt.integration_log_maintenance = 'on'`,
      ),
      prisma.$executeRawUnsafe(
        `DELETE FROM "IntegrationCallLog" WHERE "clientId" = ANY($1)`,
        clients,
      ),
    ]);
  for (const key of keys) {
    const parents = marked.get(key.parent);
    if (!parents?.size) continue;
    if (key.nullable && !owned(key))
      await attempt(
        `UPDATE ${key.child} SET "${key.column}" = NULL WHERE "${key.column}" = ANY($1)`,
        [...parents],
      );
    else if (!withId.has(key.child))
      await attempt(
        `DELETE FROM ${key.child} WHERE "${key.column}" = ANY($1)`,
        [...parents],
      );
  }
  let deleted = 0;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let progress = 0;
    for (const [table, ids] of marked) {
      if (!ids.size) continue;
      let removed = await attempt(`DELETE FROM ${table} WHERE id = ANY($1)`, [
        ...ids,
      ]);
      // One blocked row fails the whole statement; retry row by row so the rest still go.
      if (!removed)
        for (const id of ids)
          removed += await attempt(`DELETE FROM ${table} WHERE id = $1`, id);
      if (removed) {
        progress += removed;
        const left = await q(`SELECT id FROM ${table} WHERE id = ANY($1)`, [
          ...ids,
        ]);
        marked.set(table, new Set(left.map((row) => String(row.id))));
      }
    }
    deleted += progress;
    if (!progress) break;
  }
  // Cascades remove some marked rows behind our back, so count what is really still there.
  const leftover: [string, number][] = [];
  for (const [table, ids] of marked) {
    if (!ids.size) continue;
    const left = await q(`SELECT id FROM ${table} WHERE id = ANY($1)`, [
      ...ids,
    ]);
    if (left.length) leftover.push([table, left.length]);
  }
  console.log(`Demo curate: deleted ${deleted} rows`);
  for (const [table, count] of leftover)
    console.log(`  kept ${count} in ${table} (still referenced)`);
} finally {
  await prisma.$disconnect();
}
