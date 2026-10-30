import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { seedAccessControl } from '../prisma/seed-data/seed-access-control.js';
import { configureApp } from '../src/app.setup.js';
import { SyncFailure } from '../src/features/school-db-sync/school-sync.errors.js';
import { SchoolSyncRunner } from '../src/features/school-db-sync/school-sync.runner.js';
import {
  SchoolSourceReader,
  type ProbeOutcome,
  type SchoolSnapshot,
} from '../src/features/school-db-sync/school-source.reader.js';
import type { SyncRunDto } from '../src/features/school-db-sync/dto/school-sync-response.dto.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import {
  startPostgres,
  startRedis,
  type TestPostgres,
  type TestRedis,
} from './containers.js';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import { createStudentWorld, type StudentWorld } from './fixtures/students.js';
import { setAppEnv } from './test-env.js';

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };
const BASE = '/api/school-db-sync';
type Agent = ReturnType<typeof request.agent>;

// Stands in for the school's SQL Server: each test sets what the next probe and read return.
class FakeSchool extends SchoolSourceReader {
  probeOutcome: ProbeOutcome = 'CONNECTED';
  snapshot: SchoolSnapshot = { version: 'v0', students: [], results: [], classes: [] };
  readError: SyncFailure | null = null;
  gate: Promise<void> | null = null;
  reads = 0;

  async probe(): Promise<ProbeOutcome> {
    return this.probeOutcome;
  }

  async read(): Promise<SchoolSnapshot> {
    this.reads++;
    if (this.gate) await this.gate;
    if (this.readError) throw this.readError;
    return structuredClone(this.snapshot);
  }
}

