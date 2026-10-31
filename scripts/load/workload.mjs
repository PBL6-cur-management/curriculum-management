// F-27 BE-07. Pure workload policy shared by the k6 entry point and its tests. No Node or k6 imports.

export const LOAD_POLICY = Object.freeze({
  studentVus: 160,
  staffVus: 40,
  duration: '15m',
  setupTimeout: '10m',
  thinkSeconds: 1,
  lookupLimitMs: 2000,
  eligibilityLimitMs: 3000,
  smokeVus: 10,
  smokeDuration: '30s',
});

export const PROFILES = ['canonical', 'staff-smoke'];

/** The smoke profile is a labelled branch, never a substitute for the canonical result. */
export function resultLabel(profile) {
  return profile === 'canonical' ? 'CANONICAL' : 'SMOKE_ONLY';
}

/** Deterministic account selection: canonical = 160 students then 40 staff; smoke = first 10 staff. */
export function selectAccounts(manifest, profile) {
  if (profile === 'canonical') return manifest.students.concat(manifest.staff);
  if (profile === 'staff-smoke') return manifest.staff.slice(0, LOAD_POLICY.smokeVus);
  throw new Error('Profile phải là canonical hoặc staff-smoke.');
}

export function cohortOf(account) {
  return account.roleCode === 'R6' ? 'student' : 'staff';
}

/** k6 options built from the policy, so the numbers live in one place. */
export function buildOptions(profile) {
  const canonical = profile === 'canonical';
  const options = {
    scenarios: {
      reads: {
        executor: 'constant-vus',
        vus: canonical ? LOAD_POLICY.studentVus + LOAD_POLICY.staffVus : LOAD_POLICY.smokeVus,
        duration: canonical ? LOAD_POLICY.duration : LOAD_POLICY.smokeDuration,
        gracefulStop: '0s',
        exec: 'readJourney',
      },
    },
    setupTimeout: LOAD_POLICY.setupTimeout,
    noCookiesReset: true,
    maxRedirects: 0,
    thresholds: {
      'read_duration{kind:lookup}': [`max<${LOAD_POLICY.lookupLimitMs}`],
      'http_req_failed{phase:read}': ['rate==0'],
      read_errors: ['rate==0'],
      checks: ['rate==1'],
      domain_write_requests: ['count==0'],
    },
  };
  if (canonical) {
    options.thresholds['read_duration{kind:eligibility}'] = [`max<${LOAD_POLICY.eligibilityLimitMs}`];
    options.thresholds['participating_vus{cohort:student}'] = [`count==${LOAD_POLICY.studentVus}`];
    options.thresholds['participating_vus{cohort:staff}'] = [`count==${LOAD_POLICY.staffVus}`];
  }
  return options;
}

/** Resolve an RFC 6901 pointer. Lookup only, never evaluated. */
export function resolvePointer(body, pointer) {
  if (pointer === '') return body;
  let current = body;
  for (const raw of pointer.slice(1).split('/')) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (current === null || typeof current !== 'object' || !(key in current)) return undefined;
    current = current[key];
  }
  return current;
}

/** A read only succeeds when its fixture-bound assertions hold: a fast empty 200 is a failure. */
export function evaluateRead(body, read) {
  for (const { pointer, value } of read.equals ?? [])
    if (resolvePointer(body, pointer) !== value) return false;
  for (const { pointer, minimumLength } of read.arrays ?? []) {
    const found = resolvePointer(body, pointer);
    if (!Array.isArray(found) || found.length < minimumLength) return false;
  }
  return true;
}

/** Index of the VU's account: k6 numbers VUs from 1, and a single generator is required. */
export function accountIndex(vuIdInTest, accountCount) {
  const index = vuIdInTest - 1;
  if (!Number.isInteger(index) || index < 0 || index >= accountCount)
    throw new Error('VU ngoài phạm vi tài khoản; cần một máy tạo tải duy nhất.');
  return index;
}
