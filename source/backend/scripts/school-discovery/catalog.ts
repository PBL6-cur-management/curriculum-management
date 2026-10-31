// Step 1 of the school DB discovery: dump the system catalog of every database each account can open.
// Reads sys.* only (no table scans). Output: <MIRROR_ROOT>/catalog/<account>/<db>.json and catalog/index.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type sql from 'mssql';
import {
  MIRROR_ROOT,
  loadEnv,
  readQuery,
  schoolPool,
  type SchoolAccount,
} from './connection.js';

const SYSTEM_DATABASES = new Set(['master', 'model', 'msdb', 'tempdb']);

interface DatabaseRow {
  name: string;
  hasAccess: number;
  collation: string;
  createDate: Date;
  state: string;
}

async function optional<T>(
  label: string,
  run: () => Promise<T[]>,
  errors: string[],
): Promise<T[]> {
  try {
    return await run();
  } catch (error) {
    errors.push(`${label}: ${(error as Error).message}`);
    return [];
  }
}

function withoutObjectId(rows: { objectId: number }[] | undefined) {
  return (rows ?? []).map((row) => {
    const copy: Record<string, unknown> = { ...row };
    delete copy.objectId;
    return copy;
  });
}

async function describeDatabase(pool: sql.ConnectionPool) {
  const errors: string[] = [];
  const objects = await readQuery(
    pool,
    `SELECT o.object_id AS objectId, s.name AS [schema], o.name, RTRIM(o.type) AS type, o.type_desc AS typeDesc,
            o.create_date AS createDate, o.modify_date AS modifyDate
       FROM sys.objects o JOIN sys.schemas s ON s.schema_id = o.schema_id
      WHERE o.is_ms_shipped = 0 AND o.type IN ('U','V','P','FN','IF','TF','TR','SN')
      ORDER BY o.type, s.name, o.name`,
  );
  const sizes = await optional(
    'sizes',
    () =>
      readQuery(
        pool,
        // Rows and pages are aggregated separately: a partition has one allocation unit per
        // IN_ROW / LOB / ROW_OVERFLOW, so summing rows across the join would double-count LOB tables.
        `SELECT r.objectId, r.[rows], s.totalKb
           FROM (SELECT object_id AS objectId, SUM(rows) AS [rows] FROM sys.partitions
                  WHERE index_id IN (0,1) GROUP BY object_id) r
           LEFT JOIN (SELECT p.object_id AS objectId, SUM(a.total_pages) * 8 AS totalKb
                        FROM sys.partitions p JOIN sys.allocation_units a ON a.container_id = p.partition_id
                       GROUP BY p.object_id) s ON s.objectId = r.objectId`,
      ),
    errors,
  );
  const columns = await readQuery(
    pool,
    `SELECT c.object_id AS objectId, c.column_id AS columnId, c.name, t.name AS type,
            c.max_length AS maxLength, c.precision, c.scale, c.is_nullable AS nullable,
            c.is_identity AS isIdentity, c.is_computed AS isComputed, c.collation_name AS collation,
            OBJECT_DEFINITION(c.default_object_id) AS defaultValue
       FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
       JOIN sys.objects o ON o.object_id = c.object_id
      WHERE o.is_ms_shipped = 0 AND o.type IN ('U','V')
      ORDER BY c.object_id, c.column_id`,
  );
  const indexes = await readQuery(
    pool,
    `SELECT i.object_id AS objectId, i.name, i.type_desc AS typeDesc, i.is_primary_key AS isPrimaryKey,
            i.is_unique AS isUnique, i.is_unique_constraint AS isUniqueConstraint,
            STUFF((SELECT ',' + c.name FROM sys.index_columns ic
                     JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                    WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
                    ORDER BY ic.key_ordinal FOR XML PATH('')), 1, 1, '') AS columns
       FROM sys.indexes i JOIN sys.objects o ON o.object_id = i.object_id
      WHERE o.is_ms_shipped = 0 AND o.type = 'U' AND i.type > 0`,
  );
  const foreignKeys = await readQuery(
    pool,
    `SELECT fk.name, fk.parent_object_id AS objectId, OBJECT_NAME(fk.referenced_object_id) AS referencedTable,
            STUFF((SELECT ',' + COL_NAME(k.parent_object_id, k.parent_column_id) FROM sys.foreign_key_columns k
                    WHERE k.constraint_object_id = fk.object_id ORDER BY k.constraint_column_id FOR XML PATH('')), 1, 1, '') AS columns,
            STUFF((SELECT ',' + COL_NAME(k.referenced_object_id, k.referenced_column_id) FROM sys.foreign_key_columns k
                    WHERE k.constraint_object_id = fk.object_id ORDER BY k.constraint_column_id FOR XML PATH('')), 1, 1, '') AS referencedColumns
       FROM sys.foreign_keys fk`,
  );
  const checks = await readQuery(
    pool,
    `SELECT parent_object_id AS objectId, name, definition FROM sys.check_constraints`,
  );
  const definitions = await optional(
    'definitions',
    () =>
      readQuery(
        pool,
        `SELECT o.object_id AS objectId, OBJECT_DEFINITION(o.object_id) AS definition
           FROM sys.objects o WHERE o.is_ms_shipped = 0 AND o.type IN ('V','P','FN','IF','TF','TR')`,
      ),
    errors,
  );
  const usage = await optional(
    'usage',
    () =>
      readQuery(
        pool,
        `SELECT object_id AS objectId, MAX(last_user_update) AS lastUserUpdate,
                MAX(COALESCE(last_user_seek, last_user_scan, last_user_lookup)) AS lastUserRead
           FROM sys.dm_db_index_usage_stats WHERE database_id = DB_ID() GROUP BY object_id`,
      ),
    errors,
  );
  const permissions = await optional(
    'permissions',
    () =>
      readQuery<{ permission: string }>(
        pool,
        `SELECT permission_name AS permission FROM fn_my_permissions(NULL, 'DATABASE')`,
      ),
    errors,
  );

  const byObject = <T extends { objectId: number }>(rows: T[]) => {
    const map = new Map<number, T[]>();
    for (const row of rows) {
      const list = map.get(row.objectId) ?? [];
      list.push(row);
      map.set(row.objectId, list);
    }
    return map;
  };
  const sizeMap = new Map(
    sizes.map((r) => [(r as { objectId: number }).objectId, r]),
  );
  const colMap = byObject(columns as { objectId: number }[]);
  const idxMap = byObject(indexes as { objectId: number }[]);
  const fkMap = byObject(foreignKeys as { objectId: number }[]);
  const ckMap = byObject(checks as { objectId: number }[]);
  const defMap = new Map(
    (definitions as { objectId: number; definition: string | null }[]).map(
      (d) => [d.objectId, d.definition],
    ),
  );
  const useMap = new Map(
    (usage as { objectId: number }[]).map((u) => [u.objectId, u]),
  );

  return {
    permissions: permissions.map((p) => p.permission),
    errors,
    objects: (objects as { objectId: number; type: string }[]).map((o) => {
      const size = sizeMap.get(o.objectId) as
        { rows?: number; totalKb?: number } | undefined;
      const use = useMap.get(o.objectId) as
        { lastUserUpdate?: Date; lastUserRead?: Date } | undefined;
      return {
        ...o,
        rows: size?.rows === undefined ? null : Number(size.rows),
        totalKb: size?.totalKb === undefined ? null : Number(size.totalKb),
        lastUserUpdate: use?.lastUserUpdate ?? null,
        lastUserRead: use?.lastUserRead ?? null,
        columns: withoutObjectId(colMap.get(o.objectId)),
        indexes: withoutObjectId(idxMap.get(o.objectId)),
        foreignKeys: withoutObjectId(fkMap.get(o.objectId)),
        checks: withoutObjectId(ckMap.get(o.objectId)),
        definition: o.type === 'U' ? null : (defMap.get(o.objectId) ?? null),
      };
    }),
  };
}

