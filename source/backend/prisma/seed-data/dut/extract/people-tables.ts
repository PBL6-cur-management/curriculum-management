import { createReadStream, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { LEGACY_SNAPSHOTS, type LegacySnapshot } from './legacy-tables.js';

// Personal-data tables: each one is allow-listed together with the only columns the seed may read.
// Never add Matkhau, SoCMND, DiaChi, phone, EMail (students), family or bank columns here.
export const PEOPLE_TABLES = {
  LECTURERS: {
    name: 'tmHosoGV',
    columns: ['MaHS', 'Hoten', 'MaBP', 'Email', 'KhoaPC'],
  },
  STUDENTS: {
    name: 'tmHoSoSV',
    columns: ['MaHS', 'Hoten', 'MaNganh', 'IDCodeVao'],
  },
  ACADEMIC_STANDING: {
    name: 'tmHocvu',
    columns: ['MaHS', 'IDCode', 'ngunghoc', 'Thoihoc'],
  },
  RESULTS: {
    name: 'tmDiemkyhoc',
    columns: ['MaHS', 'MaHP', 'IDCode', 'Diem', 'Diem4', 'DiemC'],
  },
} as const;
export type PeopleTable = (typeof PEOPLE_TABLES)[keyof typeof PEOPLE_TABLES];
export type PeopleRow<Table extends PeopleTable> = Readonly<
  Record<Table['columns'][number], string>
>;

function tableFile(
  root: string,
  snapshot: LegacySnapshot,
  table: PeopleTable,
): string | null {
  if (!Object.values(LEGACY_SNAPSHOTS).includes(snapshot))
    throw new Error('Snapshot is not allow-listed');
  const dir = join(root, snapshot);
  const matches = readdirSync(dir)
    .filter((name) => new RegExp(`^${table.name}_\\d+\\.md$`, 'i').test(name))
    .sort();
  if (matches.length > 1)
    throw new Error(`Ambiguous snapshot for ${table.name}`);
  return matches[0] ? join(dir, matches[0]) : null;
}

// Reads a markdown table line by line, so the 160 MB grade table never sits in memory. Cells are split on
// `slice(1, -1)`: trimming pipes would eat empty trailing cells and drop valid rows.
export async function streamTable<Table extends PeopleTable>(
  root: string,
  snapshot: LegacySnapshot,
  table: Table,
  onRow: (row: PeopleRow<Table>) => void,
): Promise<{ rows: number; malformedLines: number }> {
  const file = tableFile(root, snapshot, table);
  if (!file) return { rows: 0, malformedLines: 0 };
  const lines = createInterface({
    input: createReadStream(file, 'utf8'),
    crlfDelay: Infinity,
  });
  let header: string[] | null = null;
  let index: number[] = [];
  let lineNo = 0;
  const result = { rows: 0, malformedLines: 0 };
  for await (const raw of lines) {
    const line = raw.replace(/^﻿/, '').trim();
    lineNo++;
    if (!line) continue;
    const cells = line
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim());
    if (!header) {
      header = cells;
      index = table.columns.map((column) => {
        const at = header!.indexOf(column);
        if (at < 0)
          throw new Error(`Missing column ${column} in ${table.name}`);
        return at;
      });
      continue;
    }
    if (lineNo === 2) continue;
    if (
      cells.length !== header.length ||
      !line.startsWith('|') ||
      !line.endsWith('|')
    ) {
      result.malformedLines++;
      continue;
    }
    result.rows++;
    onRow(
      Object.fromEntries(
        table.columns.map((column, i) => [column, cells[index[i]]]),
      ) as PeopleRow<Table>,
    );
  }
  return result;
}
