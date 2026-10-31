import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MISSING_STUDENT_FIXTURE,
  assertReadPath,
  validateCredentials,
  validateManifest,
} from './manifest.mjs';
import {
  accountIndex,
  buildOptions,
  evaluateRead,
  resolvePointer,
  resultLabel,
  selectAccounts,
} from './workload.mjs';

const read = (name, path, kind = 'lookup') => ({
  name,
  kind,
  path,
  arrays: [{ pointer: '/items', minimumLength: 1 }],
});
const staff = (i) => ({
  fixtureKey: `staff-${i}`,
  userId: `u-staff-${i}`,
  roleCode: 'R1',
  reads: [read('catalog', '/api/courses?limit=20'), read('curriculum', '/api/programs?limit=20')],
});
const dataset = {
  synthetic: true,
  environment: 'isolated-load-test',
  fixtureId: 'fx',
  sourceRevision: 'abc',
};
const smoke = () => ({
  schemaVersion: 1,
  dataset,
  students: [],
  staff: Array.from({ length: 10 }, (_, i) => staff(i)),
});

test('staff-smoke accepts 10 staff and no students, and is labelled smoke-only', () => {
  validateManifest(smoke(), 'staff-smoke');
  assert.equal(resultLabel('staff-smoke'), 'SMOKE_ONLY');
});

test('canonical without students fails with the missing-fixture message', () => {
  assert.throws(() => validateManifest(smoke(), 'canonical'), new RegExp(MISSING_STUDENT_FIXTURE));
});

test('a read with no fixture-bound assertion is rejected', () => {
  const manifest = smoke();
  manifest.staff[0].reads[0] = { name: 'catalog', kind: 'lookup', path: '/api/courses' };
  assert.throws(() => validateManifest(manifest, 'staff-smoke'), /điều kiện kiểm tra/);
});

test('non-synthetic datasets are rejected', () => {
  const manifest = smoke();
  manifest.dataset.synthetic = false;
  assert.throws(() => validateManifest(manifest, 'staff-smoke'), /tổng hợp/);
});

test('read paths cannot escape /api or hit auth, health or docs', () => {
  for (const bad of ['http://x/api/a', '//evil/api/a', '/api/../x', '/api/health', '/api/auth/me', '/api/docs', '/x'])
    assert.throws(() => assertReadPath(bad), undefined, bad);
  assertReadPath('/api/courses?limit=20');
});

test('credentials must match the manifest one to one', () => {
  const manifest = smoke();
  const credentials = manifest.staff.map((a) => ({
    fixtureKey: a.fixtureKey,
    username: `n-${a.fixtureKey}`,
    password: 'x',
  }));
  validateCredentials(credentials, manifest);
  assert.throws(() => validateCredentials(credentials.slice(1), manifest), /Thiếu/);
  assert.throws(
    () => validateCredentials([...credentials, { fixtureKey: 'z', username: 'z', password: 'x' }], manifest),
    /thừa/,
  );
});

test('smoke selects the first 10 staff; canonical profile has 200 VUs', () => {
  assert.equal(selectAccounts(smoke(), 'staff-smoke').length, 10);
  assert.equal(buildOptions('canonical').scenarios.reads.vus, 200);
  assert.equal(buildOptions('staff-smoke').scenarios.reads.vus, 10);
  assert.ok(buildOptions('canonical').thresholds['read_duration{kind:eligibility}']);
});

test('pointer lookup and read evaluation', () => {
  const body = { items: [1], meta: { total: 3 } };
  assert.equal(resolvePointer(body, '/meta/total'), 3);
  assert.equal(resolvePointer(body, '/nope/x'), undefined);
  assert.equal(evaluateRead(body, { arrays: [{ pointer: '/items', minimumLength: 1 }] }), true);
  assert.equal(evaluateRead({ items: [] }, { arrays: [{ pointer: '/items', minimumLength: 1 }] }), false);
  assert.equal(evaluateRead(body, { equals: [{ pointer: '/meta/total', value: 4 }] }), false);
});

test('VU index outside the accounts fails closed', () => {
  assert.equal(accountIndex(1, 10), 0);
  assert.throws(() => accountIndex(11, 10), /máy tạo tải/);
  assert.throws(() => accountIndex(0, 10));
});
