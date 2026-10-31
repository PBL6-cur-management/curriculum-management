import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { BACKUP_POLICY } from './backup.constants.js';
import { BACKUP_ERRORS, BackupFailure } from './backup.errors.js';

export interface ToolResult {
  exitCode: number;
  durationMs: number;
}

// The native tools behind one seam: production runs the configured executables; a test may run the same
// PostgreSQL 18 tools another way (BE-08 when the host has an older client).
export interface PostgresTools {
  clientMajor(signal: AbortSignal): Promise<number>;
  dump(
    output: string,
    snapshotId: string,
    sourceUrl: string,
    signal: AbortSignal,
  ): Promise<ToolResult>;
  inspect(dump: string, signal: AbortSignal): Promise<ToolResult>;
  restore(
    dump: string,
    targetUrl: string,
    signal: AbortSignal,
  ): Promise<ToolResult>;
}

// libpq reads these; a password never reaches argv or a log line.
const SUPPORTED_URL_OPTIONS = new Set([
  'sslmode',
  'sslrootcert',
  'sslcert',
  'sslkey',
  'schema',
  'connect_timeout',
  'connection_limit',
  'pool_timeout',
]);
const LIBPQ_OPTIONS: Record<string, string> = {
  sslmode: 'PGSSLMODE',
  sslrootcert: 'PGSSLROOTCERT',
  sslcert: 'PGSSLCERT',
  sslkey: 'PGSSLKEY',
  connect_timeout: 'PGCONNECT_TIMEOUT',
};
// What a child process needs from the parent to start at all; never the parent's secrets.
const PASSTHROUGH = [
  'PATH',
  'Path',
  'SystemRoot',
  'SYSTEMROOT',
  'TEMP',
  'TMP',
  'HOME',
  'USERPROFILE',
  'LANG',
];

export function databaseNameOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
}

export function libpqEnv(url: string): NodeJS.ProcessEnv {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BackupFailure(BACKUP_ERRORS.DATABASE_OPTIONS_UNSUPPORTED);
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
    throw new BackupFailure(BACKUP_ERRORS.DATABASE_OPTIONS_UNSUPPORTED);
  }
  const env: NodeJS.ProcessEnv = {};
  for (const key of PASSTHROUGH) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  env.PGHOST = parsed.hostname.replace(/^\[|\]$/g, '');
  env.PGPORT = parsed.port || '5432';
  env.PGDATABASE = databaseNameOf(url);
  env.PGUSER = decodeURIComponent(parsed.username);
  if (parsed.password) env.PGPASSWORD = decodeURIComponent(parsed.password);
  for (const [key, value] of parsed.searchParams) {
    if (!SUPPORTED_URL_OPTIONS.has(key)) {
      throw new BackupFailure(BACKUP_ERRORS.DATABASE_OPTIONS_UNSUPPORTED);
    }
    // Prisma's schema selector is fine only when it names the default schema the dump covers.
    if (key === 'schema' && value !== 'public') {
      throw new BackupFailure(BACKUP_ERRORS.DATABASE_OPTIONS_UNSUPPORTED);
    }
    if (LIBPQ_OPTIONS[key]) env[LIBPQ_OPTIONS[key]] = value;
  }
  return env;
}

export interface RunOptions {
  executable: string;
  args: readonly string[];
  env: NodeJS.ProcessEnv;
  signal: AbortSignal;
  onStdout?: (chunk: Buffer) => void;
}

