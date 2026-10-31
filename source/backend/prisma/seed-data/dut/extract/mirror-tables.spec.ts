import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { csvRecords, MIRROR_TABLES, readMirrorTable } from './mirror-tables.js';

const collect = async (chunks: string[]) => {
  const records: string[][] = [];
  for await (const record of csvRecords(chunks)) records.push(record);
  return records;
};

describe('csvRecords', () => {
  it('reads quoted commas, escaped quotes and line breaks across chunks', async () => {
    expect(
      await collect(['﻿a,b\r\n"x, y","say ""', 'hi"""\n"two\nlines",', '\n']),
    ).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['two\nlines', ''],
    ]);
  });
  it('keeps a last record without a trailing newline', async () => {
    expect(await collect(['a,b\n1,'])).toEqual([
      ['a', 'b'],
      ['1', ''],
    ]);
  });
  it('rejects an unterminated quote', async () => {
    await expect(collect(['a\n"open'])).rejects.toThrow('Unterminated');
  });
});

describe('readMirrorTable', () => {
  const root = mkdtempSync(join(tmpdir(), 'dut-mirror-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  const dir = join(root, 'csv', MIRROR_TABLES.UNITS.database);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'tmDonVi.csv'),
    'ID,MaDV,MaBP,TenDV,DiaChi\n1,102 ,198,K. Công nghệ Thông tin  ,secret\n2,bad\n',
  );

  it('keeps only allow-listed columns, trimmed, and counts malformed records', async () => {
    const result = await readMirrorTable(root, MIRROR_TABLES.UNITS);
    expect(result.rows).toEqual([
      { MaDV: '102', MaBP: '198', TenDV: 'K. Công nghệ Thông tin' },
    ]);
    expect(result.malformedLines).toBe(1);
  });
  it('refuses a missing table', async () => {
    await expect(readMirrorTable(root, MIRROR_TABLES.MAJORS)).rejects.toThrow(
      'Missing mirror table',
    );
  });
  it('refuses a table outside the allow-list', async () => {
    await expect(
      readMirrorTable(root, {
        database: 'tmProxDUT',
        name: 'tmHoSoSV',
        columns: ['Matkhau'],
      } as never),
    ).rejects.toThrow('allow-listed');
  });
});
