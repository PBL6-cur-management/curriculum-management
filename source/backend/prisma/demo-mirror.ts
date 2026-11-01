// Reads one table of the local copy of the school database (D:\dut-mirror, never committed) for the demo scripts.
import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { csvRecords } from './seed-data/dut/extract/mirror-tables.js';

export type MirrorRow = Record<string, string>;

export async function readMirrorCsv(
  root: string,
  database: string,
  table: string,
): Promise<MirrorRow[]> {
  const file = join(root, 'csv', database, `${table}.csv`);
  if (!existsSync(file))
    throw new Error(`Thiếu bảng ${database}/${table} trong bản sao (${file}).`);
  const rows: MirrorRow[] = [];
  let header: string[] | null = null;
  for await (const record of csvRecords(
    createReadStream(file, { encoding: 'utf8' }),
  )) {
    if (!header) {
      header = record;
      continue;
    }
    if (record.length !== header.length) continue;
    rows.push(
      Object.fromEntries(header.map((name, i) => [name, record[i].trim()])),
    );
  }
  return rows;
}
