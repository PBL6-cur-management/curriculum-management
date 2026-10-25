import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  findTableFile,
  LEGACY_SNAPSHOTS,
  LEGACY_TABLES,
  mergeSnapshots,
  parseMarkdownTable,
} from './legacy-tables.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'dut-tables-'));
  roots.push(root);
  return root;
}
describe('legacy tables', () => {
  it('skips the header and separator and trims cells and BOM', () => {
    expect(
      parseMarkdownTable(
        '\uFEFF| code | value |\n| --- | --- |\n| 01 | synthetic |\n',
      ),
    ).toEqual({
      rows: [{ code: '01', value: 'synthetic' }],
      malformedLines: 0,
    });
  });
  it('counts malformed lines without returning them', () => {
    expect(
      parseMarkdownTable('| code | value |\n| --- | --- |\n| short |\n'),
    ).toEqual({ rows: [], malformedLines: 1 });
  });
  it('matches only the numeric course snapshot', () => {
    const root = fixture();
    writeFileSync(join(root, 'tmHocPhan_PT_123.md'), '');
    writeFileSync(join(root, 'tmHocPhan_123.md'), '');
    expect(findTableFile(root, LEGACY_TABLES.COURSES)).toBe(
      join(root, 'tmHocPhan_123.md'),
    );
  });
  it('matches the lower-case major snapshot', () => {
    const root = fixture();
    writeFileSync(join(root, 'tmNganh_123.md'), '');
    expect(findTableFile(root, LEGACY_TABLES.MAJORS)).toBe(
      join(root, 'tmNganh_123.md'),
    );
  });
  it('returns null for an absent table', () => {
    expect(findTableFile(fixture(), LEGACY_TABLES.UNITS)).toBeNull();
  });
  it('unites both snapshots with DHBK precedence', () => {
    const root = fixture();
    for (const snapshot of Object.values(LEGACY_SNAPSHOTS))
      mkdirSync(join(root, snapshot));
    writeFileSync(
      join(root, LEGACY_SNAPSHOTS.SV1, 'tmNganh_123.md'),
      '| code | value |\n| --- | --- |\n| 01 | old |\n| 02 | retained |\n',
    );
    writeFileSync(
      join(root, LEGACY_SNAPSHOTS.DHBK, 'TmNganh_123.md'),
      '| code | value |\n| --- | --- |\n| 01 | preferred |\n',
    );
    const merged = mergeSnapshots(
      root,
      LEGACY_TABLES.MAJORS,
      (row) => row.code,
    );
    expect([...merged.rows.values()]).toEqual([
      { code: '01', value: 'preferred' },
      { code: '02', value: 'retained' },
    ]);
    expect(merged.malformedLines).toBe(0);
  });
});
