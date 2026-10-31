import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seedAccessControl } from '../prisma/seed-data/seed-access-control.js';
import { SubjectGroupMemberRole } from '../src/generated/prisma/client.js';
import { ApprovalMaintenanceService } from '../src/features/notification-delivery/approval-maintenance.service.js';
import { EmailPumpService } from '../src/features/notification-delivery/email-pump.service.js';
import { MailerService } from '../src/features/notification-delivery/mailer.service.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { MS_PER_DAY } from '../src/shared/time/days-since.js';
import { todayDate, toIsoDay } from '../src/shared/time/today.js';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import {
  courseInProgram,
  notificationsOf,
  submitSyllabusRequest,
} from './fixtures/approvals.js';
import { approveAs, decide, readRequest } from './fixtures/change-requests.js';
import {
  addMembership,
  createSubjectGroup,
} from './fixtures/subject-groups.js';
import { startPostgres, startRedis } from './containers.js';
import type { TestPostgres, TestRedis } from './containers.js';
import { createTestApp } from './test-app.js';
import { setAppEnv } from './test-env.js';

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };
type Agent = ReturnType<typeof request.agent>;

const day = (offset: number) =>
  toIsoDay(new Date(todayDate().getTime() + offset * MS_PER_DAY));

describe('Delegation, email and reminders (F-25)', () => {
  let postgres: TestPostgres;
  let redis: TestRedis;
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let adminId: string;
  let member: Agent;
  let memberId: string;
  let coord: Agent;
  let coordId: string;
  let deputy: Agent;
  let deputyId: string;
  let directorId: string;
  let group: string;
  const sent: { to: string; subject: string; text: string }[] = [];
  let failNext = false;
  let counter = 0;
  const code = (prefix: string) => `${prefix}${(counter += 1)}`;

  beforeAll(async () => {
    [postgres, redis] = await Promise.all([
      startPostgres({ vietnameseCollation: true }),
      startRedis(),
    ]);
    setAppEnv(postgres, redis);
    process.env.EMAIL_ENABLED = 'true';
    process.env.REMINDERS_ENABLED = 'true';
    process.env.REMINDER_MAX_DAYS = '7';
    process.env.REMINDER_REPEAT_DAYS = '3';
    app = await createTestApp();
    // No SMTP server in the test world: the transport is replaced, the outbox and pump are real.
    vi.spyOn(app.get(MailerService), 'send').mockImplementation(
      async (message) => {
        if (failNext) {
          failNext = false;
          throw Object.assign(new Error('refused'), { code: 'ECONNREFUSED' });
        }
        sent.push(message);
      },
    );
    prisma = app.get(PrismaService);
    await seedAccessControl(prisma);
    group = (await createSubjectGroup(app, 'DL_G')).id;
    const adminAccount = await createAccount(app, 'dladmin', 'R1');
    adminId = adminAccount.id;
    admin = await loginAgent(app, adminAccount);
    const memberAccount = await createAccount(app, 'dlmember');
    memberId = memberAccount.id;
    await addMembership(app, { groupId: group, userId: memberId });
    member = await loginAgent(app, memberAccount);
    const coordAccount = await createAccount(app, 'dlcoord', 'R4');
    coordId = coordAccount.id;
    for (const memberRole of [
      SubjectGroupMemberRole.MEMBER,
      SubjectGroupMemberRole.COORDINATOR,
    ]) {
      await addMembership(app, { groupId: group, userId: coordId, memberRole });
    }
    coord = await loginAgent(app, coordAccount);
    const deputyAccount = await createAccount(app, 'dldeputy');
    deputyId = deputyAccount.id;
    deputy = await loginAgent(app, deputyAccount);
    directorId = (await createAccount(app, 'dldirector')).id;
    for (const [id, email] of [
      [coordId, 'coord@example.test'],
      [deputyId, 'deputy@example.test'],
      [adminId, 'admin@example.test'],
    ]) {
      await prisma.user.update({ where: { id }, data: { email } });
    }
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    for (const key of [
      'EMAIL_ENABLED',
      'REMINDERS_ENABLED',
      'REMINDER_MAX_DAYS',
      'REMINDER_REPEAT_DAYS',
    ])
      delete process.env[key];
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
  });

  const grant = (agent: Agent, body: object) =>
    agent.post('/api/approval-delegations').set(CSRF).send(body);
  const queueOf = async (agent: Agent) =>
    (await agent.get('/api/approval-queue').expect(200)).body as {
      requestId: string;
      delegatedFor: { delegationId: string; delegator: { id: string } }[];
    }[];
  const pendingRequest = async () => {
    const { course } = await courseInProgram(
      app,
      admin,
      code('DL'),
      group,
      directorId,
    );
    return submitSyllabusRequest(member, course.id);
  };

  it('lets a delegate decide the delegator’s level and records who acted for whom (US-114 AC1, AC2)', async () => {
    const access = await coord
      .get('/api/approval-delegations/access')
      .expect(200);
    expect(access.body).toMatchObject({
      canManage: true,
      canManageOthers: false,
    });
    expect(
      (await coord.get('/api/approval-delegations/levels').expect(200)).body,
    ).toEqual([{ approvalLevel: 1, levelName: 'Điều phối nhóm chuyên môn' }]);

    const created = await grant(coord, {
      delegateId: deputyId,
      validFrom: day(0),
      validTo: day(3),
    }).expect(201);
    expect(created.body).toMatchObject({
      status: 'ACTIVE',
      isEffectiveNow: true,
      canRevoke: true,
      scope: null,
    });
    const received = await notificationsOf(deputy);
    expect(received[0]).toMatchObject({
      notificationType: 'DELEGATION_RECEIVED',
      emailStatus: 'PENDING',
      link: '/approval-delegations',
    });

    const submitted = await pendingRequest();
    const queue = await queueOf(deputy);
    expect(queue).toEqual([
      expect.objectContaining({
        requestId: submitted.id,
        delegatedFor: [
          expect.objectContaining({
            delegationId: created.body.id,
            delegator: expect.objectContaining({ id: coordId }),
          }),
        ],
      }),
    ]);
    expect((await readRequest(deputy, submitted.id)).permissions).toMatchObject(
      { canApprove: true, canReturn: true, canOverride: false },
    );

    const decided = await approveAs(deputy, submitted.id);
    expect(decided.status).toBe('PENDING_DIRECTOR');
    const step = decided.steps.find((row) => row.approvalLevel === 1)!;
    expect(step).toMatchObject({
      kind: 'DELEGATED',
      approver: expect.objectContaining({ id: coordId }),
      performedBy: expect.objectContaining({ id: deputyId }),
      delegation: {
        id: created.body.id,
        delegator: expect.objectContaining({ id: coordId }),
      },
    });
  });

  it('refuses self-delegation, past ranges and a delegate approving their own request (US-114 AC5)', async () => {
    expect(
      (
        await grant(coord, {
          delegateId: coordId,
          validFrom: day(0),
          validTo: day(1),
        }).expect(400)
      ).body.code,
    ).toBe('DELEGATION_SELF');
    expect(
      (
        await grant(coord, {
          delegateId: deputyId,
          validFrom: day(-5),
          validTo: day(-1),
        }).expect(400)
      ).body.code,
    ).toBe('DELEGATION_PAST_RANGE');
    expect(
      (
        await grant(coord, {
          delegateId: deputyId,
          validFrom: day(2),
          validTo: day(1),
        }).expect(400)
      ).body.code,
    ).toBe('DELEGATION_INVALID_RANGE');
    // A coordinator may not delegate someone else's level; only R1 acts on behalf.
    expect(
      (
        await grant(coord, {
          delegatorId: directorId,
          delegateId: deputyId,
          validFrom: day(0),
          validTo: day(1),
        }).expect(403)
      ).body.code,
    ).toBe('DELEGATION_OUT_OF_SCOPE');

    await grant(coord, {
      delegateId: memberId,
      validFrom: day(0),
      validTo: day(1),
    }).expect(201);
    const own = await pendingRequest();
    expect(
      (await queueOf(member)).some((item) => item.requestId === own.id),
    ).toBe(false);
    expect(
      (await decide(member, own.id, 'approve').expect(403)).body.code,
    ).toBe('SELF_APPROVAL');
  });

  it('stops a revoked or expired grant at once (US-114 AC3, AC4)', async () => {
    const created = await grant(admin, {
      delegatorId: coordId,
      delegateId: deputyId,
      validFrom: day(0),
      validTo: day(5),
    }).expect(201);
    expect(created.body.createdBy.id).toBe(adminId);
    const submitted = await pendingRequest();
    expect(
      (await queueOf(deputy)).some((item) => item.requestId === submitted.id),
    ).toBe(true);

    // Every grant to the deputy ends: revoke one, push the other's last day into the past.
    const revoked = await coord
      .post(`/api/approval-delegations/${created.body.id}/revoke`)
      .set(CSRF)
      .send({})
      .expect(200);
    expect(revoked.body).toMatchObject({ status: 'REVOKED', canRevoke: false });
    await prisma.approvalDelegation.updateMany({
      where: { delegateId: deputyId, status: 'ACTIVE' },
      data: {
        validFrom: new Date(todayDate().getTime() - 3 * MS_PER_DAY),
        validTo: new Date(todayDate().getTime() - MS_PER_DAY),
      },
    });
    // With no usable grant and no role of their own, the deputy is back to an outsider.
    await deputy.get('/api/approval-queue').expect(403);
    await decide(deputy, submitted.id, 'approve').expect(403);

    const result = await app.get(ApprovalMaintenanceService).run();
    expect(result.expired).toBeGreaterThan(0);
    const list = await deputy
      .get('/api/approval-delegations?direction=INCOMING&status=EXPIRED')
      .expect(200);
    expect(list.body.total).toBeGreaterThan(0);
    // The decision made earlier keeps its evidence after the grant ended.
    expect(
      await prisma.approvalStep.count({
        where: { delegation: { delegateId: deputyId } },
      }),
    ).toBe(1);
  });

  it('sends each email once, records failure and honours the personal switch (US-115)', async () => {
    const pump = app.get(EmailPumpService);
    await pump.pump();
    failNext = true;
    await grant(admin, {
      delegatorId: coordId,
      delegateId: deputyId,
      validFrom: day(0),
      validTo: day(1),
    }).expect(201);
    await pump.pump();
    const latest = (await notificationsOf(deputy))[0];
    expect(latest).toMatchObject({ emailStatus: 'FAILED', emailSent: false });
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.every((mail) => mail.subject.startsWith('[CTĐT]'))).toBe(true);
    expect((await notificationsOf(deputy))[1]).toMatchObject({
      emailStatus: 'SENT',
      emailSent: true,
    });
    // A second pass never resends what was sent or failed.
    const before = sent.length;
    await pump.pump();
    expect(sent.length).toBe(before);

    const preference = await deputy
      .patch('/api/notifications/preferences')
      .set(CSRF)
      .send({ emailEnabled: false })
      .expect(200);
    expect(preference.body).toEqual({
      emailEnabled: false,
      emailAvailable: true,
    });
    await grant(admin, {
      delegatorId: coordId,
      delegateId: deputyId,
      validFrom: day(0),
      validTo: day(1),
    }).expect(201);
    expect((await notificationsOf(deputy))[0]).toMatchObject({
      emailStatus: 'SKIPPED',
    });
  });

  it('reminds current approvers once per cycle and escalates repeats to R1 (US-116)', async () => {
    const maintenance = app.get(ApprovalMaintenanceService);
    const submitted = await pendingRequest();
    const age = (days: number) =>
      prisma.changeRequest.update({
        where: { id: submitted.id },
        data: { levelEnteredAt: new Date(Date.now() - days * MS_PER_DAY) },
      });
    const remindersOf = async (agent: Agent) =>
      (await notificationsOf(agent)).filter(
        (row) =>
          row.notificationType === 'REQUEST_DEADLINE_REMINDER' &&
          row.changeRequestId === submitted.id,
      ).length;

    await age(7);
    await maintenance.remind(todayDate());
    expect(await remindersOf(coord)).toBe(0); // 7 days is not yet "more than 7"

    await age(8);
    await maintenance.remind(todayDate());
    await maintenance.remind(todayDate());
    expect(await remindersOf(coord)).toBe(1);
    expect(await remindersOf(admin)).toBe(0);
    expect(await remindersOf(member)).toBe(0);

    await age(11);
    await maintenance.remind(todayDate());
    expect(await remindersOf(coord)).toBe(2);
    expect(await remindersOf(admin)).toBe(1);

    // Once decided, nobody is reminded again (AC3).
    await approveAs(coord, submitted.id);
    await age(20);
    const directorReminders = await prisma.notification.count({
      where: {
        recipientId: directorId,
        notificationType: 'REQUEST_DEADLINE_REMINDER',
      },
    });
    await maintenance.remind(todayDate());
    expect(await remindersOf(coord)).toBe(2);
    expect(
      await prisma.notification.count({
        where: {
          recipientId: directorId,
          notificationType: 'REQUEST_DEADLINE_REMINDER',
        },
      }),
    ).toBe(directorReminders + 1);
  });
});
