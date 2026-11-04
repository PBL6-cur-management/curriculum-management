// Step 3 of the school DB discovery: copy the selected tables into the local SQL Server mirror.
// Source reads are single `bcp queryout` SELECTs WITH (NOLOCK), one table at a time; nothing is written on the school server.
// Usage: tsx mirror.ts [--only=db.table,...] [--force]
import { execFile } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  MIRROR_ROOT,
  loadEnv,
  mirrorPool,
  quoteName,
  readQuery,
  schoolPool,
  type DiscoveryEnv,
  type SchoolAccount,
} from './connection.js';

const run = promisify(execFile);

// Faculty of IT programs start with 102 (MaDV 102). Used only where a table is above the 1 GB budget.
const IT_STUDENTS_FILTER = `MaHS IN (SELECT MaHS FROM dbo.tmHoSoSV WITH (NOLOCK)
  WHERE MaNganh LIKE '102%' OR MaNganh1 LIKE '102%' OR MaNganh2 LIKE '102%')`;

interface Selection {
  database: string;
  table: string;
  group:
    'curriculum' | 'people' | 'results' | 'registration' | 'outcome-syllabus';
  filter?: string;
}

const pick = (
  database: string,
  group: Selection['group'],
  tables: string[],
): Selection[] => tables.map((table) => ({ database, table, group }));

export const SELECTION: Selection[] = [
  ...pick('tmProxDUT', 'curriculum', [
    'tmNganh',
    'tmNganh1',
    'tmNganhQG',
    'NganhCuMoi',
    'tmNhomNganh',
    'tmChuyenNganh',
    'tmKhungCT',
    'tmKhungTC',
    'tmHocPhan',
    'tmHocPhan_PT',
    'tmHocPhan_THTN',
    'tmHocphanDK',
    'DK_HPLogic',
    'DK_ChuanbiDK',
    'tmKehoach',
    'tmKehoachCT',
    'tmKehoachNam',
    'tmDonVi',
    'tmLop',
    'tmLopHP',
    'tmLopHP_congthucdiem',
    'tmHocphanGV',
    'tmConfig',
    'tmChungChi',
    'tmChungChiQD',
    'tmChungChiYC',
    'tmChungChiYC_CT',
    'tmCNTTChungChi',
    'tmTieuthuc',
    'tmThangXH',
    'doituanTN',
  ]),
  ...pick('tmProxDUT', 'people', ['tmHoSoSV', 'tmHosoGV']),
  ...pick('tmProxDUT', 'results', [
    'tmDiemTK',
    'tmDiemMien',
    'tmHocvu',
    'tmHocvuTK',
    'tmHPThieu',
    'tmChamTienDo_Cache',
    'tmChungChiSV',
    'tmCNTTChungChi_SV',
    'DoAnTotNghiep',
    'tmSoluubang',
    'CanhBao',
    'DK_HPDahoc',
  ]),
  {
    database: 'tmProxDUT',
    table: 'tmDiemkyhoc',
    group: 'results',
    filter: IT_STUDENTS_FILTER,
  },
  ...pick('DATA_GVien1', 'outcome-syllabus', [
    'tmHocPhanKH',
    'tmHocPhanLT',
    'tmHocPhanML',
    'tmGiaoTrinh',
    'tmGiaoTrinhTG',
    'tmGiaoTrinhBS',
    'tmGiaoTrinhDN',
    'tmNXBan',
    'CDRForm',
    'CDRFormCT',
    'CDRFormNhom',
    'CDRFormDot',
    'CDRFormNam',
    'CDRCauHoi',
    'CDRCauLuaChon',
    'CDRPhanHoi',
    'CDRPhanQuyen',
    'CDRThoiGianDG',
    'QLDT_DeCuongHocPhan',
  ]),
  ...pick('DATA_GVien1', 'curriculum', [
    'tmHocPhan',
    'tmHocPhan_congthucdiem',
    'tmHocPhan_CTD_k26',
    'tmHocPhan_LoaiKL',
    'tmhocphan_AnhNgoaiTruong',
    'tmNganh',
    'tmNganhTQ',
    'tmKhungCT',
    'tmKhungCT_Khac',
    'tmHocphanGV',
    'tmDonVi',
    'tmConfig_TTDiem',
  ]),
  ...pick('DATA_GVien1', 'people', ['tmHosoGV', 'CVHT_GV']),
  ...pick('DATA_SV1', 'registration', [
    'DKyHoc_HPLogic',
    'DKyHoc_KSoat_CNganh',
    'DKyHoc_KSoat_HanCheKLHT',
    'DKyHoc_KSoat_HPLock',
    'DKyHoc_HPDahoc',
    'DKyHoc_LopHP',
    'DKyHoc_HPGhepCap',
    'CourseSections',
    'StudentInCourseSections',
    'Sinhvien_lophocphan',
    'HocPhanDiemMax',
  ]),
  ...pick('DATA_SV1', 'results', [
    'LichXetTotNghiep',
    'Ma_DotTotNghiep',
    'DoAnTotNghiep',
    '_THTNTT',
    '_THTNTT_SoTC',
  ]),
  ...pick('DATA_SV1', 'people', ['DSSV_KhoaWeb', 'NhanThan']),
  ...pick('DHBK_CDS', 'curriculum', ['congthucdiem', 'tmKehoach']),
];

