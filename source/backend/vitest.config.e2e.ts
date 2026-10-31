import { defineConfig } from 'vitest/config';

// Generous for a cold Nest boot plus template copy on a busy laptop; no container start any more.
const E2E_TIMEOUT_MS = 120_000;
// Each worker boots its own Nest app: two at a time keeps memory low. E2E_WORKERS raises it on a bigger machine.
const E2E_WORKERS = Number(process.env.E2E_WORKERS ?? 2);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    testTimeout: E2E_TIMEOUT_MS,
    hookTimeout: E2E_TIMEOUT_MS,
    maxWorkers: E2E_WORKERS,
  },
});
