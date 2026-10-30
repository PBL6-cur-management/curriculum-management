import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Writes the e2e world (`e2e.*` accounts, `E2E-*` groups, world courses and programs) into the backend's
// database before the run. The backend's .env decides which database that is.
const backend = fileURLToPath(new URL('../backend', import.meta.url));

export function runBackendScript(script: 'e2e:world' | 'e2e:purge'): void {
  execFileSync('pnpm', [script], {
    cwd: backend,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env },
  });
}

export default function globalSetup(): void {
  runBackendScript('e2e:world');
}
