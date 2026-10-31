// Step 5 of the school DB discovery: profile mirrored tables and test inferred relationships.
// Runs against the local mirror only, so the school server takes no extra load.
// Output: <MIRROR_ROOT>/profile/<db>.<table>.json and profile/relations.json.
// Usage: tsx profile.ts [--only=db.table,...] [--relations-only]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type sql from 'mssql';
import {
  MIRROR_ROOT,
  loadEnv,
  mirrorPool,
  quoteName,
  readQuery,
} from './connection.js';

const LOB_TYPES = new Set([
  'text',
  'ntext',
  'image',
  'xml',
  'varbinary',
  'binary',
  'timestamp',
]);

interface ColumnMeta {
  name: string;
  type: string;
  maxLength: number;
}

async function profileTable(pool: sql.ConnectionPool, table: string) {
  const columns = await readQuery<ColumnMeta>(
    pool,
    `SELECT c.name, t.name AS type, c.max_length AS maxLength FROM sys.columns c
       JOIN sys.types t ON t.user_type_id = c.user_type_id
      WHERE c.object_id = OBJECT_ID(N'dbo.${table.replace(/'/g, "''")}') ORDER BY c.column_id`,
  );
  const t = `dbo.${quoteName(table)}`;
  const [{ total }] = await readQuery<{ total: number }>(
    pool,
    `SELECT COUNT_BIG(*) AS total FROM ${t}`,
  );
  const result = [];
  for (const column of columns) {
    // MIN/MAX/DISTINCT reject bit, so profile it as tinyint.
    const c =
      column.type === 'bit'
        ? `CAST(${quoteName(column.name)} AS tinyint)`
        : quoteName(column.name);
    const lob = LOB_TYPES.has(column.type) || column.maxLength === -1;
    const isText = /char/.test(column.type);
    const [stats] = await readQuery<Record<string, unknown>>(
      pool,
      lob
        ? `SELECT SUM(CASE WHEN ${c} IS NULL THEN 1 ELSE 0 END) AS nulls,
                  MAX(DATALENGTH(${c})) AS maxBytes, SUM(CASE WHEN DATALENGTH(${c}) > 0 THEN 1 ELSE 0 END) AS nonEmpty
             FROM ${t}`
        : `SELECT SUM(CASE WHEN ${c} IS NULL THEN 1 ELSE 0 END) AS nulls,
                  ${isText ? `SUM(CASE WHEN LTRIM(RTRIM(${c})) = '' THEN 1 ELSE 0 END)` : '0'} AS blanks,
                  COUNT(DISTINCT ${c}) AS distinctCount,
                  CONVERT(nvarchar(200), MIN(${c})) AS minValue, CONVERT(nvarchar(200), MAX(${c})) AS maxValue
                  ${isText ? `, MAX(LEN(${c})) AS maxLen` : ''}
             FROM ${t}`,
    );
    const top = lob
      ? []
      : await readQuery<{ value: string | null; n: number }>(
          pool,
          `SELECT TOP 8 CONVERT(nvarchar(200), ${c}) AS value, COUNT_BIG(*) AS n FROM ${t}
            GROUP BY ${c} ORDER BY COUNT_BIG(*) DESC`,
        );
    result.push({
      ...column,
      ...stats,
      top: top.map((r) => ({ value: r.value, n: Number(r.n) })),
    });
  }
  return { table, rows: Number(total), columns: result };
}

