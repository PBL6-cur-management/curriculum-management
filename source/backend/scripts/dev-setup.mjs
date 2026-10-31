// One-command local setup for a new teammate: infrastructure in Docker, application on the host.
//   pnpm dev:setup            (from source/backend; works before `pnpm install`)
//   node scripts/dev-setup.mjs --skip-seed
// Steps: check Node and Docker → create .env from .env.example → start PostgreSQL, Redis and Mailpit →
// install backend and frontend dependencies → apply migrations → seed roles/admin and the public DUT
// catalog. Every step is safe to re-run. Personal data (prisma/seed-data/dut/data/private) is optional:
// without it the DUT seed loads programs and courses only.

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BACKEND = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRONTEND = join(BACKEND, '..', 'frontend');
const E2E = join(BACKEND, '..', 'e2e');
const SKIP_SEED = process.argv.includes('--skip-seed');
const MIN_NODE = [22, 22];
const IS_WINDOWS = process.platform === 'win32';

function step(title) {
  console.log(`\n▶ ${title}`);
}

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function run(command, args, cwd = BACKEND) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: IS_WINDOWS,
  });
  if (result.status !== 0)
    fail(`Lệnh thất bại: ${command} ${args.join(' ')} (thư mục ${cwd})`);
}

function succeeds(command, args) {
  return (
    spawnSync(command, args, { stdio: 'ignore', shell: IS_WINDOWS }).status ===
    0
  );
}

step('Kiểm tra Node.js, pnpm và Docker');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major !== MIN_NODE[0] || minor < MIN_NODE[1])
  fail(
    `Cần Node.js 22 (≥ 22.22); đang dùng ${process.versions.node}. Cài bản Node 22 LTS mới nhất rồi chạy lại.`,
  );
if (!succeeds('pnpm', ['--version']))
  fail('Chưa có pnpm. Chạy `npm install -g pnpm@10` rồi chạy lại.');
if (!succeeds('docker', ['info']))
  fail(
    'Docker chưa chạy. Mở Docker Desktop (hoặc dịch vụ docker) rồi chạy lại.',
  );
console.log(`Node ${process.versions.node}, pnpm và Docker sẵn sàng.`);

step('Tạo source/backend/.env');
const envPath = join(BACKEND, '.env');
if (existsSync(envPath)) {
  console.log('.env đã có — giữ nguyên.');
} else {
  const example = readFileSync(join(BACKEND, '.env.example'), 'utf8');
  const env = example
    .replace(
      /^SESSION_SECRET=.*$/m,
      `SESSION_SECRET=${randomBytes(32).toString('hex')}`,
    )
    .replace(/^FILES_ROOT=.*$/m, 'FILES_ROOT=storage');
  writeFileSync(envPath, env);
  console.log(
    '.env đã tạo từ .env.example (SESSION_SECRET ngẫu nhiên, FILES_ROOT=storage).',
  );
}

const e2eEnv = join(E2E, '.env');
if (!existsSync(e2eEnv)) {
  writeFileSync(e2eEnv, readFileSync(join(E2E, '.env.example'), 'utf8'));
  console.log(
    'source/e2e/.env đã tạo — điền E2E_ADMIN_PASSWORD và E2E_PASSWORD trước khi chạy Playwright.',
  );
}

step('Dựng PostgreSQL 18, Redis 8 và Mailpit bằng Docker');
run('docker', ['compose', '--profile', 'mail', 'up', '-d', '--wait']);

step('Cài thư viện backend, frontend và e2e');
run('pnpm', ['install', '--frozen-lockfile'], BACKEND);
run('pnpm', ['install', '--frozen-lockfile'], FRONTEND);
run('pnpm', ['install', '--frozen-lockfile'], E2E);

step('Áp migration');
run('pnpm', ['exec', 'prisma', 'migrate', 'deploy']);

if (SKIP_SEED) {
  console.log('\nBỏ qua seed (--skip-seed).');
} else {
  step('Seed vai trò, quyền và tài khoản admin');
  run('pnpm', ['prisma:seed']);
  step('Seed danh mục học phần và chương trình DUT');
  run('pnpm', ['prisma:seed:dut']);
}

console.log(`
✔ Xong. Chạy ứng dụng trên máy:
  source/backend  → pnpm dev      (API http://localhost:3000/api, tài liệu /api/docs)
  source/frontend → pnpm dev      (http://localhost:5173)
  Mailpit (email cục bộ)          http://127.0.0.1:8025

Đăng nhập: admin / giá trị SEED_ADMIN_PASSWORD trong source/backend/.env (đổi mật khẩu ở lần đầu).
Tắt hạ tầng: pnpm services:down  ·  Xóa sạch dữ liệu: docker compose down -v`);
