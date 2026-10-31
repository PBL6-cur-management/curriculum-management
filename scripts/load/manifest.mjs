// F-27 BE-06. Pure, dependency-free validation of the load-test manifest and credentials (runs in Node and in k6:
// no imports, no filesystem, no process). A run that cannot prove its fixture is real fails closed.

export const FIXTURE_POLICY = Object.freeze({
  courseCount: 300,
  studentCount: 500,
  curriculumRows: 60,
  studentAccounts: 160,
  staffAccounts: 40,
  smokeStaffAccounts: 10,
  pageSize: 20,
});

export const MISSING_STUDENT_FIXTURE =
  'Thiếu dữ liệu thử tải sinh viên; chưa thể nghiệm thu F-27.';

const STAFF_ROLES = ['R1', 'R2', 'R3', 'R4', 'R5'];
const STUDENT_READS = ['curriculum', 'progress', 'eligibility'];
const STAFF_READS = ['catalog', 'curriculum'];
const READ_KINDS = { catalog: 'lookup', curriculum: 'lookup', progress: 'lookup', eligibility: 'eligibility' };
const FORBIDDEN_PATH = /^\/api\/(health|auth|docs)(\/|$|\?)|^\/api\/docs-json/;

const fail = (message) => {
  throw new Error(message);
};
const isObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// A read is a relative GET target under /api: no scheme, authority, traversal, fragment or placeholder.
export function assertReadPath(path) {
  if (typeof path !== 'string' || !path.startsWith('/api/'))
    fail(`Đường dẫn đọc phải bắt đầu bằng /api/: ${String(path)}`);
  if (
    path.startsWith('//') ||
    path.includes('://') ||
    path.includes('..') ||
    path.includes('#') ||
    /[{}<>]/.test(path) ||
    /\s/.test(path)
  )
    fail(`Đường dẫn đọc không hợp lệ: ${path}`);
  if (FORBIDDEN_PATH.test(path))
    fail(`Đường dẫn không được đưa vào tải đọc: ${path}`);
}

// JSON pointers are only ever looked up, never evaluated.
function assertPointer(pointer) {
  if (typeof pointer !== 'string' || (pointer !== '' && !pointer.startsWith('/')))
    fail(`Con trỏ JSON không hợp lệ: ${String(pointer)}`);
}

function validateRead(read, strict) {
  if (!isObject(read) || !(read.name in READ_KINDS))
    fail('Mỗi lần đọc phải có name thuộc catalog|curriculum|progress|eligibility.');
  if (read.kind !== READ_KINDS[read.name])
    fail(`Lần đọc ${read.name} phải có kind=${READ_KINDS[read.name]}.`);
  assertReadPath(read.path);
  const equals = Array.isArray(read.equals) ? read.equals : [];
  const arrays = Array.isArray(read.arrays) ? read.arrays : [];
  // Every read must assert something fixture-bound, or a fast empty 200 would count as success.
  if (equals.length + arrays.length === 0)
    fail(`Lần đọc ${read.name} chưa có điều kiện kiểm tra dữ liệu.`);
  for (const item of equals) {
    assertPointer(item?.pointer);
    if (!['string', 'number', 'boolean'].includes(typeof item.value))
      fail('equals.value phải là chuỗi, số hoặc boolean.');
  }
  for (const item of arrays) {
    assertPointer(item?.pointer);
    if (!Number.isInteger(item.minimumLength) || item.minimumLength < (strict ? 1 : 0))
      fail('arrays.minimumLength phải là số nguyên dương.');
  }
}

function validateAccounts(accounts, label, expectedCount, roles, requiredReads, strict) {
  if (!Array.isArray(accounts)) fail(`${label} phải là mảng.`);
  if (strict && accounts.length !== expectedCount)
    fail(`${label} phải có đúng ${expectedCount} tài khoản (hiện có ${accounts.length}).`);
  for (const account of accounts) {
    if (!isObject(account) || !account.fixtureKey || !account.userId)
      fail(`${label}: tài khoản thiếu fixtureKey hoặc userId.`);
    if (!roles.includes(account.roleCode))
      fail(`${label}: vai trò ${String(account.roleCode)} không hợp lệ.`);
    const reads = Array.isArray(account.reads) ? account.reads : [];
    reads.forEach((read) => validateRead(read, strict));
    const names = reads.map((read) => read.name);
    for (const need of requiredReads)
      if (!names.includes(need))
        fail(`${label}: tài khoản ${account.fixtureKey} thiếu lần đọc ${need}.`);
    // No privileged account may stand in for a student journey (and the reverse).
    for (const name of names)
      if (!requiredReads.includes(name))
        fail(`${label}: tài khoản ${account.fixtureKey} có lần đọc ${name} không thuộc hành trình.`);
  }
}

