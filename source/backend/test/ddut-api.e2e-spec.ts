import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { createDdutDocument } from '../src/app.setup.js';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import {
  graduationHarness,
  graduationQuery,
  graduationWriteCounts,
  seedGraduationFixture,
  setGraduationResult,
  type GraduationFixture,
  type GraduationHarness,
} from './fixtures/graduation.js';

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };
const CONTRACT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../openapi/ddut-v1.json',
);

let clients = 0;
async function issueKey(harness: GraduationHarness, rateLimit?: number) {
  clients += 1;
  const created = await harness.office
    .post('/api/integration-clients')
    .set(CSRF)
    .send({ clientName: `dDUT thử ${clients}`, rateLimit })
    .expect(201);
  return created.body as {
    client: { id: string; status: string; rateLimit: number };
    apiKey: string;
  };
}

async function contextOf(
  harness: GraduationHarness,
  fixture: GraduationFixture,
) {
  const [student, semester] = await Promise.all([
    harness.prisma.student.findUniqueOrThrow({
      where: { id: fixture.studentId },
      select: { studentCode: true },
    }),
    harness.prisma.semester.findUniqueOrThrow({
      where: { id: fixture.semesterId },
      select: { semesterCode: true },
    }),
  ]);
  return { mssv: student.studentCode, semester: semester.semesterCode };
}

