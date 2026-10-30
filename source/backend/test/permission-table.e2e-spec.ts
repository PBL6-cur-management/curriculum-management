import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestPostgres, TestRedis } from './containers.js';
import request from 'supertest';
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
import { NO_ROLE, PERMISSION_TABLE } from './permission-table.js';

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('permission table', () => {
  let postgres: TestPostgres;
  let redis: TestRedis;
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const agents = new Map<string, ReturnType<typeof request.agent>>();

  beforeAll(async () => {
    [postgres, redis] = await Promise.all([
      startPostgres({ vietnameseCollation: true }),
      startRedis(),
    ]);
    setAppEnv(postgres, redis);
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await seedAccessControl(prisma);
    const roleCodes = [
      ...new Set(
        PERMISSION_TABLE.flatMap((row) => [row.allowedRole, row.deniedRole]),
      ),
    ];
    const accounts = new Map<string, TestAccount>();
    for (const roleCode of roleCodes) {
      accounts.set(
        roleCode,
        await createAccount(
          app,
          `perm${roleCode.toLowerCase()}`,
          roleCode === NO_ROLE ? undefined : roleCode,
          roleCode === 'R2' ? { unitCode: 'KHOA_CNTT' } : undefined,
        ),
      );
    }
    for (const roleCode of roleCodes) {
      agents.set(roleCode, await loginAgent(app, accounts.get(roleCode)!));
    }
  });

  afterAll(async () => {
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
  });

  it.each(PERMISSION_TABLE)(
    '$permission allows $allowedRole and denies $deniedRole',
    async (testCase) => {
      const allowedAgent = agents.get(testCase.allowedRole)!;
      const deniedAgent = agents.get(testCase.deniedRole)!;
      const allowedResponse = await sendRequest(allowedAgent, testCase);
      expect(allowedResponse.status).not.toBe(403);
      const beforeDeniedCount = await countWrites(testCase.path);
      const beforeGraduationCounts = testCase.path.includes('graduation')
        ? await countGraduationWrites()
        : null;
      const deniedResponse = await sendRequest(deniedAgent, testCase);
      expect(deniedResponse.status).toBe(403);
      expect(deniedResponse.body.code).toBe('PERMISSION_DENIED');
      if (testCase.method !== 'get') {
        expect(await countWrites(testCase.path)).toBe(beforeDeniedCount);
        if (beforeGraduationCounts) {
          expect(await countGraduationWrites()).toEqual(beforeGraduationCounts);
        }
      }
    },
  );

  async function sendRequest(
    agent: ReturnType<typeof request.agent>,
    testCase: (typeof PERMISSION_TABLE)[number],
  ) {
    const path = testCase.path
      .replace(':userId', 'unknown-user')
      .replace(':assignmentId', 'unknown-assignment')
      .replace(':roleCode', 'R2')
      .replace(':permissionCode', 'course.view');
    const call = agent[testCase.method](path).set(CSRF);
    if (testCase.body) call.send(testCase.body);
    return call;
  }

  async function countWrites(path: string): Promise<number> {
    if (path.includes('graduation')) {
      return (await countGraduationWrites()).reduce(
        (total, count) => total + count,
        0,
      );
    }
    if (path.startsWith('/api/imports')) return prisma.importBatch.count();
    if (path.startsWith('/api/students')) {
      return prisma.programEnrollment.count();
    }
    if (path.startsWith('/api/org-units')) return prisma.orgUnit.count();
    if (path.startsWith('/api/semesters')) return prisma.semester.count();
    if (path.startsWith('/api/cohorts')) return prisma.cohort.count();
    if (path.includes('/versions')) return prisma.programVersion.count();
    if (path.endsWith('/comments')) return prisma.comment.count();
    if (path.startsWith('/api/change-requests')) {
      return prisma.changeRequest.count();
    }
    if (path.startsWith('/api/clos') || path.includes('/clos')) {
      return prisma.cLO.count();
    }
    if (path.startsWith('/api/plos') || path.endsWith('/plos')) {
      return prisma.pLO.count();
    }
    if (path.includes('/plo-weights')) return prisma.coursePLOMapping.count();
    if (path.endsWith('/clo-plo-links')) return prisma.cLOPLOMapping.count();
    if (path.includes('/syllabus') || path.startsWith('/api/syllabi')) {
      return prisma.syllabus.count();
    }
    if (path.startsWith('/api/weekly-contents')) {
      return prisma.weeklyContent.count();
    }
    if (path.startsWith('/api/courses')) return prisma.course.count();
    if (path.startsWith('/api/course-relations')) {
      return prisma.courseRelation.count();
    }
    if (path.startsWith('/api/equivalence-groups')) {
      return prisma.equivalentCourseGroup.count();
    }
    if (path.includes('/cohort-versions')) return prisma.cohortVersion.count();
    if (path.startsWith('/api/programs')) {
      return path.includes('/directors')
        ? prisma.programDirectorAssignment.count()
        : prisma.program.count();
    }
    if (path.startsWith('/api/curriculum-items')) {
      return path.endsWith('/requisites')
        ? prisma.curriculumRequisite.count()
        : prisma.curriculumItem.count();
    }
    if (path.startsWith('/api/elective-groups')) {
      return prisma.electiveGroup.count();
    }
    if (path.startsWith('/api/program-versions')) {
      return path.includes('/elective-groups')
        ? prisma.electiveGroup.count()
        : prisma.curriculumItem.count();
    }
    if (path.startsWith('/api/subject-groups')) {
      return path.includes('/members')
        ? prisma.subjectGroupMember.count()
        : prisma.subjectGroup.count();
    }
    return path.startsWith('/api/users')
      ? prisma.user.count()
      : prisma.rolePermission.count();
  }

  async function countGraduationWrites(): Promise<number[]> {
    return Promise.all([
      prisma.graduationAuditContext.count(),
      prisma.graduationAudit.count(),
      prisma.graduationBatch.count(),
      prisma.graduationBatchItem.count(),
      prisma.graduationResultChangeReceipt.count(),
      prisma.graduationReauditTask.count(),
      prisma.notification.count(),
    ]);
  }
});