// No shell, bounded diagnostics, abort kills the child and still waits for it to close.
export function runTool(options: RunOptions): Promise<ToolResult> {
  const started = performance.now();
  return new Promise((resolve, reject) => {
    if (options.signal.aborted) {
      reject(abortError());
      return;
    }
    const child = spawn(options.executable, [...options.args], {
      shell: false,
      windowsHide: true,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderrBytes = 0;
    child.stdout.on('data', (chunk: Buffer) => options.onStdout?.(chunk));
    // Drained, never kept beyond the cap and never logged: it may name hosts or rows.
    child.stderr.on('data', (chunk: Buffer) => {
      stderrBytes = Math.min(
        BACKUP_POLICY.STDERR_MAX_BYTES,
        stderrBytes + chunk.length,
      );
    });
    let killTimer: NodeJS.Timeout | undefined;
    const onAbort = () => {
      child.kill('SIGTERM');
      killTimer = setTimeout(
        () => child.kill('SIGKILL'),
        BACKUP_POLICY.CHILD_TERMINATION_GRACE_MS,
      );
    };
    options.signal.addEventListener('abort', onAbort, { once: true });
    child.once('error', (error: NodeJS.ErrnoException) => {
      options.signal.removeEventListener('abort', onAbort);
      clearTimeout(killTimer);
      reject(
        error.code === 'ENOENT' || error.code === 'EACCES'
          ? new BackupFailure(BACKUP_ERRORS.TOOL_UNAVAILABLE)
          : error,
      );
    });
    child.once('close', (code) => {
      options.signal.removeEventListener('abort', onAbort);
      clearTimeout(killTimer);
      if (options.signal.aborted) {
        reject(abortError());
        return;
      }
      resolve({
        exitCode: code ?? -1,
        durationMs: Math.round(performance.now() - started),
      });
    });
  });
}

function abortError(): Error {
  const error = new Error('aborted');
  error.name = 'AbortError';
  return error;
}

export class NativePostgresTools implements PostgresTools {
  constructor(
    private readonly dumpPath: string,
    private readonly restorePath: string,
  ) {}

  async clientMajor(signal: AbortSignal): Promise<number> {
    const majors = await Promise.all(
      [this.dumpPath, this.restorePath].map(async (executable) => {
        let out = '';
        const result = await runTool({
          executable,
          args: ['--version'],
          env: libpqEnv('postgres://localhost/postgres'),
          signal,
          onStdout: (chunk) => {
            out += chunk.toString('utf8');
          },
        });
        const match = /\s(\d+)(\.\d+)?/.exec(out);
        if (result.exitCode !== 0 || !match) {
          throw new BackupFailure(BACKUP_ERRORS.TOOL_UNAVAILABLE);
        }
        return Number(match[1]);
      }),
    );
    if (majors[0] !== majors[1]) {
      throw new BackupFailure(BACKUP_ERRORS.TOOL_VERSION_MISMATCH);
    }
    return majors[0];
  }

  async dump(
    output: string,
    snapshotId: string,
    sourceUrl: string,
    signal: AbortSignal,
  ): Promise<ToolResult> {
    const result = await runTool({
      executable: this.dumpPath,
      args: [
        '--format=custom',
        '--no-owner',
        '--no-acl',
        '--no-password',
        `--snapshot=${snapshotId}`,
        `--file=${output}`,
      ],
      env: libpqEnv(sourceUrl),
      signal,
    });
    await assertProduced(result, output);
    return result;
  }

  inspect(dump: string, signal: AbortSignal): Promise<ToolResult> {
    return runTool({
      executable: this.restorePath,
      args: ['--list', dump],
      env: libpqEnv('postgres://localhost/postgres'),
      signal,
    });
  }

  restore(
    dump: string,
    targetUrl: string,
    signal: AbortSignal,
  ): Promise<ToolResult> {
    return runTool({
      executable: this.restorePath,
      args: [
        '--exit-on-error',
        '--single-transaction',
        '--no-owner',
        '--no-acl',
        '--no-password',
        '--dbname',
        databaseNameOf(targetUrl),
        dump,
      ],
      env: libpqEnv(targetUrl),
      signal,
    });
  }
}

async function assertProduced(result: ToolResult, output: string) {
  const produced = await stat(output).catch(() => null);
  if (result.exitCode !== 0 || !produced || produced.size === 0) {
    throw new BackupFailure(BACKUP_ERRORS.DUMP_FAILED, true);
  }
}