// Inferred links (no FK exists in the source). Each is "child column ⊆ parent column".
const RELATIONS: [string, string, string, string, string][] = [
  // [database, childTable, childColumn, parentTable, parentColumn]
  ['tmProxDUT', 'tmKhungCT', 'MaKhung', 'tmNganh', 'MaNganh'],
  ['tmProxDUT', 'tmKhungCT', 'MaHP', 'tmHocPhan', 'MaHP'],
  ['tmProxDUT', 'tmKhungCT', 'MaHPTT', 'tmHocPhan', 'MaHP'],
  ['tmProxDUT', 'tmKhungTC', 'MaKhung', 'tmNganh', 'MaNganh'],
  ['tmProxDUT', 'tmHocphanDK', 'MaKhung', 'tmNganh', 'MaNganh'],
  ['tmProxDUT', 'tmHocphanDK', 'MaHP', 'tmHocPhan', 'MaHP'],
  ['tmProxDUT', 'tmHocphanDK', 'MaHPdk', 'tmHocPhan', 'MaHP'],
  ['tmProxDUT', 'tmHocPhan_PT', 'MaHP', 'tmHocPhan', 'MaHP'],
  ['tmProxDUT', 'DK_HPLogic', 'MaNganh', 'tmNganh', 'MaNganh'],
  ['tmProxDUT', 'tmHocPhan', 'KhoaPC', 'tmDonVi', 'MaDV'],
  ['tmProxDUT', 'tmLop', 'MaKhung', 'tmNganh', 'MaNganh'],
  ['tmProxDUT', 'tmHoSoSV', 'MaLop', 'tmLop', 'MaLop'],
  ['tmProxDUT', 'tmHoSoSV', 'MaNganh', 'tmNganh', 'MaNganh'],
  ['tmProxDUT', 'tmHoSoSV', 'IDCodeVao', 'tmKehoach', 'IDCode'],
  ['tmProxDUT', 'tmHosoGV', 'KhoaPC', 'tmDonVi', 'MaDV'],
  ['tmProxDUT', 'tmLopHP', 'MaGV', 'tmHosoGV', 'MaHS'],
  ['tmProxDUT', 'tmDiemkyhoc', 'MaHS', 'tmHoSoSV', 'MaHS'],
  ['tmProxDUT', 'tmDiemkyhoc', 'MaHP', 'tmHocPhan', 'MaHP'],
  ['tmProxDUT', 'tmDiemkyhoc', 'MalopHP', 'tmLopHP', 'MalopHP'],
  ['tmProxDUT', 'tmDiemkyhoc', 'IDCode', 'tmKehoach', 'IDCode'],
  ['tmProxDUT', 'tmDiemMien', 'MaHP', 'tmHocPhan', 'MaHP'],
  ['tmProxDUT', 'tmHocvu', 'MaHS', 'tmHoSoSV', 'MaHS'],
  ['tmProxDUT', 'tmHocvuTK', 'MaHS', 'tmHoSoSV', 'MaHS'],
  ['tmProxDUT', 'tmKehoachCT', 'MaHP', 'tmHocPhan', 'MaHP'],
  ['tmProxDUT', 'tmKehoachCT', 'IDCode', 'tmKehoach', 'IDCode'],
  ['tmProxDUT', 'tmChamTienDo_Cache', 'MaHS', 'tmHoSoSV', 'MaHS'],
  ['tmProxDUT', 'tmHPThieu', 'MaHP', 'tmHocPhan', 'MaHP'],
  ['tmProxDUT', 'tmChungChiSV', 'MaCC', 'tmChungChi', 'MaCC'],
  ['tmProxDUT', 'tmHocphanGV', 'MaHP', 'tmHocPhan', 'MaHP'],
  ['tmProxDUT', 'tmHocphanGV', 'MaHS', 'tmHosoGV', 'MaHS'],
  ['DATA_GVien1', 'tmHocPhanKH', 'MaHP', 'tmHocPhan', 'MaHP'],
  ['DATA_GVien1', 'tmHocPhanLT', 'MaHP', 'tmHocPhan', 'MaHP'],
  ['DATA_GVien1', 'tmHocPhanML', 'MaHP', 'tmHocPhan', 'MaHP'],
  ['DATA_GVien1', 'tmGiaoTrinh', 'MaHP', 'tmHocPhan', 'MaHP'],
  ['DATA_GVien1', 'tmHocPhan_congthucdiem', 'MaHP', 'tmHocPhan', 'MaHP'],
  ['DATA_GVien1', 'CDRFormCT', 'MaCau', 'CDRCauHoi', 'MaCH'],
  ['DATA_GVien1', 'CDRPhanHoi', 'MaCDRForm', 'CDRForm', 'MaForm'],
  ['DATA_SV1', 'DKyHoc_KSoat_HanCheKLHT', 'MaHS', 'DSSV_KhoaWeb', 'MaHS'],
];

async function checkRelations(env: ReturnType<typeof loadEnv>) {
  const results = [];
  for (const [database, child, childCol, parent, parentCol] of RELATIONS) {
    const pool = await mirrorPool(env, database);
    try {
      const exists = await readQuery<{ n: number }>(
        pool,
        `SELECT COUNT(*) AS n FROM sys.tables WHERE name IN (N'${child}', N'${parent}')`,
      );
      if (Number(exists[0].n) < (child === parent ? 1 : 2)) {
        results.push({
          database,
          child,
          childCol,
          parent,
          parentCol,
          skipped: 'table not mirrored',
        });
        continue;
      }
      const c = quoteName(childCol);
      const p = quoteName(parentCol);
      const [row] = await readQuery<Record<string, number>>(
        pool,
        `WITH k AS (SELECT DISTINCT LTRIM(RTRIM(${c})) AS v FROM dbo.${quoteName(child)} WHERE NULLIF(LTRIM(RTRIM(${c})), '') IS NOT NULL),
              pk AS (SELECT DISTINCT LTRIM(RTRIM(${p})) AS v FROM dbo.${quoteName(parent)})
         SELECT (SELECT COUNT(*) FROM k) AS childDistinct,
                (SELECT COUNT(*) FROM k WHERE v NOT IN (SELECT v FROM pk WHERE v IS NOT NULL)) AS orphanDistinct,
                (SELECT COUNT(*) FROM dbo.${quoteName(parent)}) AS parentRows,
                (SELECT COUNT(*) FROM pk) AS parentDistinct`,
      );
      results.push({
        database,
        child,
        childCol,
        parent,
        parentCol,
        ...row,
        parentIsUnique: row.parentRows === row.parentDistinct,
      });
    } finally {
      await pool.close();
    }
  }
  return results;
}

async function main() {
  const env = loadEnv();
  const only = process.argv
    .find((a) => a.startsWith('--only='))
    ?.slice(7)
    .split(',');
  const outDir = join(MIRROR_ROOT, 'profile');
  mkdirSync(outDir, { recursive: true });
  if (!process.argv.includes('--relations-only')) {
    const manifest = JSON.parse(
      readFileSync(join(MIRROR_ROOT, 'manifest.json'), 'utf8'),
    ) as Record<string, { database: string; table: string; status: string }>;
    for (const [key, entry] of Object.entries(manifest)) {
      if (entry.status !== 'OK' || (only && !only.includes(key))) continue;
      const pool = await mirrorPool(env, entry.database);
      try {
        const profile = await profileTable(pool, entry.table);
        writeFileSync(
          join(outDir, `${key}.json`),
          JSON.stringify(profile, null, 2),
        );
        console.log(
          `${key}: ${profile.rows} rows, ${profile.columns.length} columns`,
        );
      } finally {
        await pool.close();
      }
    }
  }
  const relations = await checkRelations(env);
  writeFileSync(
    join(outDir, 'relations.json'),
    JSON.stringify(relations, null, 2),
  );
  console.log(`${relations.length} relations checked`);
}

await main();
