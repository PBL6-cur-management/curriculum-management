// Step 4 of the school DB discovery: export every mirrored table to UTF-8 CSV (RFC 4180, header row).
// Reads the local mirror only. Binary cells become "[binary:<bytes>]"; tmHocPhan.Decuong blobs are
// written to <MIRROR_ROOT>/files/<db>/tmHocPhan_Decuong/<MaHP>.<ext> because they hold syllabus files.
// Usage: tsx export-csv.ts [--only=db.table,...]
import {
  createWriteStream,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { MIRROR_ROOT, loadEnv, mirrorPool, quoteName } from './connection.js';

function sniffExtension(buffer: Buffer): string {
  const head = buffer.subarray(0, 8).toString('latin1');
  if (head.startsWith('%PDF')) return 'pdf';
  if (head.startsWith('PK')) return 'zip-or-docx';
  if (
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
  )
    return 'doc';
  if (head.startsWith('{\\rtf')) return 'rtf';
  return 'bin';
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text: string;
  if (Buffer.isBuffer(value)) text = `[binary:${value.length}]`;
  else if (value instanceof Date) text = value.toISOString();
  else text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main() {
  const env = loadEnv();
  const only = process.argv
    .find((a) => a.startsWith('--only='))
    ?.slice(7)
    .split(',');
  const manifestFile = join(MIRROR_ROOT, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as Record<
    string,
    {
      database: string;
      table: string;
      status: string;
      csvRows?: number;
      mirrorRows?: number;
    }
  >;
  for (const [key, entry] of Object.entries(manifest)) {
    if (entry.status !== 'OK' || (only && !only.includes(key))) continue;
    const pool = await mirrorPool(env, entry.database);
    const dir = join(MIRROR_ROOT, 'csv', entry.database);
    mkdirSync(dir, { recursive: true });
    const out = createWriteStream(join(dir, `${entry.table}.csv`), {
      encoding: 'utf8',
    });
    const blobDir = join(
      MIRROR_ROOT,
      'files',
      entry.database,
      `${entry.table}_Decuong`,
    );
    let rows = 0;
    let blobs = 0;
    try {
      await new Promise<void>((resolve, reject) => {
        const request = pool.request();
        request.stream = true;
        let columns: string[] = [];
        request.on('recordset', (meta: Record<string, { index: number }>) => {
          columns = Object.entries(meta)
            .sort((a, b) => a[1].index - b[1].index)
            .map(([name]) => name);
          out.write(`${columns.map(csvCell).join(',')}\n`);
        });
        request.on('row', (row: Record<string, unknown>) => {
          rows++;
          const blob = row.Decuong;
          if (
            Buffer.isBuffer(blob) &&
            blob.length > 0 &&
            typeof row.MaHP === 'string'
          ) {
            mkdirSync(blobDir, { recursive: true });
            writeFileSync(
              join(blobDir, `${row.MaHP.trim()}.${sniffExtension(blob)}`),
              blob,
            );
            blobs++;
          }
          if (
            !out.write(`${columns.map((c) => csvCell(row[c])).join(',')}\n`)
          ) {
            request.pause();
            out.once('drain', () => request.resume());
          }
        });
        request.on('error', reject);
        request.on('done', () => resolve());
        void request.query(`SELECT * FROM dbo.${quoteName(entry.table)}`);
      });
    } finally {
      await new Promise<void>((resolve) => out.end(resolve));
      await pool.close();
    }
    entry.csvRows = rows;
    writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
    console.log(
      `${key}: ${rows} rows${blobs ? `, ${blobs} syllabus files` : ''}${rows === entry.mirrorRows ? '' : ' MISMATCH'}`,
    );
  }
}

await main();