interface CatalogColumn {
  name: string;
  type: string;
  maxLength: number;
  precision: number;
  scale: number;
  nullable: boolean;
}

function columnType(c: CatalogColumn): string {
  const len = (bytes: number, unicode: boolean) =>
    bytes === -1 ? 'max' : String(unicode ? bytes / 2 : bytes);
  switch (c.type) {
    case 'nvarchar':
    case 'nchar':
      return `${c.type}(${len(c.maxLength, true)})`;
    case 'varchar':
    case 'char':
    case 'varbinary':
    case 'binary':
      return `${c.type}(${len(c.maxLength, false)})`;
    case 'decimal':
    case 'numeric':
      return `${c.type}(${c.precision},${c.scale})`;
    case 'datetime2':
    case 'time':
    case 'datetimeoffset':
      return `${c.type}(${c.scale})`;
    case 'timestamp':
      return 'binary(8)';
    default:
      return c.type;
  }
}

function catalogColumns(database: string, table: string): CatalogColumn[] {
  const catalogDir = join(MIRROR_ROOT, 'catalog');
  const accounts = readdirSync(catalogDir, { withFileTypes: true }).filter(
    (d) => d.isDirectory(),
  );
  for (const account of accounts) {
    const file = join(catalogDir, account.name, `${database}.json`);
    if (!existsSync(file)) continue;
    const catalog = JSON.parse(readFileSync(file, 'utf8')) as {
      objects: { name: string; type: string; columns: CatalogColumn[] }[];
    };
    const object = catalog.objects.find(
      (o) => o.type === 'U' && o.name === table,
    );
    if (object) return object.columns;
  }
  throw new Error(`${database}.${table} is not in the catalog`);
}

function accountFor(env: DiscoveryEnv, database: string) {
  const index = JSON.parse(
    readFileSync(join(MIRROR_ROOT, 'catalog', 'index.json'), 'utf8'),
  ) as { account: string; database: string; hasAccess: boolean }[];
  const entry = index.find((e) => e.database === database && e.hasAccess);
  const account = env.accounts.find((a) => a.user === entry?.account);
  if (!account) throw new Error(`No account can read ${database}`);
  return account;
}

async function deniedColumns(
  env: DiscoveryEnv,
  account: SchoolAccount,
  database: string,
  table: string,
): Promise<string[]> {
  const pool = await schoolPool(env, account, database);
  try {
    const rows = await readQuery<{ name: string }>(
      pool,
      `SELECT c.name FROM sys.columns c
        WHERE c.object_id = OBJECT_ID(N'dbo.${table.replace(/'/g, "''")}')
          AND HAS_PERMS_BY_NAME(N'dbo.${table.replace(/'/g, "''")}', 'OBJECT', 'SELECT', c.name, 'COLUMN') = 0`,
    );
    return rows.map((r) => r.name);
  } finally {
    await pool.close();
  }
}

async function bcp(args: string[]): Promise<number> {
  const { stdout } = await run('bcp', args, { maxBuffer: 64 * 1024 * 1024 });
  const match = /(\d+) rows copied/.exec(stdout);
  if (!match) throw new Error(`bcp gave no row count: ${stdout.slice(-500)}`);
  return Number(match[1]);
}