describe('School database synchronization (F-22)', () => {
  let postgres: TestPostgres;
  let redis: TestRedis;
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let office: Agent;
  let officeId: string;
  let lecturer: Agent;
  let world: StudentWorld;
  let courseStamp: Date;
  const school = new FakeSchool();

  beforeAll(async () => {
    [postgres, redis] = await Promise.all([
      startPostgres({ vietnameseCollation: true }),
      startRedis(),
    ]);
    setAppEnv(postgres, redis);
    process.env.SCHOOL_SYNC_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SchoolSourceReader)
      .useValue(school)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await seedAccessControl(prisma);
    const account = await createAccount(app, 'syncoffice', 'R1');
    officeId = account.id;
    office = await loginAgent(app, account);
    lecturer = await loginAgent(app, await createAccount(app, 'synclect', 'R5'));
    world = await createStudentWorld(app, office, 'SYN');
    courseStamp = (await prisma.course.findUniqueOrThrow({ where: { id: world.courseId } })).updatedAt;
  });

  afterAll(async () => {
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
  });

  const student = (code: string, name = `Sinh viên ${code}`) => ({
    sourceId: `S-${code}`,
    studentCode: code,
    fullName: name,
    cohortCode: world.cohortCode,
    major: 'M01',
    programCode: world.programCode,
    admissionSemesterCode: world.admissionSemesterCode,
    statusSemesterCode: world.admissionSemesterCode,
    status: 'STUDYING',
  });
  const result = (code: string, score10 = '8.50', courseCode = world.courseCode) => ({
    sourceId: `R-${code}-${courseCode}`,
    studentCode: code,
    courseCode,
    semesterCode: world.admissionSemesterCode,
    score10,
    score4: '3.50',
    letterGrade: 'B+',
    status: 'PASSED',
  });

  async function configuration() {
    return (await office.get(`${BASE}/configuration`).expect(200)).body;
  }

  async function saveSchoolDb(overrides: Record<string, unknown> = {}, status = 200) {
    const current = await configuration();
    return office
      .put(`${BASE}/configuration`)
      .set(CSRF)
      .send({
        revision: current.revision,
        mode: 'SCHOOL_DB',
        profile: 'SIMULATED_SQL_SERVER',
        enabled: false,
        sourceIdentity: 'SYNTHETIC-SCHOOL-V1',
        host: 'localhost',
        port: 14330,
        database: 'CMS_SYNC_SIM',
        username: 'cms_sync_reader',
        password: 'synthetic-only-1',
        cadence: 'DAILY',
        localTime: '02:00',
        weekday: null,
        ...overrides,
      })
      .expect(status);
  }

  async function verify() {
    const current = await configuration();
    return office
      .post(`${BASE}/connection-test`)
      .set(CSRF)
      .send({ configurationRevision: current.revision })
      .expect(200);
  }

  async function settle(runId: string): Promise<SyncRunDto> {
    for (let attempt = 0; attempt < 200; attempt++) {
      const run = (await office.get(`${BASE}/runs/${runId}`).expect(200)).body as SyncRunDto;
      if (run.status !== 'RUNNING') return run;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Run ${runId} did not finish`);
  }

  function startRun(requestId = randomUUID()) {
    return office.post(`${BASE}/runs`).set(CSRF).send({ requestId });
  }

  it('is closed to everyone except the Academic Office', async () => {
    await lecturer.get(`${BASE}/configuration`).expect(403);
    await lecturer.post(`${BASE}/runs`).set(CSRF).send({ requestId: randomUUID() }).expect(403);
  });

  it('starts Excel-only and refuses to run without a verified school connection (US-102 AC4)', async () => {
    const config = await configuration();
    expect(config).toMatchObject({
      mode: 'EXCEL_ONLY',
      enabled: false,
      passwordConfigured: false,
      nextRunAt: null,
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    const refused = await startRun().expect(409);
    expect(refused.body.code).toBe('SCHOOL_SYNC_NOT_READY');
  });

  it('keeps the password write-only and allows only the local simulator host (US-102 AC2)', async () => {
    const remote = await saveSchoolDb({ host: 'school.example.edu' }, 400);
    expect(remote.body.code).toBe('SCHOOL_SYNC_HOST_NOT_ALLOWED');

    const saved = await saveSchoolDb();
    expect(saved.body.passwordConfigured).toBe(true);
    expect(JSON.stringify(saved.body)).not.toContain('synthetic-only-1');
    expect(saved.body.verifiedConnectionRevision).toBeNull();
    const stored = await prisma.schoolSyncConfiguration.findFirstOrThrow();
    expect(Buffer.from(stored.passwordCiphertext!).toString('utf8')).not.toContain('synthetic-only-1');

    // Saving again without a password keeps the stored one.
    const kept = await saveSchoolDb({ password: undefined });
    expect(kept.body.passwordConfigured).toBe(true);
  });

  it('marks the saved connection verified only on a successful read-only probe (US-102 AC1)', async () => {
    school.probeOutcome = 'READ_ONLY_REQUIRED';
    const writable = await verify();
    expect(writable.body).toMatchObject({ success: false, code: 'READ_ONLY_REQUIRED' });
    expect((await configuration()).verifiedConnectionRevision).toBeNull();

    school.probeOutcome = 'CONNECTED';
    const ok = await verify();
    expect(ok.body).toMatchObject({ success: true, code: 'CONNECTED' });
    const config = await configuration();
    expect(config.verifiedConnectionRevision).toBe(config.connectionRevision);
  });

  it('shows the next run in school time once the schedule is on (US-102 AC3)', async () => {
    const saved = await saveSchoolDb({ enabled: true, cadence: 'WEEKLY', localTime: '03:30', weekday: 1, password: undefined });
    expect(saved.body.nextRunAt).not.toBeNull();
    const next = new Date(saved.body.nextRunAt);
    // 03:30 in Vietnam is 20:30 UTC on the previous day (a Sunday).
    expect(next.getUTCHours()).toBe(20);
    expect(next.getUTCMinutes()).toBe(30);
    expect(next.getUTCDay()).toBe(0);
    // The schedule did not touch the connection, so it stays verified.
    expect(saved.body.verifiedConnectionRevision).toBe(saved.body.connectionRevision);
    await saveSchoolDb({ enabled: false, password: undefined });
  });

  it('pulls students, results and classes as official data in one run (US-103 AC1)', async () => {
    school.snapshot = {
      version: 'v1',
      students: [student('SYN00001'), student('SYN00002')],
      results: [result('SYN00001'), result('SYN00002', '6.00')],
      classes: [{ sourceId: 'C-1', classCode: `${world.courseCode}.01`, courseCode: world.courseCode, semesterCode: world.admissionSemesterCode }],
    };
    const accepted = await startRun().expect(202);
    expect(accepted.body.status).toBe('RUNNING');
    const run = await settle(accepted.body.id);
    expect(run).toMatchObject({
      status: 'SUCCEEDED',
      studentCount: 2,
      resultCount: 2,
      classCount: 1,
      recordCount: 5,
      conflictCount: 0,
      snapshotVersion: 'v1',
    });
    const students = await prisma.student.findMany({
      where: { studentCode: { in: ['SYN00001', 'SYN00002'] } },
      select: { dataSource: true, userId: true },
    });
    expect(students).toHaveLength(2);
    // Official profiles, and no login is invented for them (D15).
    expect(students.every((row) => row.dataSource === 'SCHOOL_DB' && row.userId === null)).toBe(true);
    expect(await prisma.academicResult.count({ where: { dataSource: 'SCHOOL_DB' } })).toBe(2);
    expect(await prisma.schoolClassMirror.count()).toBe(1);

    // The same snapshot again changes nothing.
    const again = await settle((await startRun().expect(202)).body.id);
    expect(again).toMatchObject({ status: 'SUCCEEDED', changedCount: 0, conflictCount: 0 });
  });

  it('lets the school win over Excel and keeps both values (US-104 AC1)', async () => {
    const created = await prisma.student.findUniqueOrThrow({ where: { studentCode: 'SYN00001' }, select: { cohortId: true, admissionSemesterId: true } });
    await prisma.student.create({
      data: {
        studentCode: 'SYN00003',
        fullName: 'Tên nhập từ Excel',
        cohortId: created.cohortId,
        major: 'M01',
        admissionSemesterId: created.admissionSemesterId,
        statusSemesterId: created.admissionSemesterId,
        dataSource: 'EXCEL',
      },
    });
    school.snapshot = {
      ...school.snapshot,
      version: 'v2',
      students: [...school.snapshot.students, student('SYN00003', 'Tên chính thức')],
    };
    const run = await settle((await startRun().expect(202)).body.id);
    expect(run).toMatchObject({ status: 'SUCCEEDED', conflictCount: 1 });
    const conflicts = await office.get(`${BASE}/runs/${run.id}/conflicts`).expect(200);
    expect(conflicts.body.items).toEqual([
      expect.objectContaining({
        entityType: 'STUDENT',
        recordKey: 'SYN00003',
        previousSource: 'EXCEL',
        selectedSource: 'SCHOOL_DB',
        fields: ['fullName'],
        before: [{ field: 'fullName', value: 'Tên nhập từ Excel' }],
        after: [{ field: 'fullName', value: 'Tên chính thức' }],
      }),
    ]);
    const stored = await prisma.student.findUniqueOrThrow({ where: { studentCode: 'SYN00003' } });
    expect(stored).toMatchObject({ fullName: 'Tên chính thức', dataSource: 'SCHOOL_DB' });
  });

  it('writes nothing when one row is invalid and tells the office (US-103 AC2, AC5)', async () => {
    const before = await Promise.all([prisma.student.count(), prisma.academicResult.count()]);
    school.snapshot = {
      version: 'v3',
      students: [student('SYN00004')],
      results: [result('SYN00004', '7.00', 'NO-SUCH-COURSE')],
      classes: [],
    };
    const run = await settle((await startRun().expect(202)).body.id);
    expect(run).toMatchObject({ status: 'FAILED', errorCode: 'SOURCE_DATA_INVALID', recordCount: 0, changedCount: 0 });
    expect(run.errorMessage).toContain('dòng 1');
    // The student row was valid, but nothing of the run survived.
    expect(await Promise.all([prisma.student.count(), prisma.academicResult.count()])).toEqual(before);
    const notice = await prisma.notification.findFirst({
      where: { recipientId: officeId, notificationType: 'SCHOOL_SYNC_FAILED' },
    });
    expect(notice?.changeRequestId).toBeNull();
  });

  it('fails cleanly on a lost connection, then a retry creates a linked run (US-103 AC2, AC4)', async () => {
    school.readError = new SyncFailure('CONNECTION_FAILED');
    const failed = await settle((await startRun().expect(202)).body.id);
    expect(failed).toMatchObject({ status: 'FAILED', errorCode: 'CONNECTION_FAILED', canRetry: true });

    school.readError = null;
    school.snapshot = { version: 'v4', students: [student('SYN00005')], results: [], classes: [] };
    const retry = await office.post(`${BASE}/runs/${failed.id}/retry`).set(CSRF).send({ requestId: randomUUID() }).expect(202);
    expect(retry.body).toMatchObject({ trigger: 'RETRY', retryOfId: failed.id });
    expect(await settle(retry.body.id)).toMatchObject({ status: 'SUCCEEDED', studentCount: 1 });
    // The failed log itself is never reused.
    expect((await office.get(`${BASE}/runs/${failed.id}`).expect(200)).body.status).toBe('FAILED');

    const succeeded = await office.post(`${BASE}/runs/${retry.body.id}/retry`).set(CSRF).send({ requestId: randomUUID() }).expect(409);
    expect(succeeded.body.code).toBe('SCHOOL_SYNC_RETRY_NOT_ALLOWED');
  });

  it('never runs two syncs at once, and a repeated request returns the same run (US-103 AC3)', async () => {
    let release!: () => void;
    school.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const requestId = randomUUID();
    const first = await startRun(requestId).expect(202);
    const repeated = await startRun(requestId).expect(202);
    expect(repeated.body.id).toBe(first.body.id);
    const other = await startRun().expect(409);
    expect(other.body.code).toBe('SCHOOL_SYNC_RUNNING');
    // Configuration cannot change underneath a live run either.
    await saveSchoolDb({ password: undefined }, 409);
    release();
    school.gate = null;
    expect((await settle(first.body.id)).status).toBe('SUCCEEDED');
  });

  it('filters the history by status (US-103 AC4)', async () => {
    const failed = await office.get(`${BASE}/runs`).query({ status: 'FAILED' }).expect(200);
    expect(failed.body.total).toBeGreaterThanOrEqual(2);
    expect(failed.body.items.every((run: SyncRunDto) => run.status === 'FAILED')).toBe(true);
    const all = await office.get(`${BASE}/runs`).query({ pageSize: 100 }).expect(200);
    const starts: string[] = all.body.items.map((run: SyncRunDto) => run.startedAt);
    expect(starts).toEqual([...starts].sort((a, b) => b.localeCompare(a)));
  });

  it('leaves courses and curricula untouched (US-104 AC2)', async () => {
    const course = await prisma.course.findUniqueOrThrow({ where: { id: world.courseId } });
    expect(course.updatedAt).toEqual(courseStamp);
    const items = await prisma.curriculumItem.count({ where: { versionId: world.versionId } });
    expect(items).toBe(1);
  });

  it('fails a run past its deadline at the next reconciliation, and it can no longer commit', async () => {
    const runner = app.get(SchoolSyncRunner);
    let release!: () => void;
    school.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const stuck = (await startRun().expect(202)).body as SyncRunDto;
    await expect.poll(() => school.reads).toBeGreaterThan(0);
    await prisma.syncLog.update({ where: { id: stuck.id }, data: { startedAt: new Date(Date.now() - 120_000), expiresAt: new Date(Date.now() - 1_000) } });
    await runner.reconcile();
    release();
    school.gate = null;
    const after = await settle(stuck.id);
    expect(after).toMatchObject({ status: 'FAILED', errorCode: 'TIMED_OUT', recordCount: 0 });
    // Give the late worker time to try to commit; the fence keeps the run failed.
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect((await office.get(`${BASE}/runs/${stuck.id}`).expect(200)).body.status).toBe('FAILED');
  });

  it('starts the due scheduled slot once and moves the next run forward (D6)', async () => {
    const runner = app.get(SchoolSyncRunner);
    await saveSchoolDb({ enabled: true, password: undefined });
    const slot = new Date(Date.now() - 60_000);
    await prisma.schoolSyncConfiguration.updateMany({ data: { nextDueAt: slot } });
    await Promise.all([runner.reconcile(), runner.reconcile()]);
    const scheduled = await prisma.syncLog.findMany({ where: { trigger: 'SCHEDULED' } });
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]!.requestKey).toBe(`scheduled:${slot.toISOString()}`);
    expect((await settle(scheduled[0]!.id)).status).toBe('SUCCEEDED');
    const config = await configuration();
    expect(new Date(config.nextRunAt).getTime()).toBeGreaterThan(Date.now());
  });
});