async function listDatabases(
  env: ReturnType<typeof loadEnv>,
  account: SchoolAccount,
) {
  const pool = await schoolPool(env, account, 'master');
  try {
    return await readQuery<DatabaseRow>(
      pool,
      `SELECT name, HAS_DBACCESS(name) AS hasAccess, collation_name AS collation,
              create_date AS createDate, state_desc AS state FROM sys.databases ORDER BY name`,
    );
  } finally {
    await pool.close();
  }
}

async function main() {
  const env = loadEnv();
  const index: Record<string, unknown>[] = [];
  for (const account of env.accounts) {
    const databases = await listDatabases(env, account);
    const dir = join(MIRROR_ROOT, 'catalog', account.user);
    mkdirSync(dir, { recursive: true });
    for (const db of databases) {
      if (SYSTEM_DATABASES.has(db.name)) continue;
      const entry: Record<string, unknown> = {
        account: account.user,
        database: db.name,
        hasAccess: db.hasAccess === 1,
        collation: db.collation,
        createDate: db.createDate,
      };
      if (db.hasAccess === 1) {
        const started = Date.now();
        const pool = await schoolPool(env, account, db.name);
        try {
          const description = await describeDatabase(pool);
          writeFileSync(
            join(dir, `${db.name}.json`),
            JSON.stringify({ ...entry, ...description }, null, 2),
          );
          const tables = description.objects.filter((o) => o.type === 'U');
          entry.tables = tables.length;
          entry.views = description.objects.filter(
            (o) => o.type === 'V',
          ).length;
          entry.routines =
            description.objects.length -
            tables.length -
            (entry.views as number);
          entry.rows = tables.reduce((n, t) => n + (t.rows ?? 0), 0);
          entry.totalKb = tables.reduce((n, t) => n + (t.totalKb ?? 0), 0);
          entry.errors = description.errors;
          entry.permissions = description.permissions;
        } catch (error) {
          entry.error = (error as Error).message;
        } finally {
          await pool.close();
        }
        console.log(
          `${account.user}/${db.name}: ${String(entry.tables ?? entry.error)} tables in ${Date.now() - started} ms`,
        );
      }
      index.push(entry);
    }
  }
  writeFileSync(
    join(MIRROR_ROOT, 'catalog', 'index.json'),
    JSON.stringify(index, null, 2),
  );
}

await main();