function assertDistinct(accounts, label) {
  const keys = new Set();
  const users = new Set();
  for (const account of accounts) {
    if (keys.has(account.fixtureKey)) fail(`${label}: trùng fixtureKey ${account.fixtureKey}.`);
    if (users.has(account.userId)) fail(`${label}: trùng userId ${account.userId}.`);
    keys.add(account.fixtureKey);
    users.add(account.userId);
  }
}

/**
 * @param {unknown} value
 * @param {'canonical' | 'staff-smoke'} mode
 */
export function validateManifest(value, mode) {
  if (mode !== 'canonical' && mode !== 'staff-smoke')
    fail('Chế độ phải là canonical hoặc staff-smoke.');
  if (!isObject(value) || value.schemaVersion !== 1) fail('schemaVersion phải là 1.');
  const dataset = value.dataset;
  if (
    !isObject(dataset) ||
    dataset.synthetic !== true ||
    dataset.environment !== 'isolated-load-test' ||
    !dataset.fixtureId ||
    !dataset.sourceRevision
  )
    fail('dataset phải là dữ liệu tổng hợp trong môi trường isolated-load-test.');

  const canonical = mode === 'canonical';
  const students = Array.isArray(value.students) ? value.students : [];
  if (canonical) {
    // The unbuilt student features own this fixture; an empty list is "not provisioned", not "zero students".
    if (students.length === 0) fail(MISSING_STUDENT_FIXTURE);
    if (value.contractVerified !== true)
      fail('contractVerified phải là true kèm contractSources có dẫn chứng.');
    const sources = Array.isArray(value.contractSources) ? value.contractSources : [];
    if (sources.length === 0 || sources.some((s) => !s?.name || !s?.source))
      fail('contractSources phải ghi nguồn (file:line) của từng điểm cuối.');
    if (
      dataset.courseCount !== FIXTURE_POLICY.courseCount ||
      dataset.studentCount !== FIXTURE_POLICY.studentCount ||
      dataset.curriculumRows !== FIXTURE_POLICY.curriculumRows
    )
      fail('dataset phải đúng 300 học phần, 500 sinh viên và 60 dòng khung.');
  }

  validateAccounts(students, 'students', FIXTURE_POLICY.studentAccounts, ['R6'], STUDENT_READS, canonical);
  const staff = Array.isArray(value.staff) ? value.staff : [];
  if (!canonical && staff.length < FIXTURE_POLICY.smokeStaffAccounts)
    fail(`staff-smoke cần ít nhất ${FIXTURE_POLICY.smokeStaffAccounts} tài khoản nhân sự.`);
  validateAccounts(staff, 'staff', FIXTURE_POLICY.staffAccounts, STAFF_ROLES, STAFF_READS, canonical);
  assertDistinct([...students, ...staff], 'manifest');
  return value;
}

/** @param {unknown} value @param {{ students: any[], staff: any[] }} manifest */
export function validateCredentials(value, manifest) {
  if (!Array.isArray(value)) fail('credentials phải là mảng.');
  const accounts = [...manifest.students, ...manifest.staff];
  const byKey = new Map();
  const names = new Set();
  for (const item of value) {
    if (!isObject(item) || !item.fixtureKey || !item.username || !item.password)
      fail('Mỗi thông tin đăng nhập cần fixtureKey, username, password.');
    if (byKey.has(item.fixtureKey)) fail(`Trùng fixtureKey ${item.fixtureKey}.`);
    if (names.has(item.username)) fail('Trùng tên đăng nhập.');
    byKey.set(item.fixtureKey, item);
    names.add(item.username);
  }
  for (const account of accounts)
    if (!byKey.has(account.fixtureKey))
      fail(`Thiếu thông tin đăng nhập cho ${account.fixtureKey}.`);
  if (value.length !== accounts.length) fail('Có thông tin đăng nhập thừa so với manifest.');
  return value;
}
