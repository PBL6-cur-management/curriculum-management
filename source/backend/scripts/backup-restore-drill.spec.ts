import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  configFrom,
  parseArgs,
  parseResult,
  parseTier,
  required,
  requiredEnv,
  run,
} from './backup-restore-drill.js';

const signal = new AbortController().signal;

describe('parseArgs', () => {
  it('reads --name value pairs after the command', () => {
    expect(
      parseArgs(['restore', '--backup-id', 'daily-2026-10-25', '--tier', 'B4']),
    ).toEqual({
      command: 'restore',
      options: { 'backup-id': 'daily-2026-10-25', tier: 'B4' },
    });
  });

  it('answers help without credentials for no command, --help or help', () => {
    expect(parseArgs([]).command).toBe('help');
    expect(parseArgs(['--help']).command).toBe('help');
    expect(parseArgs(['restore', '--help']).command).toBe('help');
  });

  it('rejects an unknown command, a dangling option and a repeated one', () => {
    expect(() => parseArgs(['drop'])).toThrow('Lệnh không hợp lệ');
    expect(() => parseArgs(['verify', '--drill-id'])).toThrow('Tùy chọn');
    expect(() => parseArgs(['verify', '--drill-id', '--other', 'x'])).toThrow(
      'Tùy chọn',
    );
    expect(() =>
      parseArgs(['verify', '--drill-id', 'a', '--drill-id', 'b']),
    ).toThrow('lặp lại');
  });
});

describe('required values', () => {
  it('names the missing option or environment variable', () => {
    expect(() => required({}, 'operator')).toThrow('--operator');
    expect(() => required({ operator: '  ' }, 'operator')).toThrow(
      '--operator',
    );
    expect(() => requiredEnv({}, 'RESTORE_DRILL_DATABASE_URL')).toThrow(
      'RESTORE_DRILL_DATABASE_URL',
    );
    expect(required({ operator: ' An ' }, 'operator')).toBe('An');
  });

  it('accepts only the six delivery tiers and passed|failed', () => {
    expect(parseTier('B4')).toBe('B4');
    expect(() => parseTier('B9')).toThrow('Bậc triển khai');
    expect(parseResult('passed')).toBe(true);
    expect(parseResult('failed')).toBe(false);
    expect(() => parseResult('ok')).toThrow('passed hoặc failed');
  });
});

describe('configFrom', () => {
  const base = {
    BACKUP_ROOT: path.resolve('/backup-root'),
    FILES_ROOT: path.resolve('/files-root'),
    DATABASE_URL: 'postgresql://u@localhost/ctdt',
  };

  it('enables backups explicitly and defaults the tool names', () => {
    const config = configFrom(base);
    expect(config.enabled).toBe(true);
    expect(config.pgDumpPath).toBe('pg_dump');
    expect(config.pgRestorePath).toBe('pg_restore');
  });

  it('has no default for the backup root, files root or source database', () => {
    for (const name of ['BACKUP_ROOT', 'FILES_ROOT', 'DATABASE_URL']) {
      const env: NodeJS.ProcessEnv = { ...base };
      delete env[name];
      expect(() => configFrom(env)).toThrow(name);
    }
  });
});

describe('run', () => {
  it('prints usage for help and needs no environment at all', async () => {
    const out: unknown[] = [];
    expect(await run(['--help'], {}, signal, (v) => out.push(v))).toBe(0);
    expect(String(out[0])).toContain('pnpm backup:drill');
    expect(String(out[0])).toContain(
      'không bao giờ ghi vào cơ sở dữ liệu thật',
    );
  });

  it('refuses restore and verify before touching anything when the drill target is not set', async () => {
    const env = {
      BACKUP_ROOT: path.resolve('/backup-root'),
      FILES_ROOT: path.resolve('/files-root'),
      DATABASE_URL: 'postgresql://u@localhost/ctdt',
    };
    await expect(
      run(
        [
          'restore',
          '--backup-id',
          'daily-2026-10-25',
          '--tier',
          'B4',
          '--operator',
          'An',
        ],
        env,
        signal,
        () => undefined,
      ),
    ).rejects.toThrow('RESTORE_DRILL_DATABASE_URL');
    await expect(
      run(['verify', '--drill-id', 'x'], env, signal, () => undefined),
    ).rejects.toThrow('RESTORE_DRILL_DATABASE_URL');
  });

  it('inspect runs with no environment and fails on a directory that is not a set', async () => {
    const empty = mkdtempSync(path.join(tmpdir(), 'ctdt-inspect-'));
    try {
      await expect(
        run(['inspect', '--set-directory', empty], {}, signal, () => undefined),
      ).rejects.toBeDefined();
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