describe('dDUT read API (F-21)', () => {
  const harness = graduationHarness();
  const v1 = (path: string, key?: string) => {
    const call = request(harness.app.getHttpServer()).get(`/api/v1${path}`);
    return key ? call.set('X-Api-Key', key) : call;
  };

  it('issues a key once, stores only its hash, and keeps management to R1 (US-098 AC1..3)', async () => {
    const issued = await issueKey(harness);
    expect(issued.apiKey).toMatch(/^ddut_[A-Za-z0-9_-]{40,}$/);
    expect(issued.client).toMatchObject({ status: 'ACTIVE', rateLimit: 60 });
    const stored = await harness.prisma.integrationClient.findUniqueOrThrow({
      where: { id: issued.client.id },
    });
    expect(stored.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.keyHash).not.toContain(issued.apiKey);
    const page = await harness.office
      .get('/api/integration-clients')
      .expect(200);
    expect(JSON.stringify(page.body)).not.toContain(issued.apiKey);
    expect(JSON.stringify(page.body)).not.toContain(stored.keyHash);

    const director = await loginAgent(
      harness.app,
      await createAccount(harness.app, 'ddutdirector', 'R3'),
    );
    await director.get('/api/integration-clients').expect(403);
    await director
      .post('/api/integration-clients')
      .set(CSRF)
      .send({ clientName: 'không được' })
      .expect(403);
    await harness.office
      .post('/api/integration-clients')
      .set(CSRF)
      .send({ clientName: `dDUT thử ${clients}` })
      .expect(409);
  });

  it('answers a missing, wrong or locked key with the same 401 and never uses a session (API-03, US-098 AC4)', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    const { mssv } = await contextOf(harness, fixture);
    const issued = await issueKey(harness);
    const path = `/sinh-vien/${mssv}/chuong-trinh`;
    const missing = await v1(path).expect(401);
    const wrong = await v1(path, 'ddut_wrong').expect(401);
    const cookieOnly = await harness.office.get(`/api/v1${path}`).expect(401);
    await harness.office
      .post(`/api/integration-clients/${issued.client.id}/lock`)
      .set(CSRF)
      .expect(200);
    const locked = await v1(path, issued.apiKey).expect(401);
    const refused = await harness.prisma.integrationCallLog.findFirst({
      where: { clientId: issued.client.id, httpStatus: 401 },
    });
    expect(refused?.errorCode).toBe('API_KEY_INVALID');
    for (const response of [missing, wrong, cookieOnly, locked]) {
      expect(response.body.code).toBe('API_KEY_INVALID');
      expect(response.headers['set-cookie']).toBeUndefined();
    }
    await harness.office
      .post(`/api/integration-clients/${issued.client.id}/unlock`)
      .set(CSRF)
      .expect(200);
    await v1(path, issued.apiKey).expect((response) => {
      expect(response.status).not.toBe(401);
      expect(response.headers['set-cookie']).toBeUndefined();
    });
  });

  it('serves the six resources with the same answers the web gives, writing nothing academic (US-099/100, CV-242)', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    await setGraduationResult(
      harness,
      fixture,
      fixture.courseIds.mandatory,
      'PASSED',
      { score4: '3.5' },
    );
    const { mssv, semester } = await contextOf(harness, fixture);
    const { apiKey } = await issueKey(harness);
    const query = graduationQuery(fixture);
    const before = await graduationWriteCounts(harness.prisma);

    const program = await v1(`/sinh-vien/${mssv}/chuong-trinh`, apiKey)
      .query({ semester })
      .expect(200);
    expect(program.headers['cache-control']).toContain('no-store');
    expect(program.headers['x-request-id']).toBeTruthy();
    expect(program.body.meta.apiVersion).toBe('v1');
    expect(program.body.context).toMatchObject({
      studentCode: mssv,
      programVersionId: fixture.versionId,
      enrollmentId: fixture.enrollmentId,
      semesterCode: semester,
    });

    const version = await v1(
      `/chuong-trinh/${program.body.context.programCode}/phien-ban/${program.body.context.versionNumber}`,
      apiKey,
    ).expect(200);
    expect(
      version.body.semesters.flatMap(
        (term: { items: unknown[] }) => term.items,
      ),
    ).toHaveLength(4);
    expect(JSON.stringify(version.body)).not.toMatch(
      /createdBy|publishedBy|keyHash/,
    );

    const eligibility = await v1(
      `/sinh-vien/${mssv}/hoc-phan-du-dieu-kien`,
      apiKey,
    )
      .query({ semester })
      .expect(200);
    const web = await harness.office
      .get(`/api/students/${fixture.studentId}/registration-eligibility`)
      .query(query)
      .expect(200);
    const strip = (body: { items: unknown[]; context: unknown }) => ({
      items: body.items,
      context: body.context,
    });
    expect(strip(eligibility.body.eligibility)).toEqual(strip(web.body));

    const graduation = await v1(`/sinh-vien/${mssv}/xet-tot-nghiep`, apiKey)
      .query({ semester })
      .expect(200);
    const webGraduation = await harness.office
      .get(`/api/students/${fixture.studentId}/graduation`)
      .query(query)
      .expect(200);
    expect(graduation.body.graduation.status).toBe(webGraduation.body.status);
    expect(graduation.body.graduation.result?.credits).toEqual(
      webGraduation.body.result?.credits,
    );

    const progress = await v1(`/sinh-vien/${mssv}/tien-do`, apiKey)
      .query({ semester })
      .expect(200);
    expect(progress.body.academicStatus).toBe('HAS_RESULTS');
    expect(progress.body.credits).toEqual(
      webGraduation.body.result?.credits ?? null,
    );
    const states = new Map(
      progress.body.terms
        .flatMap(
          (term: { courses: { itemId: string; state: string }[] }) =>
            term.courses,
        )
        .map((course: { itemId: string; state: string }) => [
          course.itemId,
          course.state,
        ]),
    );
    expect(states.get(fixture.itemIds.mandatory)).toBe('PASSED');

    // The result-change receipt (index 4) is written by the background scanner for the seeded result, not by a read.
    const academicWrites = (counts: number[]) =>
      counts.filter((_, index) => index !== 4);
    expect(academicWrites(await graduationWriteCounts(harness.prisma))).toEqual(
      academicWrites(before),
    );
    const calls = await harness.prisma.integrationCallLog.findMany({
      where: { studentCode: mssv, httpStatus: 200 },
    });
    expect(calls.map((call) => call.resource).sort()).toEqual([
      'ELIGIBILITY',
      'GRADUATION',
      'PROGRESS',
      'STUDENT_PROGRAM',
    ]);
  });

  it('keeps unknown students, empty transcripts and syllabus selectors explicit (US-100 AC4, EC-52)', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    const { mssv, semester } = await contextOf(harness, fixture);
    const { apiKey } = await issueKey(harness);
    const unknown = await v1('/sinh-vien/KHONGCO999/tien-do', apiKey).expect(
      404,
    );
    expect(unknown.body.code).toBe('API_STUDENT_NOT_FOUND');
    const empty = await v1(`/sinh-vien/${mssv}/tien-do`, apiKey)
      .query({ semester })
      .expect(200);
    expect(empty.body.academicStatus).toBe('NO_ACADEMIC_RESULTS');
    expect(empty.body.terms.length).toBeGreaterThan(0);
    const course = await harness.prisma.course.findUniqueOrThrow({
      where: { id: fixture.courseIds.mandatory },
      select: { courseCode: true },
    });
    const neither = await v1(
      `/hoc-phan/${course.courseCode}/de-cuong`,
      apiKey,
    ).expect(400);
    expect(neither.body.code).toBe('API_SYLLABUS_SELECTOR_REQUIRED');
    await v1(`/hoc-phan/${course.courseCode}/de-cuong`, apiKey)
      .query({ mssv, program: 'X', programVersion: '1.0' })
      .expect(400);
    const byStudent = await v1(
      `/hoc-phan/${course.courseCode}/de-cuong`,
      apiKey,
    ).query({ mssv, semester });
    expect([200, 404]).toContain(byStudent.status);
    if (byStudent.status === 404)
      expect(byStudent.body.code).toBe('API_SYLLABUS_NOT_ISSUED');
    else expect(byStudent.body.context.studentCode).toBe(mssv);
    await v1('/chuong-trinh/KHONGCO/phien-ban/1.0', apiKey).expect(404);
    await v1('/chuong-trinh/KHONGCO/phien-ban/abc', apiKey).expect(404);
  });

  it('enforces the per-minute quota with Retry-After and records every call append-only (API-04, US-098 AC5)', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    const { mssv, semester } = await contextOf(harness, fixture);
    const { apiKey, client } = await issueKey(harness, 2);
    const path = `/sinh-vien/${mssv}/chuong-trinh`;
    await v1(path, apiKey).query({ semester }).expect(200);
    await v1(path, apiKey).query({ semester }).expect(200);
    const limited = await v1(path, apiKey).query({ semester }).expect(429);
    expect(limited.body.code).toBe('API_RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    const calls = await harness.prisma.integrationCallLog.findMany({
      where: { clientId: client.id },
      orderBy: { occurredAt: 'asc' },
    });
    expect(calls.map((call) => call.httpStatus)).toEqual([200, 200, 429]);
    expect(calls[2]!.errorCode).toBe('API_RATE_LIMITED');
    await expect(
      harness.prisma.integrationCallLog.update({
        where: { id: calls[0]!.id },
        data: { httpStatus: 500 },
      }),
    ).rejects.toThrow();
    await expect(
      harness.prisma.integrationCallLog.delete({ where: { id: calls[0]!.id } }),
    ).rejects.toThrow();
    const listed = await harness.office
      .get('/api/integration-clients')
      .expect(200);
    expect(
      listed.body.items.find((item: { id: string }) => item.id === client.id)
        .lastCalledAt,
    ).toBeTruthy();
  });

  it('publishes a separate v1 OpenAPI contract identical to the committed one (US-101 AC1..3)', async () => {
    const docs = await request(harness.app.getHttpServer())
      .get('/api/v1/docs-json')
      .expect(200);
    expect(Object.keys(docs.body.paths)).toEqual([
      '/api/v1/sinh-vien/{mssv}/chuong-trinh',
      '/api/v1/chuong-trinh/{maCT}/phien-ban/{soPB}',
      '/api/v1/hoc-phan/{maHP}/de-cuong',
      '/api/v1/sinh-vien/{mssv}/tien-do',
      '/api/v1/sinh-vien/{mssv}/hoc-phan-du-dieu-kien',
      '/api/v1/sinh-vien/{mssv}/xet-tot-nghiep',
    ]);
    const generated = `${JSON.stringify(createDdutDocument(harness.app), null, 2)}\n`;
    if (process.env.UPDATE_DDUT_OPENAPI === '1' || !existsSync(CONTRACT)) {
      mkdirSync(dirname(CONTRACT), { recursive: true });
      writeFileSync(CONTRACT, generated);
    }
    // A change here is a contract change for dDUT: regenerate deliberately with UPDATE_DDUT_OPENAPI=1.
    expect(generated).toBe(readFileSync(CONTRACT, 'utf8'));
  });
});
