import { getQueueToken } from '@nestjs/bullmq';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Queue } from 'bullmq';
import { seedAccessControl } from '../prisma/seed-data/seed-access-control.js';
import {
  ProgramVersionStatus,
  type Prisma,
} from '../src/generated/prisma/client.js';
import { ReleaseActivationProcessor } from '../src/features/releases/release-activation.processor.js';
import {
  RELEASE_ACTIVATION_CRON,
  RELEASE_ACTIVATION_JOB,
  RELEASE_ACTIVATION_QUEUE,
  ReleaseActivationScheduler,
} from '../src/features/releases/release-activation.scheduler.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { APP_TIME_ZONE } from '../src/shared/time/today.js';
import { createAccount } from './fixtures/accounts.js';
import { createProgram } from './fixtures/programs.js';
import { createSemester } from './fixtures/releases.js';
import { startPostgres, startRedis } from './containers.js';
import type { TestPostgres, TestRedis } from './containers.js';
import { createTestApp } from './test-app.js';
import { setAppEnv } from './test-env.js';
import { E2E_QUEUE_PREFIX, E2E_REDIS_DB } from './containers.js';

const POLL_MS = 100;
const WAIT_MS = 15_000;

describe('scheduled activation on BullMQ (US-073, PB-06, PB-07, KB-057)', () => {
  let postgres: TestPostgres;
  let redis: TestRedis;
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let queue: Queue;
  let publisherId: string;
  let counter = 0;

  beforeAll(async () => {
    [postgres, redis] = await Promise.all([
      startPostgres({ vietnameseCollation: true }),
      startRedis(),
    ]);
    setAppEnv(postgres, redis);
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await seedAccessControl(prisma);
    publisherId = (await createAccount(app, 'actadmin', 'R1')).id;
    queue = app.get<Queue>(getQueueToken(RELEASE_ACTIVATION_QUEUE));
  });

  afterAll(async () => {
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
  });

  const processor = () => app.get(ReleaseActivationProcessor);

  // A program whose newest versions are written straight to the table: the unit under test is the job, not the release.
  async function pendingVersions(count: number, semesterOffset = -1) {
    counter += 1;
    const semester = await createSemester(app, semesterOffset);
    const program = await createProgram(app, { programCode: `ACT${counter}` });
    const base = program.versions[0];
    await prisma.programVersion.update({
      where: { id: base.id },
      data: {
        status: ProgramVersionStatus.ACTIVE,
        versionNumber: '1.0',
        publishedAt: new Date(),
        effectiveSemesterId: semester.id,
      },
    });
    const ids: string[] = [];
    for (let index = 1; index <= count; index += 1) {
      const row = await prisma.programVersion.create({
        data: {
          programId: program.id,
          status: ProgramVersionStatus.PENDING,
          versionNumber: `1.${index}`,
          publishedAt: new Date(),
          publishedById: publisherId,
          effectiveSemesterId: semester.id,
          programName: base.programName,
          majorCode: base.majorCode,
          majorName: base.majorName,
          semesterCount: base.semesterCount,
          totalCredits: base.totalCredits,
          compulsoryCredits: base.compulsoryCredits,
          electiveCredits: base.electiveCredits,
        } satisfies Prisma.ProgramVersionUncheckedCreateInput,
      });
      ids.push(row.id);
    }
    return {
      programId: program.id,
      baseId: base.id,
      ids,
      semesterId: semester.id,
    };
  }

  const statuses = async (programId: string) =>
    (
      await prisma.programVersion.findMany({
        where: { programId },
        orderBy: { createdAt: 'asc' },
      })
    ).map((row) => row.status);

  async function until(check: () => Promise<boolean>) {
    const deadline = Date.now() + WAIT_MS;
    while (!(await check())) {
      if (Date.now() > deadline)
        throw new Error('timed out waiting for the worker');
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  }

  it('keeps its queue under the prefix of this run and registers the daily schedule at start-up', async () => {
    const prefix = process.env.BULLMQ_PREFIX!;
    expect(prefix.startsWith(E2E_QUEUE_PREFIX)).toBe(true);
    expect(queue.opts.prefix).toBe(prefix);
    const schedulers = await queue.getJobSchedulers();
    expect(schedulers).toEqual([
      expect.objectContaining({
        key: RELEASE_ACTIVATION_JOB,
        pattern: RELEASE_ACTIVATION_CRON,
        tz: APP_TIME_ZONE,
      }),
    ]);
    expect(queue.toKey('id')).toBe(`${prefix}:${RELEASE_ACTIVATION_QUEUE}:id`);
    // The default prefix of the shared Redis holds none of this run's schedule.
    const unprefixed = new Queue(RELEASE_ACTIVATION_QUEUE, {
      connection: {
        host: redis.getHost(),
        port: redis.getPort(),
        db: E2E_REDIS_DB,
      },
    });
    try {
      expect(await unprefixed.getJobSchedulers()).toEqual([]);
    } finally {
      await unprefixed.close();
    }
  });

  it('has a worker that takes a queued job and activates what is due', async () => {
    const { programId, ids } = await pendingVersions(1);

    await queue.add(RELEASE_ACTIVATION_JOB, {}, { removeOnComplete: true });
    await until(
      async () => (await statuses(programId)).join() === 'HISTORICAL,ACTIVE',
    );

    expect(
      (await prisma.programVersion.findUniqueOrThrow({ where: { id: ids[0] } }))
        .status,
    ).toBe('ACTIVE');
  });

  it('catches up at every start-up: the boot job runs even when an earlier boot job already completed', async () => {
    const first = await pendingVersions(1);
    await app.get(ReleaseActivationScheduler).schedule();
    await until(
      async () =>
        (await statuses(first.programId)).join() === 'HISTORICAL,ACTIVE',
    );

    const second = await pendingVersions(1);
    await app.get(ReleaseActivationScheduler).schedule();
    await until(
      async () =>
        (await statuses(second.programId)).join() === 'HISTORICAL,ACTIVE',
    );
  });

  it('activates in the order the versions were created, so the newest ends up Active and the rest Historical', async () => {
    const { programId } = await pendingVersions(3);

    expect(await processor().reconcile()).toBe(3);

    expect(await statuses(programId)).toEqual([
      'HISTORICAL',
      'HISTORICAL',
      'HISTORICAL',
      'ACTIVE',
    ]);
    expect(
      await prisma.programVersion.count({
        where: { programId, status: 'ACTIVE' },
      }),
    ).toBe(1);
  });

  it('leaves a version whose semester starts tomorrow Pending and takes one that starts today (midnight, APP_TIME_ZONE)', async () => {
    const tomorrow = await pendingVersions(1, 1);
    const today = await pendingVersions(1, 0);

    await processor().reconcile();

    expect(await statuses(tomorrow.programId)).toEqual(['ACTIVE', 'PENDING']);
    expect(await statuses(today.programId)).toEqual(['HISTORICAL', 'ACTIVE']);
  });

  it('is safe to run twice, and twice at the same time (K-7)', async () => {
    const a = await pendingVersions(1);
    const b = await pendingVersions(1);
    const c = await pendingVersions(1);
    const before = await prisma.programVersion.count({
      where: { status: 'ACTIVE' },
    });

    const counts = await Promise.all([
      processor().reconcile(),
      processor().reconcile(),
    ]);

    expect(counts[0] + counts[1]).toBeGreaterThanOrEqual(3);
    for (const { programId } of [a, b, c]) {
      expect(await statuses(programId)).toEqual(['HISTORICAL', 'ACTIVE']);
    }
    expect(await processor().reconcile()).toBe(0);
    expect(
      await prisma.programVersion.count({ where: { status: 'ACTIVE' } }),
    ).toBe(before);
  });

  it('ignores a Pending version whose semester has no start date', async () => {
    const { programId, semesterId } = await pendingVersions(1);
    await prisma.semester.update({
      where: { id: semesterId },
      data: { startDate: null },
    });

    await processor().reconcile();

    expect(await statuses(programId)).toEqual(['ACTIVE', 'PENDING']);
  });
});
