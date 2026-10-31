// F-27 BE-07. k6 entry point: read-only journeys for 160 student and 40 staff sessions over 15 minutes.
// Run through scripts/load/Invoke-LoadTest.ps1 (it runs preflight.mjs first). Never run it against production data.
//
// Required environment: BASE_URL (https), PROFILE (canonical|staff-smoke), MANIFEST_PATH, CREDENTIALS_PATH.
import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import { Counter, Rate, Trend } from 'k6/metrics';
import { validateManifest, validateCredentials } from './manifest.mjs';
import {
  LOAD_POLICY,
  accountIndex,
  buildOptions,
  cohortOf,
  evaluateRead,
  selectAccounts,
} from './workload.mjs';

const PROFILE = __ENV.PROFILE || 'canonical';
const BASE_URL = (__ENV.BASE_URL || '').replace(/\/$/, '');
if (!BASE_URL.startsWith('https://')) throw new Error('BASE_URL phải là HTTPS.');

// Files are read once in the init context; the files are never logged.
const manifest = validateManifest(JSON.parse(open(__ENV.MANIFEST_PATH)), PROFILE);
const credentials = validateCredentials(JSON.parse(open(__ENV.CREDENTIALS_PATH)), manifest);
const accounts = selectAccounts(manifest, PROFILE);
const credentialByKey = new Map(credentials.map((item) => [item.fixtureKey, item]));

export const options = buildOptions(PROFILE);

const readDuration = new Trend('read_duration', true);
const readErrors = new Rate('read_errors');
const participating = new Counter('participating_vus');
const domainWrites = new Counter('domain_write_requests');
const seen = new Set();

export function readJourney() {
  const account = accounts[accountIndex(exec.vu.idInTest, accounts.length)];
  const credential = credentialByKey.get(account.fixtureKey);
  const cohort = cohortOf(account);

  // Each VU logs in once (its jar keeps the session cookie) and then only issues GET reads.
  if (!seen.has(exec.vu.idInTest)) {
    const login = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ username: credential.username, password: credential.password }),
      { headers: { 'Content-Type': 'application/json' }, tags: { phase: 'login' } },
    );
    if (!check(login, { 'đăng nhập 200': (r) => r.status === 200 })) {
      readErrors.add(true);
      sleep(LOAD_POLICY.thinkSeconds);
      return;
    }
    seen.add(exec.vu.idInTest);
    participating.add(1, { cohort });
  }

  for (const read of account.reads) {
    const response = http.get(`${BASE_URL}${read.path}`, {
      tags: { phase: 'read', kind: read.kind, read: read.name },
    });
    readDuration.add(response.timings.duration, { kind: read.kind });
    let ok = response.status === 200;
    if (ok) {
      try {
        ok = evaluateRead(response.json(), read);
      } catch {
        ok = false;
      }
    }
    check(response, { [`${read.name} đúng dữ liệu`]: () => ok });
    readErrors.add(!ok);
    sleep(LOAD_POLICY.thinkSeconds);
  }
}
