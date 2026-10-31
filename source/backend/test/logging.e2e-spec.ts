import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createAppLogger } from '../src/shared/logging/app-logger.js';
import { startPostgres, startRedis } from './containers.js';
import type { TestPostgres, TestRedis } from './containers.js';
import { createTestApp } from './test-app.js';
import { setAppEnv } from './test-env.js';

// F27-AC07: one JSON line per request with only method, route, status, duration and a server-made ID.
const SENTINEL = 'sentinel-hunter2';

describe('request log (F-27 BE-02)', () => {
  let postgres: TestPostgres;
  let redis: TestRedis;
  let app: NestExpressApplication;
  const lines: string[] = [];
  const records = () =>
    lines.map((line) => JSON.parse(line) as Record<string, unknown>);

  beforeAll(async () => {
    [postgres, redis] = await Promise.all([
      startPostgres({ vietnameseCollation: true }),
      startRedis(),
    ]);
    setAppEnv(postgres, redis);
    app = await createTestApp(
      createAppLogger({
        level: 'info',
        destination: { write: (line: string) => lines.push(line) },
      }),
    );
  });

  afterAll(async () => {
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
  });

  it('writes a completion record for a matched route and for an unmatched path', async () => {
    lines.length = 0;
    await request(app.getHttpServer()).get('/api/health').expect(200);
    await request(app.getHttpServer())
      .get(`/api/no-such-${SENTINEL}`)
      .expect(404);
    const http = records().filter((r) => r.event === 'http.completed');
    expect(http).toEqual([
      expect.objectContaining({
        method: 'GET',
        route: '/api/health',
        statusCode: 200,
      }),
      expect.objectContaining({ route: 'unmatched', statusCode: 404 }),
    ]);
  });

  it('never writes cookies, headers, query strings or bodies', async () => {
    lines.length = 0;
    await request(app.getHttpServer())
      .post(`/api/auth/login?token=${SENTINEL}`)
      .set('Cookie', `ctdt.sid=${SENTINEL}`)
      .set('Authorization', `Bearer ${SENTINEL}`)
      .set('X-Request-Id', SENTINEL)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username: SENTINEL, password: SENTINEL });
    const text = lines.join('');
    expect(lines.length).toBeGreaterThan(0);
    expect(text).not.toContain(SENTINEL);
    expect(text).not.toContain('postgres');
    const record = records().find((r) => r.event === 'http.completed');
    expect(record).toMatchObject({ method: 'POST', route: '/api/auth/login' });
    expect(record!.requestId).not.toBe(SENTINEL);
  });
});
