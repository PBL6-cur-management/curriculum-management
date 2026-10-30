import { performance } from 'node:perf_hooks';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { seedAccessControl } from '../prisma/seed-data/seed-access-control.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { ELIGIBILITY_PERFORMANCE } from '../src/shared/registration-eligibility/eligibility.constants.js';
import { writeAcademicResultSource } from '../src/shared/students/academic-result.writer.js';
import {
  startPostgres,
  startRedis,
  type TestPostgres,
  type TestRedis,
} from './containers.js';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import {
  createEligibilityFixture,
  getEligibility,
} from './fixtures/registration-eligibility.js';
import { createTestApp } from './test-app.js';
import { setAppEnv } from './test-env.js';

describe('registration eligibility full HTTP performance', () => {
  let postgres: TestPostgres;
  let redis: TestRedis;
  let app: NestExpressApplication;
  beforeAll(async () => {
    [postgres, redis] = await Promise.all([
      startPostgres({ vietnameseCollation: true }),
      startRedis(),
    ]);
    setAppEnv(postgres, redis);
    app = await createTestApp();
    await seedAccessControl(app.get(PrismaService));
  });
  afterAll(async () => {
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
  });
  it.each([30, ELIGIBILITY_PERFORMANCE.COURSES])(
    'computes and serializes a %i-row framework within the full-request budget',
    async (count) => {
      const account = await createAccount(app, `eligperf${count}`, 'R1');
      const office = await loginAgent(app, account);
      const fixture = await createEligibilityFixture(
        app,
        office,
        `PERF${count}`,
        count,
      );
      await app.get(PrismaService).$transaction((tx) =>
        writeAcademicResultSource(
          tx,
          {
            rows: [...fixture.courseIds.values()].map((courseId, index) => {
              const status = (
                ['PASSED', 'FAILED', 'IN_PROGRESS', 'EXEMPT'] as const
              )[index % 4];
              return {
                rowNumber: index + 2,
                action: 'CREATE' as const,
                existingId: null,
                expectedRevision: null,
                value: {
                  studentId: fixture.studentId,
                  courseId,
                  semesterId: fixture.semesterId,
                  status,
                  score4:
                    status === 'PASSED'
                      ? '2.5'
                      : status === 'FAILED'
                        ? '1'
                        : null,
                  score10: null,
                  letterGrade: null,
                },
              };
            }),
          },
          { source: 'EXCEL', actorId: account.id },
        ),
      );
      const samples: number[] = [];
      for (let sample = 0; sample < 3; sample++) {
        const started = performance.now();
        const answer = await getEligibility(office, fixture);
        samples.push(performance.now() - started);
        expect(answer.items).toHaveLength(count);
      }
      console.info(
        JSON.stringify({
          rows: count,
          fullHttpMilliseconds: samples,
          budgetMs: ELIGIBILITY_PERFORMANCE.BUDGET_MS,
          platform: process.platform,
          architecture: process.arch,
          node: process.version,
        }),
      );
      expect(Math.max(...samples)).toBeLessThan(
        ELIGIBILITY_PERFORMANCE.BUDGET_MS,
      );
    },
  );
});