async function main() {
  const env = loadEnv();
  const only = process.argv
    .find((a) => a.startsWith('--only='))
    ?.slice(7)
    .split(',');
  const force = process.argv.includes('--force');
  const manifestFile = join(MIRROR_ROOT, 'manifest.json');
  const manifest: Record<string, Record<string, unknown>> = existsSync(
    manifestFile,
  )
    ? JSON.parse(readFileSync(manifestFile, 'utf8'))
    : {};
  const master = await mirrorPool(env);
  try {
    for (const item of SELECTION) {
      const key = `${item.database}.${item.table}`;
      if (only && !only.includes(key)) continue;
      if (!force && manifest[key]?.status === 'OK') continue;
      const started = Date.now();
      const account = accountFor(env, item.database);
      // Some credential columns carry a column-level DENY; skip them instead of failing the table.
      const denied = await deniedColumns(
        env,
        account,
        item.database,
        item.table,
      );
      const columns = catalogColumns(item.database, item.table).filter(
        (c) => !denied.includes(c.name),
      );
      const db = quoteName(item.database);
      const target = `${db}.dbo.${quoteName(item.table)}`;
      await master
        .request()
        .query(
          `IF DB_ID(N'${item.database}') IS NULL CREATE DATABASE ${db} COLLATE SQL_Latin1_General_CP1_CI_AS;`,
        );
      await master.request().query(
        `DROP TABLE IF EXISTS ${target};
         CREATE TABLE ${target} (${columns
           // Native bcp files omit the length prefix of NOT NULL fixed columns, so nullability must match the source.
           .map(
             (c) =>
               `${quoteName(c.name)} ${columnType(c)} ${c.nullable ? 'NULL' : 'NOT NULL'}`,
           )
           .join(', ')});`,
      );
      const dir = join(MIRROR_ROOT, 'bcp', item.database);
      mkdirSync(dir, { recursive: true });
      const dataFile = join(dir, `${item.table}.dat`);
      const select = `SELECT ${columns.map((c) => quoteName(c.name)).join(', ')} FROM dbo.${quoteName(item.table)} WITH (NOLOCK)${item.filter ? ` WHERE ${item.filter}` : ''}`;
      const entry: Record<string, unknown> = {
        database: item.database,
        table: item.table,
        group: item.group,
        filter: item.filter
          ? 'IT faculty students only (MaNganh LIKE 102%)'
          : null,
        deniedColumns: denied,
      };
      try {
        const sourceRows = await bcp([
          select.replace(/\s+/g, ' '),
          'queryout',
          dataFile,
          '-n',
          '-S',
          `127.0.0.1,${env.tunnelPort}`,
          '-U',
          account.user,
          '-P',
          account.password,
          '-d',
          item.database,
          '-a',
          '32768',
        ]);
        const exportedMs = Date.now() - started;
        const loadedRows = await bcp([
          `${item.database}.dbo.${item.table}`,
          'in',
          dataFile,
          '-n',
          '-S',
          `127.0.0.1,${env.mirrorPort}`,
          '-U',
          'sa',
          '-P',
          env.mirrorPassword ?? '',
          '-b',
          '50000',
          '-h',
          'TABLOCK',
        ]);
        const [{ n }] = await readQuery<{ n: number }>(
          master,
          `SELECT COUNT_BIG(*) AS n FROM ${target}`,
        );
        Object.assign(entry, {
          status:
            Number(n) === sourceRows && loadedRows === sourceRows
              ? 'OK'
              : 'COUNT_MISMATCH',
          sourceRows,
          mirrorRows: Number(n),
          exportedMs,
          totalMs: Date.now() - started,
          copiedAt: new Date().toISOString(),
        });
      } catch (error) {
        // Keep bcp's own output (the useful part) and never the command line, which carries -P.
        const failure = error as Error & { stdout?: string; stderr?: string };
        const detail =
          `${failure.stdout ?? ''}\n${failure.stderr ?? ''}`.trim() ||
          failure.message;
        Object.assign(entry, { status: 'FAILED', error: detail.slice(-1000) });
      }
      manifest[key] = entry;
      writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
      console.log(
        `${key}: ${String(entry.status)} ${String(entry.sourceRows ?? entry.error)} (${Date.now() - started} ms)`,
      );
    }
  } finally {
    await master.close();
  }
}

await main();
