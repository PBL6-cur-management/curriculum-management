import 'dotenv/config';
import { spawnSync, type SpawnSyncOptions } from 'node:child_process';
import { closeSync, mkdirSync, openSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { mirrorRoot } from '../prisma/seed-data/dut/extract/mirror-tables.js';

// Rebuilds the LOCAL real-data database from scratch: back it up, reset it, base seed, extract the school mirror,
// DUT seed. Every row typed by hand on this database is lost (the backup keeps it).
// Usage: pnpm db:rebuild:real --yes [--mirror D:/dut-mirror]
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const REAL_DATABASE = 'ctdt_real';
const IS_WINDOWS = process.platform === 'win32';

function fail(message: string): never {
  console.error(`\n${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
if (!args.includes('--yes'))
  fail(
    'Lệnh này xóa toàn bộ dữ liệu của CSDL ctdt_real cục bộ rồi dựng lại từ bản sao dữ liệu Trường.\nChạy lại với --yes để xác nhận.',
  );
const mirrorArgument = args.includes('--mirror')
  ? args[args.indexOf('--mirror') + 1]
  : undefined;
const mirror = resolve(mirrorRoot(mirrorArgument));

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) fail('Thiếu DATABASE_URL trong source/backend/.env.');
const url = new URL(rawUrl);
const database = url.pathname.replace(/^\//, '');
if (
  !LOCAL_HOSTS.has(url.hostname.replace(/^\[|\]$/g, '')) ||
  database !== REAL_DATABASE
)
  fail(
    `Từ chối: DATABASE_URL phải trỏ tới ${REAL_DATABASE} trên máy này (đang là ${url.hostname}/${database}).`,
  );

function run(
  command: string,
  commandArgs: string[],
  options: SpawnSyncOptions = {},
) {
  console.log(`\n> ${command} ${commandArgs.join(' ')}`);
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    shell: IS_WINDOWS,
    ...options,
  });
  if (result.status !== 0)
    fail(`Lệnh thất bại: ${command} ${commandArgs.join(' ')}`);
}

// 1. Safety net: a custom-format dump of the current database, taken inside the compose container (no local pg_dump).
const backupDir = resolve(
  process.env.DUT_PG_BACKUP_DIR ?? join(mirror, '..', 'pg-backups'),
);
mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = join(backupDir, `${REAL_DATABASE}-${stamp}.dump`);
console.log(`\n> pg_dump ${REAL_DATABASE} → ${backupFile}`);
const out = openSync(backupFile, 'w');
const dump = spawnSync(
  'docker',
  [
    'compose',
    'exec',
    '-T',
    'postgres',
    'pg_dump',
    '-U',
    decodeURIComponent(url.username),
    '-d',
    database,
    '-Fc',
  ],
  { stdio: ['ignore', out, 'inherit'], shell: IS_WINDOWS },
);
closeSync(out);
if (dump.status !== 0 || statSync(backupFile).size === 0)
  fail(
    'Không sao lưu được CSDL (container postgres đã chạy chưa? `pnpm services:up`). Chưa xóa gì.',
  );

// 2. Reset (local throwaway only, chosen by the user), base seed, extraction and the DUT seed.
run('pnpm', ['exec', 'prisma', 'migrate', 'reset', '--force']);
run('pnpm', ['prisma:seed']);
run('pnpm', ['dut:extract', mirror]);
run('pnpm', ['prisma:seed:dut']);

console.log(
  `\nĐã dựng lại ${REAL_DATABASE} từ ${mirror}. Bản sao lưu trước khi xóa: ${backupFile}\nTệp đính kèm cũ trong FILES_ROOT không bị xóa; các dòng CSDL trỏ tới chúng đã mất.`,
);
