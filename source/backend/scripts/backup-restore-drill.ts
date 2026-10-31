import {
  backupConfigFrom,
  type BackupConfig,
} from '../src/shared/backups/backup-config.js';
import {
  DELIVERY_TIERS,
  type DeliveryTier,
} from '../src/shared/backups/backup.constants.js';
import {
  BackupFailure,
  failureOf,
} from '../src/shared/backups/backup.errors.js';
import { NativePostgresTools } from '../src/shared/backups/postgres-tools.js';
import { RestoreDrill } from '../src/shared/backups/restore-drill.js';
import { verifyDetachedBundle } from '../src/shared/backups/restore-verifier.js';
import { UpgradeVerifier } from '../src/shared/backups/upgrade-verifier.js';

// BE-06 operator CLI. Reads the process environment only here (no dotenv, no AppModule, no seed, no queues);
// every helper below receives typed config. Passwords never travel as command-line arguments.
const USAGE = `Dùng: pnpm backup:drill <lệnh> [tùy chọn]

  restore         --backup-id <daily-YYYY-MM-DD> --tier <B1..B6> --operator <tên>
  verify          --drill-id <mã>
  accept          --drill-id <mã> --operator <tên> --result <passed|failed> --note <ghi chú>
  inspect         --set-directory <thư mục bộ sao lưu đã tách>
  capture-upgrade --operator <tên>
  compare-upgrade --evidence-id <mã>

Biến môi trường (đặt trong tiến trình, không truyền mật khẩu qua tham số):
  DATABASE_URL, BACKUP_ROOT, FILES_ROOT, PG_DUMP_PATH, PG_RESTORE_PATH
  RESTORE_DRILL_DATABASE_URL, RESTORE_DRILL_FILES_ROOT   (restore, verify; không có giá trị mặc định)

restore chỉ ghi vào cơ sở dữ liệu diễn tập trống và thư mục tệp mới; không bao giờ ghi vào cơ sở dữ liệu thật.`;

export type Command =
  | 'restore'
  | 'verify'
  | 'accept'
  | 'inspect'
  | 'capture-upgrade'
  | 'compare-upgrade';

const COMMANDS: readonly Command[] = [
  'restore',
  'verify',
  'accept',
  'inspect',
  'capture-upgrade',
  'compare-upgrade',
];

export interface Parsed {
  command: Command | 'help';
  options: Record<string, string>;
}

// Strict: every option is `--name value`; an unknown shape is an error, never silently ignored.
export function parseArgs(argv: readonly string[]): Parsed {
  const [first, ...rest] = argv;
  if (!first || first === '--help' || first === 'help' || first === '-h')
    return { command: 'help', options: {} };
  if (!COMMANDS.includes(first as Command))
    throw new Error(`Lệnh không hợp lệ: ${first}`);
  const options: Record<string, string> = {};
  if (rest.includes('--help')) return { command: 'help', options };
  for (let index = 0; index < rest.length; index += 2) {
    const name = rest[index];
    const value = rest[index + 1];
    if (
      !name?.startsWith('--') ||
      value === undefined ||
      value.startsWith('--')
    )
      throw new Error(`Tùy chọn không hợp lệ gần: ${name ?? ''}`);
    const key = name.slice(2);
    if (key in options) throw new Error(`Tùy chọn lặp lại: ${name}`);
    options[key] = value;
  }
  return { command: first as Command, options };
}

export function required(
  options: Record<string, string>,
  name: string,
): string {
  const value = options[name]?.trim();
  if (!value) throw new Error(`Thiếu tùy chọn --${name}`);
  return value;
}

export function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Thiếu biến môi trường ${name}`);
  return value;
}

export function configFrom(env: NodeJS.ProcessEnv): BackupConfig {
  return backupConfigFrom({
    BACKUP_ENABLED: 'true',
    BACKUP_ROOT: requiredEnv(env, 'BACKUP_ROOT'),
    FILES_ROOT: requiredEnv(env, 'FILES_ROOT'),
    DATABASE_URL: requiredEnv(env, 'DATABASE_URL'),
    PG_DUMP_PATH: env.PG_DUMP_PATH?.trim() || 'pg_dump',
    PG_RESTORE_PATH: env.PG_RESTORE_PATH?.trim() || 'pg_restore',
  });
}

export function parseTier(value: string): DeliveryTier {
  if (!DELIVERY_TIERS.includes(value as DeliveryTier))
    throw new Error(`Bậc triển khai không hợp lệ: ${value}`);
  return value as DeliveryTier;
}

export function parseResult(value: string): boolean {
  if (value !== 'passed' && value !== 'failed')
    throw new Error('--result phải là passed hoặc failed');
  return value === 'passed';
}

export async function run(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
  signal: AbortSignal,
  print: (value: unknown) => void,
): Promise<number> {
  const { command, options } = parseArgs(argv);
  if (command === 'help') {
    print(USAGE);
    return 0;
  }
  // `inspect` needs no database, Redis, application secret or PostgreSQL executable: the offline preflight.
  if (command === 'inspect') {
    const manifest = await verifyDetachedBundle(
      required(options, 'set-directory'),
      signal,
    );
    print({ backupId: manifest.backupId, valid: true });
    return 0;
  }

  const config = configFrom(env);
  if (command === 'capture-upgrade') {
    print(
      await new UpgradeVerifier(config).capture(
        required(options, 'operator'),
        signal,
      ),
    );
    return 0;
  }
  if (command === 'compare-upgrade') {
    const record = await new UpgradeVerifier(config).compare(
      required(options, 'evidence-id'),
      signal,
    );
    print(record);
    return record.state === 'PASSED' ? 0 : 1;
  }

  const drill = new RestoreDrill(
    config,
    new NativePostgresTools(config.pgDumpPath, config.pgRestorePath),
  );
  if (command === 'restore') {
    const record = await drill.restore(
      {
        backupId: required(options, 'backup-id'),
        tier: parseTier(required(options, 'tier')),
        operator: required(options, 'operator'),
        targetDatabaseUrl: requiredEnv(env, 'RESTORE_DRILL_DATABASE_URL'),
        targetFilesRoot: requiredEnv(env, 'RESTORE_DRILL_FILES_ROOT'),
      },
      signal,
    );
    print(record);
    return record.status === 'RESTORED' ? 0 : 1;
  }
  if (command === 'verify') {
    const checks = await drill.verify(
      required(options, 'drill-id'),
      requiredEnv(env, 'RESTORE_DRILL_DATABASE_URL'),
      signal,
    );
    print(checks);
    return checks.every((item) => item.passed) ? 0 : 1;
  }
  // accept
  print(
    await drill.accept({
      drillId: required(options, 'drill-id'),
      operator: required(options, 'operator'),
      passed: parseResult(required(options, 'result')),
      note: required(options, 'note'),
    }),
  );
  return 0;
}

// Only the real entry point touches process; the spec imports `run` and never starts this.
const isEntry = process.argv[1]
  ?.replace(/\\/g, '/')
  .endsWith('scripts/backup-restore-drill.ts');
if (isEntry) {
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  process.once('SIGTERM', () => controller.abort());
  run(process.argv.slice(2), process.env, controller.signal, (value) =>
    console.log(
      typeof value === 'string' ? value : JSON.stringify(value, null, 2),
    ),
  )
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      // Operator-facing text only: a known failure prints its Vietnamese message, anything else its message.
      const known = error instanceof BackupFailure ? failureOf(error) : null;
      console.error(
        known ? `${known.code}: ${known.message}` : (error as Error).message,
      );
      process.exitCode = 2;
    });
}
