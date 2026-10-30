import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { TestPostgres, TestRedis } from './containers.js';

const TEST_SESSION_SECRET = 'e2e-session-secret-long-enough-for-validation';

// Synthetic key for the initial-password file; it protects nothing real.
const TEST_CREDENTIAL_KEY = Buffer.alloc(32, 7).toString('base64');

const TEST_ATTACHMENT_MAX_MB = '50';

export function setAppEnv(postgres: TestPostgres, redis: TestRedis): void {
  process.env.DATABASE_URL = postgres.getConnectionUri();
  process.env.REDIS_HOST = redis.getHost();
  process.env.REDIS_PORT = String(redis.getPort());
  process.env.SESSION_SECRET = TEST_SESSION_SECRET;
  process.env.STUDENT_CREDENTIAL_ENCRYPTION_KEY = TEST_CREDENTIAL_KEY;
  // A developer's dotenv file may still carry an older limit; the specs assert this one.
  process.env.ATTACHMENT_MAX_MB = TEST_ATTACHMENT_MAX_MB;
  // The Redis is shared by the spec files that run in parallel: each one gets queues of its own, so its worker
  // never takes a job another file's database cannot answer.
  process.env.BULLMQ_PREFIX = `test-${randomUUID()}`;
  // Attachments land in a folder of their own per spec file, created by the app and removed when the worker exits.
  const filesRoot = path.join(tmpdir(), `ctdt-files-${randomUUID()}`);
  process.env.FILES_ROOT = filesRoot;
  process.once('exit', () =>
    rmSync(filesRoot, { recursive: true, force: true }),
  );
}
