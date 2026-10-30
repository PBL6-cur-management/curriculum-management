import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { seedAccessControl } from '../prisma/seed-data/seed-access-control.js';
import {
  SIM,
  createSimulator,
  loadSnapshot,
  syntheticRows,
  type SimServer,
} from '../scripts/school-db-sim/simulator.js';
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
import { createTestApp } from './test-app.js';
import { setAppEnv } from './test-env.js';

// Opt-in: runs against the real SQL Server simulator (pnpm school-db:sim:start) when its passwords are set.
// Synthetic data only. Skipped otherwise, because the image needs about 2 GB of memory.
const SA_PASSWORD = process.env.SCHOOL_DB_SIM_SA_PASSWORD;
const READER_PASSWORD = process.env.SCHOOL_DB_SIM_READER_PASSWORD;
const SERVER: SimServer = {
  host: '127.0.0.1',
  port: Number(process.env.SCHOOL_DB_SIM_PORT ?? 14330),
  saPassword: SA_PASSWORD ?? '',
};
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };
const BASE = '/api/school-db-sync';
const READY_ATTEMPTS = 30;
type Agent = ReturnType<typeof request.agent>;

describe.skipIf(!SA_PASSWORD || !READER_PASSWORD)(
  'School database synchronization against the SQL Server simulator',
  () => {
    let postgres: TestPostgres;
    let redis: TestRedis;
    let app: NestExpressApplication;
    let prisma: PrismaService;
    let office: Agent;
    let world: StudentWorld;

    beforeAll(async () => {
      [postgres, redis] = await Promise.all([
        startPostgres({ vietnameseCollation: true }),
        startRedis(),
      ]);
      setAppEnv(postgres, redis);
      process.env.SCHOOL_SYNC_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString('base64');
      app = await createTestApp();
      prisma = app.get(PrismaService);
      await seedAccessControl(prisma);
      office = await loginAgent(app, await createAccount(app, 'sqloffice', 'R1'));
      world = await createStudentWorld(app, office, 'SQL');
      // SQL Server takes a while to accept logins after the container starts.
      for (let attempt = 1; ; attempt++) {
        try {
          await createSimulator(SERVER, READER_PASSWORD!);
          break;
        } catch (error) {
          if (attempt >= READY_ATTEMPTS) throw error;
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
      await loadSnapshot(
        SERVER,
        'sim-e2e-1',
        syntheticRows(
          {
            cohortCode: world.cohortCode,
            programCode: world.programCode,
            admissionSemesterCode: world.admissionSemesterCode,
            courseCode: world.courseCode,
          },
          25,
          'SQE',
        ),
      );
    });

    afterAll(async () => {
      await app?.close();
      await Promise.all([postgres?.stop(), redis?.stop()]);
    });

    async function save(username: string, password: string) {
      const current = (await office.get(`${BASE}/configuration`).expect(200)).body;
      await office
        .put(`${BASE}/configuration`)
        .set(CSRF)
        .send({
          revision: current.revision,
          mode: 'SCHOOL_DB',
          profile: 'SIMULATED_SQL_SERVER',
          enabled: false,
          sourceIdentity: 'SYNTHETIC-SCHOOL-V1',
          host: SERVER.host,
          port: SERVER.port,
          database: SIM.DATABASE,
          username,
          password,
          cadence: 'DAILY',
          localTime: '02:00',
        })
        .expect(200);
      const saved = (await office.get(`${BASE}/configuration`).expect(200)).body;
      return office
        .post(`${BASE}/connection-test`)
        .set(CSRF)
        .send({ configurationRevision: saved.revision })
        .expect(200);
    }

    it('refuses a login that can write to the source', async () => {
      const probe = await save('sa', SA_PASSWORD!);
      expect(probe.body).toMatchObject({ success: false, code: 'READ_ONLY_REQUIRED' });
    });

    it('rejects a wrong password without echoing the driver error', async () => {
      const probe = await save(SIM.READER, 'not-the-password-1');
      expect(probe.body).toMatchObject({ success: false, code: 'CONNECTION_FAILED' });
      expect(probe.body.message).not.toMatch(/login failed/i);
    });

    it('reads the whole snapshot through the read-only views and commits it', async () => {
      const probe = await save(SIM.READER, READER_PASSWORD!);
      expect(probe.body).toMatchObject({ success: true, code: 'CONNECTED' });
      const accepted = await office.post(`${BASE}/runs`).set(CSRF).send({ requestId: randomUUID() }).expect(202);
      let run: SyncRunDto = accepted.body;
      for (let attempt = 0; run.status === 'RUNNING' && attempt < 300; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        run = (await office.get(`${BASE}/runs/${run.id}`).expect(200)).body;
      }
      expect(run).toMatchObject({
        status: 'SUCCEEDED',
        studentCount: 25,
        resultCount: 25,
        classCount: 1,
        snapshotVersion: 'sim-e2e-1',
      });
      expect(await prisma.student.count({ where: { dataSource: 'SCHOOL_DB' } })).toBe(25);
    });
  },
);
