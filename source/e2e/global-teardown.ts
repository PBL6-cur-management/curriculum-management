import { runBackendScript } from './global-setup.js';

// Removes the e2e world and every row the suite created, so the real data stays as the school sent it.
// Set E2E_KEEP_WORLD=1 to keep it for debugging a failed run.
export default function globalTeardown(): void {
  if (process.env.E2E_KEEP_WORLD === '1') return;
  runBackendScript('e2e:purge');
}
