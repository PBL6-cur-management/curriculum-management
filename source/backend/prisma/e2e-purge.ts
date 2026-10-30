import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { SEED_DEMO_COURSES, SEED_PROGRAM_CODES } from './seed-data/programs.js';
import { DEMO_COURSES } from './e2e-world/catalog.js';
import { DEMO_PROGRAM_CODES } from './e2e-world/programs.js';

// Removes the Playwright world and everything the suite created from the real database.
// Roots: `e2e.*` accounts, any `*Code` column containing "E2E" (uniqueSuffix() always adds it), and the
// world's course and program codes. Rows that point at a root through a required foreign key go too;
// optional foreign keys are set to NULL so real rows survive. Rows that still cannot go are left, and
// e2e accounts among them are disabled.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const MAX_PASSES = 50;

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
  await add('"User"', `SELECT id FROM "User" WHERE username LIKE 'e2e.%'`);
  await add(
    '"Course"',
    `SELECT id FROM "Course" WHERE "courseCode" = ANY($1)`,
    [...DEMO_COURSES, ...SEED_DEMO_COURSES].map((course) => course.courseCode),
  );
  await add(
    '"Program"',
    `SELECT id FROM "Program" WHERE "programCode" = ANY($1)`,
    [
      SEED_PROGRAM_CODES.COMPUTER_ENGINEERING,
      ...Object.values(DEMO_PROGRAM_CODES),
    ],
  );
  const codeColumns = await q(`
    SELECT a.attrelid::regclass::text AS table, a.attname AS column FROM pg_attribute a
    JOIN pg_class k ON k.oid = a.attrelid
    WHERE k.relkind = 'r' AND k.relnamespace = 'public'::regnamespace
      AND a.attname LIKE '%Code' AND a.atttypid = 'text'::regtype`);
  for (const { table, column } of codeColumns)
    await add(
      String(table),
      `SELECT id FROM ${String(table)} WHERE "${String(column)}" LIKE '%E2E%'`,
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
      if (key.nullable || !parents?.size || !withId.has(key.child)) continue;
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
  for (const key of keys) {
    const parents = marked.get(key.parent);
    if (!parents?.size) continue;
    if (key.nullable)
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
      const removed = await attempt(`DELETE FROM ${table} WHERE id = ANY($1)`, [
        ...ids,
      ]);
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
  const disabled = await attempt(
    `UPDATE "User" SET status = 'DISABLED' WHERE username LIKE 'e2e.%'`,
  );
  console.log(
    `E2E purge: deleted ${deleted} rows; ${disabled} e2e accounts left and disabled`,
  );
  for (const [table, count] of leftover)
    console.log(`  kept ${count} in ${table} (still referenced)`);
} finally {
  await prisma.$disconnect();
}
