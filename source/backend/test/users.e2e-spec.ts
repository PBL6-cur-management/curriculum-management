import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestPostgres, TestRedis } from './containers.js';
import request from 'supertest';
import { ScopeType } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { seedAccessControl } from '../prisma/seed-data/seed-access-control.js';
import {
  createAccount,
  loginAgent,
  type TestAccount,
} from './fixtures/accounts.js';
import { startPostgres, startRedis } from './containers.js';
import { setAppEnv } from './test-env.js';
import { createTestApp } from './test-app.js';
import { PERMISSION_TABLE } from './permission-table.js';
import { todayDate } from '../src/shared/time/today.js';

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };
function isoDayOffset(dayOffset: number): string {
  const date = todayDate();
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

describe('user account management', () => {
  let postgres: TestPostgres;
  let redis: TestRedis;
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: TestAccount;
  let adminAgent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    [postgres, redis] = await Promise.all([
      startPostgres({ vietnameseCollation: true }),
      startRedis(),
    ]);
    setAppEnv(postgres, redis);
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await seedAccessControl(prisma);
    admin = await createAccount(app, 'accountadmin', 'R1');
    adminAgent = await loginAgent(app, admin);
  });

  afterAll(async () => {
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
  });

  it('creates an account with a one-time temporary password', async () => {
    const response = await adminAgent
      .post('/api/users')
      .set(CSRF)
      .send({
        username: 'newuser',
        userCode: 'NEWUSER',
        fullName: 'Người dùng mới',
      })
      .expect(201);
    expect(response.body.temporaryPassword).toHaveLength(12);
    const login = await request
      .agent(app.getHttpServer())
      .post('/api/auth/login')
      .set(CSRF)
      .send({ username: 'newuser', password: response.body.temporaryPassword })
      .expect(200);
    expect(login.body.mustChangePassword).toBe(true);
    expect(login.body).not.toHaveProperty('temporaryPassword');
    expect(login.body).not.toHaveProperty('passwordHash');
  });

  it('returns a field-level duplicate username conflict', async () => {
    await adminAgent
      .post('/api/users')
      .set(CSRF)
      .send({ username: 'newuser', userCode: 'OTHER', fullName: 'Khác' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('USERNAME_TAKEN');
        expect(body.details[0].field).toBe('username');
      });
  });

  it('does not expose a delete endpoint', async () => {
    await adminAgent
      .delete('/api/users/nonexistent')
      .set(CSRF)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('NOT_FOUND'));
  });

  it('invalidates a disabled user session on its next request', async () => {
    const target = await createAccount(app, 'disableduser');
    const targetAgent = await loginAgent(app, target);

    await adminAgent
      .post(`/api/users/${target.id}/disable`)
      .set(CSRF)
      .expect(200);
    await targetAgent
      .get('/api/auth/me')
      .expect(401)
      .expect(({ body }) => expect(body.code).toBe('SESSION_REQUIRED'));
  });

  it('refuses self-disable', async () => {
    await adminAgent
      .post(`/api/users/${admin.id}/disable`)
      .set(CSRF)
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('CANNOT_DISABLE_SELF'));
  });

  it('documents every route as public, permission-checked, or explicitly authenticated', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    const paths = response.body.paths as Record<
      string,
      Record<string, unknown>
    >;
    const publicRoutes = new Set([
      '/api/health',
      '/api/auth/login',
      '/api/auth/logout',
      // dDUT API (F-21): authenticated by integration key, not by session.
      '/api/v1/sinh-vien/:mssv/chuong-trinh',
      '/api/v1/chuong-trinh/:maCT/phien-ban/:soPB',
      '/api/v1/hoc-phan/:maHP/de-cuong',
      '/api/v1/sinh-vien/:mssv/tien-do',
      '/api/v1/sinh-vien/:mssv/hoc-phan-du-dieu-kien',
      '/api/v1/sinh-vien/:mssv/xet-tot-nghiep',
    ]);
    const authenticatedRoutes = new Set([
      '/api/auth/me',
      '/api/auth/change-password',
      '/api/org-units',
      '/api/notifications',
      '/api/notifications/unread-count',
      '/api/notifications/preferences',
      '/api/approval-delegations',
      '/api/approval-delegations/access',
      '/api/notifications/read-all',
      '/api/notifications/:id/read',
      // Selectors of the release forms: names and dates, no personal data (F-15).
      '/api/semesters',
      '/api/cohorts',
    ]);
    for (const [path, operations] of Object.entries(paths)) {
      const normalizedPath = path.replace(
        /\{[^}]+\}/g,
        (parameter) => `:${parameter.slice(1, -1)}`,
      );
      const routeSegments = normalizedPath.split('/');
      for (const method of Object.keys(operations)) {
        if (method === 'parameters') continue;
        expect(
          publicRoutes.has(normalizedPath) ||
            authenticatedRoutes.has(normalizedPath) ||
            PERMISSION_TABLE.some((entry) => {
              const entrySegments = entry.path.split('?')[0].split('/');
              return (
                entry.method === method &&
                entrySegments.length === routeSegments.length &&
                routeSegments.every((segment, index) =>
                  segment.startsWith(':')
                    ? entrySegments[index].length > 0
                    : entrySegments[index] === segment,
                )
              );
            }),
          `${method.toUpperCase()} ${path} has no authorization coverage`,
        ).toBe(true);
      }
    }
  });

  it('exposes only active roles and denies expired or scheduled permissions', async () => {
    const expired = await createAccount(app, 'expireduser');
    const scheduled = await createAccount(app, 'scheduleduser');
    const r1 = await prisma.role.findUniqueOrThrow({
      where: { roleCode: 'R1' },
    });
    await prisma.roleAssignment.createMany({
      data: [
        {
          userId: expired.id,
          roleId: r1.id,
          scopeType: ScopeType.SYSTEM,
          validFrom: new Date(`${isoDayOffset(-30)}T00:00:00.000Z`),
          validTo: new Date(`${isoDayOffset(-1)}T00:00:00.000Z`),
        },
        {
          userId: scheduled.id,
          roleId: r1.id,
          scopeType: ScopeType.SYSTEM,
          validFrom: new Date(`${isoDayOffset(1)}T00:00:00.000Z`),
        },
      ],
    });
    const expiredAgent = await loginAgent(app, expired);
    const scheduledAgent = await loginAgent(app, scheduled);

    for (const agent of [expiredAgent, scheduledAgent]) {
      const me = await agent.get('/api/auth/me').expect(200);
      expect(me.body.permissions).not.toContain('user.manage');
      await agent.get('/api/users').expect(403);
    }
  });

  it('keeps only a currently active role when another role ended yesterday', async () => {
    const target = await createAccount(app, 'mixedroles', 'R2', {
      unitCode: 'KHOA_CNTT',
    });
    const r1 = await prisma.role.findUniqueOrThrow({
      where: { roleCode: 'R1' },
    });
    await prisma.roleAssignment.create({
      data: {
        userId: target.id,
        roleId: r1.id,
        scopeType: ScopeType.SYSTEM,
        validFrom: new Date(`${isoDayOffset(-30)}T00:00:00.000Z`),
        validTo: new Date(`${isoDayOffset(-1)}T00:00:00.000Z`),
      },
    });
    const agent = await loginAgent(app, target);
    const me = await agent.get('/api/auth/me').expect(200);

    expect(
      me.body.roles.map((role: { roleCode: string }) => role.roleCode),
    ).toEqual(['R2']);
    await agent.get('/api/users').expect(403);
  });

  it('re-evaluates revoked grants immediately for an existing session', async () => {
    const target = await createAccount(app, 'revokeduser', 'R1');
    const targetAgent = await loginAgent(app, target);
    const assignment = await prisma.roleAssignment.findFirstOrThrow({
      where: { userId: target.id, revokedAt: null },
    });
    await prisma.roleAssignment.update({
      where: { id: assignment.id },
      data: { revokedAt: new Date(), revokedById: admin.id },
    });

    await targetAgent
      .get('/api/users')
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('PERMISSION_DENIED'));
  });

  it('keeps assignment history and records grantor and revoker', async () => {
    const target = await createAccount(app, 'historyuser', 'R2', {
      unitCode: 'KHOA_CNTT',
    });
    const r1 = await prisma.role.findUniqueOrThrow({
      where: { roleCode: 'R1' },
    });
    const assigned = await adminAgent
      .post(`/api/users/${target.id}/role-assignments`)
      .set(CSRF)
      .send({
        roleId: r1.id,
        scopeType: 'SYSTEM',
        validFrom: isoDayOffset(0),
      })
      .expect(201);
    await adminAgent
      .post(
        `/api/users/${target.id}/role-assignments/${assigned.body.id}/revoke`,
      )
      .set(CSRF)
      .expect(200);
    await adminAgent
      .post(`/api/users/${target.id}/role-assignments`)
      .set(CSRF)
      .send({
        roleId: r1.id,
        scopeType: 'SYSTEM',
        validFrom: isoDayOffset(1),
      })
      .expect(201);

    const history = await adminAgent
      .get(`/api/users/${target.id}/role-assignments`)
      .expect(200);
    expect(history.body).toHaveLength(3);
    expect(history.body.map((row: { state: string }) => row.state)).toContain(
      'REVOKED',
    );
    expect(history.body[0].assignedBy.fullName).toBe('accountadmin');
    expect(history.body[1].revokedBy.fullName).toBe('accountadmin');
    expect(history.body[2].assignedBy).toBeNull();
  });

  it('allows matrix edits but protects the two locked cells', async () => {
    const r2 = await prisma.role.findUniqueOrThrow({
      where: { roleCode: 'R2' },
    });
    await adminAgent
      .delete('/api/roles/R2/permissions/course.view')
      .set(CSRF)
      .expect(204);
    await expect(
      prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: r2.id,
            permissionId: (
              await prisma.permission.findUniqueOrThrow({
                where: { permissionCode: 'course.view' },
              })
            ).id,
          },
        },
      }),
    ).resolves.toBeNull();
    await adminAgent
      .delete('/api/roles/R1/permissions/user.manage')
      .set(CSRF)
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('MATRIX_CELL_LOCKED'));
  });
});
