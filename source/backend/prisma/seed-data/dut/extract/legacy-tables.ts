import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const LEGACY_SNAPSHOTS = { DHBK: 'DHBK_CDS', SV1: 'Data_SV1' } as const;
export type LegacySnapshot =
  (typeof LEGACY_SNAPSHOTS)[keyof typeof LEGACY_SNAPSHOTS];
export const LEGACY_TABLES = {
  MAJORS: 'TmNganh',
  FRAME_ROWS: 'tmKhungCT',
  COURSES: 'tmHocPhan',
  REQUISITES: 'tmHocphanDK',
  TERMS: 'tmKehoach',
  UNITS: 'DonVi',
} as const;
export type LegacyTable = (typeof LEGACY_TABLES)[keyof typeof LEGACY_TABLES];
export type LegacyRow = Readonly<Record<string, string>>;
export interface ParsedTable {
  rows: LegacyRow[];
  malformedLines: number;
}

export function parseMarkdownTable(text: string): ParsedTable {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const cells = (line: string) =>
    line
      .trim()
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim());
  const headers = cells(lines[0] ?? '');
  const result: ParsedTable = { rows: [], malformedLines: 0 };
  for (const line of lines.slice(2)) {
    if (!line.trim()) continue;
    const values = cells(line);
    if (
      values.length !== headers.length ||
      !line.trim().startsWith('|') ||
      !line.trim().endsWith('|')
    ) {
      result.malformedLines++;
      continue;
    }
    result.rows.push(
      Object.fromEntries(
        headers.map((header, index) => [header, values[index]]),
      ),
    );
  }
  return result;
}

export function findTableFile(dir: string, table: LegacyTable): string | null {
  if (!Object.values(LEGACY_TABLES).includes(table))
    throw new Error('Table is not allow-listed');
  const matches = readdirSync(dir)
    .filter((name) => new RegExp(`^${table}_\\d+\\.md$`, 'i').test(name))
    .sort();
  if (matches.length > 1) throw new Error(`Ambiguous snapshot for ${table}`);
  return matches[0] ? join(dir, matches[0]) : null;
}

export function readTable(
  root: string,
  snapshot: LegacySnapshot,
  table: LegacyTable,
): ParsedTable {
  if (!Object.values(LEGACY_SNAPSHOTS).includes(snapshot))
    throw new Error('Snapshot is not allow-listed');
  const file = findTableFile(join(root, snapshot), table);
  return file
    ? parseMarkdownTable(readFileSync(file, 'utf8'))
    : { rows: [], malformedLines: 0 };
}

export function mergeSnapshots(
  root: string,
  table: LegacyTable,
  key: (row: LegacyRow) => string,
): { rows: Map<string, LegacyRow>; malformedLines: number } {
  const rows = new Map<string, LegacyRow>();
  let malformedLines = 0;
  for (const snapshot of [LEGACY_SNAPSHOTS.SV1, LEGACY_SNAPSHOTS.DHBK]) {
    const parsed = readTable(root, snapshot, table);
    malformedLines += parsed.malformedLines;
    for (const row of parsed.rows) rows.set(key(row), row);
  }
  return { rows, malformedLines };
}
