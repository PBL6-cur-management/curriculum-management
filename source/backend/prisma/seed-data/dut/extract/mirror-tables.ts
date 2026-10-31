import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';

// The local mirror of the school's databases (D:\dut-mirror, outside the repo): one CSV per table, RFC 4180, UTF-8,
// written by scripts/school-discovery/export-csv.ts. The seed never connects to the school.
export const DEFAULT_MIRROR_ROOT = 'D:/dut-mirror';
export const mirrorRoot = (argument?: string) =>
  argument ?? process.env.DUT_MIRROR_ROOT ?? DEFAULT_MIRROR_ROOT;

export const MIRROR_DATABASES = {
  PROX: 'tmProxDUT',
  // DHBK_CDS holds the only official term start dates past 2020 (tmKehoach); see D:\dut-mirror\README.md.
  DHBK: 'DHBK_CDS',
} as const;
type MirrorDatabase = (typeof MIRROR_DATABASES)[keyof typeof MIRROR_DATABASES];

interface MirrorTableDefinition {
  database: MirrorDatabase;
  name: string;
  columns: readonly string[];
}

// Every table the seed reads, with the only columns it may read. Personal-data tables stay minimal: never add
// Matkhau, SoCMND, DiaChi, phone, student e-mail, family or bank columns here.
export const MIRROR_TABLES = {
  MAJORS: {
    database: MIRROR_DATABASES.PROX,
    name: 'tmNganh',
    columns: [
      'MaNganh',
      'TenNganh',
      'Kyhieu',
      'SoTinChi',
      'SoHK',
      'Sotuchon',
      'InUse',
      'CapDT',
      'LoaiCTDT',
      'KyBDau',
    ],
  },
  NATIONAL_MAJORS: {
    database: MIRROR_DATABASES.PROX,
    name: 'tmNganhQG',
    columns: ['MaNganhQG', 'TenNganhQG'],
  },
  FRAME_ROWS: {
    database: MIRROR_DATABASES.PROX,
    name: 'tmKhungCT',
    columns: [
      'MaKhung',
      'MaHP',
      'Hocky',
      'Tuchon',
      'STT',
      'Note',
      'TQDA',
      'HTDA',
    ],
  },
  FRAME_SEMESTER_CREDITS: {
    database: MIRROR_DATABASES.PROX,
    name: 'tmKhungTC',
    columns: ['MaKhung', 'Hocky', 'SoTC'],
  },
  COURSES: {
    database: MIRROR_DATABASES.PROX,
    name: 'tmHocPhan',
    columns: [
      'MaHP',
      'TenHP',
      'TenHP1',
      'SoTC',
      'LyThuyet',
      'ThucTap',
      'DoAn',
      'LoaiHP',
      'KhoaPC',
      'DATN',
    ],
  },
  REQUISITES: {
    database: MIRROR_DATABASES.PROX,
    name: 'tmHocphanDK',
    columns: ['MaKhung', 'MaHP', 'MaHPdk', 'LoaiDK', 'Hoac'],
  },
  UNITS: {
    database: MIRROR_DATABASES.PROX,
    name: 'tmDonVi',
    columns: ['MaDV', 'MaBP', 'TenDV'],
  },
  TERMS: {
    database: MIRROR_DATABASES.DHBK,
    name: 'tmKehoach',
    columns: ['IDCode', 'NgayDau'],
  },
  LECTURERS: {
    database: MIRROR_DATABASES.PROX,
    name: 'tmHosoGV',
    columns: ['MaHS', 'Hoten', 'MaBP', 'Email', 'KhoaPC'],
  },
  STUDENTS: {
    database: MIRROR_DATABASES.PROX,
    name: 'tmHoSoSV',
    columns: ['MaHS', 'Hoten', 'MaNganh', 'IDCodeVao', 'Tinhtrang1'],
  },
  ACADEMIC_STANDING: {
    database: MIRROR_DATABASES.PROX,
    name: 'tmHocvu',
    columns: ['MaHS', 'IDCode', 'ngunghoc', 'Thoihoc'],
  },
  RESULTS: {
    database: MIRROR_DATABASES.PROX,
    name: 'tmDiemkyhoc',
    columns: ['MaHS', 'MaHP', 'IDCode', 'MalopHP', 'Diem', 'Diem4', 'DiemC'],
  },
  EXEMPTIONS: {
    database: MIRROR_DATABASES.PROX,
    name: 'tmDiemMien',
    columns: ['MaHS', 'MaHP', 'IDCode', 'Diem', 'Diem4', 'DiemC'],
  },
  SECTIONS: {
    database: MIRROR_DATABASES.PROX,
    name: 'tmLopHP',
    columns: ['MalopHP', 'MaGV', 'MaGV1'],
  },
} as const satisfies Record<string, MirrorTableDefinition>;
export type MirrorTable = (typeof MIRROR_TABLES)[keyof typeof MIRROR_TABLES];
export type MirrorRow<Table extends MirrorTable> = Readonly<
  Record<Table['columns'][number], string>
>;

// RFC 4180 records from text chunks: quoted cells may hold commas, quotes ("") and line breaks.
export async function* csvRecords(
  chunks: AsyncIterable<string> | Iterable<string>,
): AsyncGenerator<string[]> {
  let record: string[] = [];
  let cell = '';
  let quoted = false;
  let justClosed = false;
  let pending = false;
  for await (const chunk of chunks) {
    for (const char of chunk) {
      pending = true;
      if (quoted) {
        if (char === '"') {
          quoted = false;
          justClosed = true;
        } else cell += char;
        continue;
      }
      if (char === '"') {
        if (justClosed) cell += '"';
        quoted = true;
        justClosed = false;
        continue;
      }
      justClosed = false;
      if (char === ',') {
        record.push(cell);
        cell = '';
      } else if (char === '\n') {
        record.push(cell);
        yield record;
        record = [];
        cell = '';
        pending = false;
      } else if (char !== '\r' && char !== '\uFEFF') cell += char;
    }
  }
  if (quoted) throw new Error('Unterminated quoted CSV cell');
  if (pending) {
    record.push(cell);
    yield record;
  }
}

export const mirrorTableFile = (root: string, table: MirrorTable) =>
  join(root, 'csv', table.database, `${table.name}.csv`);

// Reads one allow-listed table, keeping only its allow-listed columns, trimmed (the school pads char columns).
export async function readMirrorTable<Table extends MirrorTable>(
  root: string,
  table: Table,
): Promise<{ rows: MirrorRow<Table>[]; malformedLines: number }> {
  if (!Object.values(MIRROR_TABLES).includes(table))
    throw new Error('Table is not allow-listed');
  const file = mirrorTableFile(root, table);
  if (!existsSync(file))
    throw new Error(
      `Missing mirror table ${table.database}/${table.name}: set DUT_MIRROR_ROOT or pass the mirror root`,
    );
  const result = { rows: [] as MirrorRow<Table>[], malformedLines: 0 };
  let header: string[] | null = null;
  let index: number[] = [];
  for await (const record of csvRecords(
    createReadStream(file, { encoding: 'utf8' }),
  )) {
    if (!header) {
      header = record;
      index = table.columns.map((column) => {
        const at = header!.indexOf(column);
        if (at < 0)
          throw new Error(`Missing column ${column} in ${table.name}`);
        return at;
      });
      continue;
    }
    if (record.length !== header.length) {
      result.malformedLines++;
      continue;
    }
    result.rows.push(
      Object.fromEntries(
        table.columns.map((column, i) => [column, record[index[i]].trim()]),
      ) as MirrorRow<Table>,
    );
  }
  return result;
}
