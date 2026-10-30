import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Prisma,
  ScopeSource,
  ScopeType,
} from '../../generated/prisma/client.js';
import { AccessContext } from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { AppException } from '../../shared/exception/app.exception.js';
import type { GraduationAuditWriter } from '../../shared/graduation/graduation-audit.writer.js';
import { evaluateGraduation } from '../../shared/graduation/graduation-engine.js';
import { encodeGraduationInput } from '../../shared/graduation/graduation-input.codec.js';
import type { GraduationInputSnapshot } from '../../shared/graduation/graduation-input.types.js';
import type { GraduationNotificationsWriter } from '../../shared/graduation/graduation-notifications.writer.js';
import { GRADUATION_LIMITS } from '../../shared/graduation/graduation.constants.js';
import { GRADUATION_ERRORS } from '../../shared/graduation/graduation.errors.js';
import type { GraduationAuditValue } from '../../shared/graduation/graduation.types.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import type { AcademicResultsReader } from '../../shared/students/academic-results.reader.js';
import type { StudentAppliedVersionReader } from '../../shared/students/student-applied-version.reader.js';
import { GraduationLeaseLostError } from './graduation-jobs.constants.js';
import {
  GraduationReauditRunner,
  graduationAttemptsCoverChange,
} from './graduation-reaudit.runner.js';
import { GraduationReauditService } from './graduation-reaudit.service.js';
import type { GraduationScheduler } from './graduation.scheduler.js';

beforeEach(() => {
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function inputFixture(): GraduationInputSnapshot {
  const course = {
    id: 'course',
    courseCode: 'SYN101',
    courseName: 'Học phần tổng hợp',
  };
  return {
    schemaVersion: 1,
    ruleVersion: 'graduation-v1',
    context: {
      studentId: 'student',
      programId: 'program',
      semesterId: 'semester',
      enrollmentId: 'enrollment',
      studentCode: 'SYN001',
      fullName: 'Sinh viên tổng hợp',
      programCode: 'SYN-P',
      programName: 'Chương trình tổng hợp',
      cohortId: 'cohort',
      cohortCode: 'SYN-C',
      programVersionId: 'version',
      versionNumber: '1.0',
      semesterCode: 'SYN-2026',
      semesterStartDate: '2026-09-01T00:00:00.000Z',
      versionSource: 'COHORT',
      cohortAssignmentId: 'assignment',
    },
    version: {
      totalCredits: '3',
      compulsoryCredits: '3',
      electiveCredits: '0',
    },
    frame: [
      {
        id: 'item',
        course,
        credits: '3',
        courseType: 'THEORY',
        isElective: false,
        electiveGroupId: null,
        blockSymbol: null,
        plannedSemester: 1,
        sortOrder: 0,
      },
    ],
    groups: [],
    blocks: [],
    courses: [
      {
        course,
        courseType: 'THEORY',
        credits: '3',
        creditBasis: 'APPLIED_VERSION_SNAPSHOT',
        equivalenceGroupId: null,
      },
    ],
    attempts: [
      {
        id: 'result',
        revision: 1,
        courseId: 'course',
        semesterId: 'semester',
        dataSource: 'EXCEL',
        semesterStartDate: '2026-09-01T00:00:00.000Z',
        score10: '8',
        score4: '3',
        letterGrade: 'B',
        status: 'PASSED',
      },
    ],
  };
}

describe('graduationAttemptsCoverChange', () => {
  it('covers an older event only when every relevant current result revision is represented', () => {
    expect(
      graduationAttemptsCoverChange(
        [{ id: 'result', revision: 3 }],
        [{ id: 'result', revision: 3 }],
        'result',
        2,
      ),
    ).toBe(true);
    expect(
      graduationAttemptsCoverChange(
        [{ id: 'result', revision: 1 }],
        [{ id: 'result', revision: 2 }],
        'result',
        2,
      ),
    ).toBe(false);
    expect(
      graduationAttemptsCoverChange(
        [{ id: 'result', revision: 2 }],
        [
          { id: 'result', revision: 2 },
          { id: 'new', revision: 1 },
        ],
        'result',
        2,
      ),
    ).toBe(false);
    expect(
      graduationAttemptsCoverChange(
        [{ id: 'result', revision: 2 }],
        [],
        'result',
        2,
      ),
    ).toBe(false);
    expect(graduationAttemptsCoverChange([], [], 'result', 1)).toBe(false);
    expect(
      graduationAttemptsCoverChange(
        [
          { id: 'result', revision: 2 },
          { id: 'result', revision: 2 },
        ],
        [{ id: 'result', revision: 2 }],
        'result',
        2,
      ),
    ).toBe(false);
  });
});

describe('GraduationReauditRunner', () => {
  function fixture() {
    const stored = inputFixture();
    const fresh = structuredClone(stored);
    Object.assign(fresh.attempts[0], {
      revision: 2,
      score10: '3',
      score4: '0',
      letterGrade: 'F',
      status: 'FAILED',
    });
    const head = {
      id: 'head',
      conclusion: 'ELIGIBLE',
      inputs: encodeGraduationInput(stored),
    };
    const task = {
      id: 'task',
      contextId: 'context',
      attempts: 0,
      status: 'PENDING',
      leaseToken: null as string | null,
      leaseUntil: null as Date | null,
      errorCode: null as string | null,
      completedAuditId: null as string | null,
      context: {
        id: 'context',
        studentId: 'student',
        programId: 'program',
        semesterId: 'semester',
        lastAudit: head,
      },
      receipt: { change: { academicResultId: 'result', revision: 2 } },
    };
    const evidence = {
      audits: [] as string[],
      notifications: 0,
      loseFence: false,
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'task' }]),
      $executeRaw: vi.fn(
        async (_strings: TemplateStringsArray, ...values: unknown[]) => {
          if (evidence.loseFence) return 0;
          task.status = String(values[0]);
          task.attempts += 1;
          task.completedAuditId = String(values[1]);
          task.leaseToken = null;
          task.leaseUntil = null;
          return 1;
        },
      ),
      graduationReauditTask: {
        findUniqueOrThrow: vi.fn().mockImplementation(async () => task),
      },
    };
    const prisma = {
      $executeRaw: vi.fn(
        async (_strings: TemplateStringsArray, ...values: unknown[]) => {
          if (!['PENDING', 'RUNNING'].includes(task.status)) return 0;
          if (
            task.status === 'RUNNING' &&
            task.leaseUntil &&
            task.leaseUntil.getTime() > Date.now()
          )
            return 0;
          task.status = 'RUNNING';
          task.leaseToken = String(values[0]);
          task.leaseUntil = new Date(Date.now() + 60_000);
          return 1;
        },
      ),
      $transaction: vi.fn(
        async (work: (value: typeof tx) => Promise<unknown>) => {
          const before = {
            task: { ...task },
            audits: [...evidence.audits],
            notifications: evidence.notifications,
          };
          try {
            return await work(tx);
          } catch (error) {
            Object.assign(task, before.task);
            evidence.audits = before.audits;
            evidence.notifications = before.notifications;
            throw error;
          }
        },
      ),
      graduationReauditTask: {
        findUnique: vi.fn().mockImplementation(async () => task),
        findMany: vi.fn().mockResolvedValue([{ id: 'task', attempts: 0 }]),
        updateMany: vi.fn(
          async (args: {
            where: { leaseToken?: string };
            data: Omit<Partial<typeof task>, 'attempts'> & {
              attempts?: { increment: number };
            };
          }) => {
            if (
              args.where.leaseToken &&
              args.where.leaseToken !== task.leaseToken
            )
              return { count: 0 };
            const { attempts, ...data } = args.data;
            task.attempts += attempts?.increment ?? 0;
            Object.assign(task, data);
            return { count: 1 };
          },
        ),
      },
    };
    const versions = {
      forReauditTask: vi.fn().mockResolvedValue({
        lookup: {
          studentId: 'student',
          programId: 'program',
          semesterId: 'semester',
        },
        resolveForStudent: vi.fn(),
      }),
    };
    const results = {
      forReauditTask: vi.fn().mockResolvedValue({
        forStudent: vi.fn().mockImplementation(async () => fresh.attempts),
      }),
    };
    const audit: GraduationAuditValue = {
      id: 'new-audit',
      contextId: 'context',
      enrollmentId: 'enrollment',
      programVersionId: 'version',
      auditedAt: '2026-10-30T00:00:00.000Z',
      auditedBy: null,
      trigger: 'RESULT_CHANGE',
      supersedesId: 'head',
      inputDigest: 'digest',
      result: evaluateGraduation(fresh, '2026-10-30T00:00:00.000Z'),
      freshness: 'CURRENT',
    };
    const writer = {
      append: vi.fn(async (_tx: unknown, _input: unknown) => {
        evidence.audits.push(audit.id);
        return audit;
      }),
    };
    const notifications = {
      conclusionChanged: vi.fn(async (_tx: unknown, _input: unknown) => {
        evidence.notifications += 1;
        return 1;
      }),
    };
    const scheduler = { enqueueReaudit: vi.fn().mockResolvedValue(undefined) };
    const runner = new GraduationReauditRunner(
      prisma as unknown as PrismaService,
      versions as unknown as StudentAppliedVersionReader,
      results as unknown as AcademicResultsReader,
      writer as unknown as GraduationAuditWriter,
      notifications as unknown as GraduationNotificationsWriter,
      scheduler as unknown as GraduationScheduler,
    );
    return {
      runner,
      prisma,
      tx,
      versions,
      results,
      writer,
      notifications,
      scheduler,
      stored,
      fresh,
      head,
      task,
      evidence,
      audit,
    };
  }

  it('uses restricted facades and commits current audit, head/task linkage and notice together', async () => {
    const {
      runner,
      tx,
      versions,
      results,
      writer,
      notifications,
      task,
      evidence,
    } = fixture();
    await runner.run('task');
    expect(versions.forReauditTask).toHaveBeenCalledWith(
      'task',
      expect.any(String),
      tx,
    );
    expect(results.forReauditTask).toHaveBeenCalledWith(
      'task',
      expect.any(String),
      tx,
    );
    expect(writer.append).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        trigger: 'RESULT_CHANGE',
        actorId: null,
        operationKey: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(notifications.conclusionChanged).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        auditId: 'new-audit',
        previous: 'ELIGIBLE',
        next: 'NOT_ELIGIBLE',
      }),
    );
    expect(task).toMatchObject({
      status: 'COMPLETED',
      completedAuditId: 'new-audit',
      leaseToken: null,
    });
    expect(evidence).toMatchObject({ audits: ['new-audit'], notifications: 1 });
    expect(
      notifications.conclusionChanged.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.$executeRaw.mock.invocationCallOrder[0]);
  });

  it('duplicate delivery cannot append or notify twice', async () => {
    const { runner, writer, notifications } = fixture();
    await runner.run('task');
    await runner.run('task');
    expect(writer.append).toHaveBeenCalledOnce();
    expect(notifications.conclusionChanged).toHaveBeenCalledOnce();
  });

  it('marks older/out-of-order events covered by a newer current head without appending', async () => {
    const { runner, head, fresh, writer, notifications, task } = fixture();
    fresh.attempts[0]!.revision = 3;
    head.inputs = encodeGraduationInput(fresh);
    await runner.run('task');
    expect(task).toMatchObject({ status: 'COVERED', completedAuditId: 'head' });
    expect(writer.append).not.toHaveBeenCalled();
    expect(notifications.conclusionChanged).not.toHaveBeenCalled();
  });

  it('still appends changed input when the conclusion is unchanged and emits no notice', async () => {
    const { runner, head, writer, notifications } = fixture();
    head.conclusion = 'NOT_ELIGIBLE';
    await runner.run('task');
    expect(writer.append).toHaveBeenCalledOnce();
    expect(notifications.conclusionChanged).not.toHaveBeenCalled();
  });

  it('compares against the actual current head rather than a receipt baseline', async () => {
    const { runner, head, notifications } = fixture();
    head.id = 'intervening-staff-head';
    head.conclusion = 'NOT_ELIGIBLE';
    await runner.run('task');
    expect(notifications.conclusionChanged).not.toHaveBeenCalled();
  });

  it('rolls audit and notification back when the final database-clock fence loses', async () => {
    const { runner, evidence, task, prisma } = fixture();
    evidence.loseFence = true;
    await expect(runner.run('task')).rejects.toBeInstanceOf(
      GraduationLeaseLostError,
    );
    expect(evidence).toMatchObject({ audits: [], notifications: 0 });
    expect(task.status).toBe('RUNNING');
    expect(prisma.graduationReauditTask.updateMany).not.toHaveBeenCalled();
  });

  it('rolls append back when notifications fail and leaves work retryable', async () => {
    const { runner, notifications, evidence, task } = fixture();
    notifications.conclusionChanged.mockRejectedValue(
      new Error('synthetic notification insert'),
    );
    await expect(runner.run('task')).rejects.toThrow('synthetic notification');
    expect(evidence.audits).toEqual([]);
    expect(task).toMatchObject({ status: 'PENDING', errorCode: null });
  });

  it('preserves the old head and marks operational evaluation inability FAILED', async () => {
    const { runner, writer, head, task, evidence } = fixture();
    writer.append.mockRejectedValue(
      new AppException(GRADUATION_ERRORS.SNAPSHOT_INCOMPLETE),
    );
    await runner.run('task');
    expect(task).toMatchObject({
      status: 'FAILED',
      errorCode: 'GRADUATION_SNAPSHOT_INCOMPLETE',
      completedAuditId: null,
    });
    expect(head.id).toBe('head');
    expect(evidence).toMatchObject({ audits: [], notifications: 0 });
  });

  it('fails an infrastructure error after the named attempt budget', async () => {
    const { runner, writer, task } = fixture();
    task.attempts = 2;
    writer.append.mockRejectedValue(new Error('synthetic database'));
    await expect(runner.run('task')).rejects.toThrow('synthetic database');
    expect(task).toMatchObject({
      status: 'FAILED',
      attempts: 3,
      errorCode: 'GRADUATION_JOB_FAILED',
    });
  });

  it.each(['40001', '40P01'])(
    'defers exhausted %s conflicts without consuming the last failure attempt or changing audit evidence',
    async (sqlState) => {
      const { runner, notifications, prisma, task, evidence } = fixture();
      task.attempts = GRADUATION_LIMITS.JOB_ATTEMPTS - 1;
      notifications.conclusionChanged.mockImplementation(async () => {
        evidence.notifications += 1;
        throw new Prisma.PrismaClientKnownRequestError('private body', {
          clientVersion: '7',
          code: 'P2010',
          meta: { code: sqlState },
        });
      });
      await expect(runner.run('task')).resolves.toBeUndefined();
      expect(prisma.$transaction).toHaveBeenCalledTimes(
        GRADUATION_LIMITS.TRANSACTION_RETRIES + 1,
      );
      expect(task).toMatchObject({
        status: 'PENDING',
        attempts: GRADUATION_LIMITS.JOB_ATTEMPTS - 1,
        leaseToken: null,
        leaseUntil: null,
        errorCode: null,
        completedAuditId: null,
      });
      expect(evidence).toMatchObject({ audits: [], notifications: 0 });
      expect(Logger.prototype.error).not.toHaveBeenCalled();
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.stringContaining(`sqlState=${sqlState}`),
      );
      notifications.conclusionChanged.mockImplementation(async () => {
        evidence.notifications += 1;
        return 1;
      });
      await runner.run('task');
      expect(task).toMatchObject({
        status: 'COMPLETED',
        attempts: GRADUATION_LIMITS.JOB_ATTEMPTS,
      });
      expect(evidence).toMatchObject({
        audits: ['new-audit'],
        notifications: 1,
      });
    },
  );

  it('retries a transient transaction conflict without duplicating the audit or notice', async () => {
    const { runner, notifications, prisma, task, evidence } = fixture();
    notifications.conclusionChanged.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('private body', {
        clientVersion: '7',
        code: 'P2034',
      }),
    );
    await runner.run('task');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(task).toMatchObject({ status: 'COMPLETED', attempts: 1 });
    expect(evidence).toMatchObject({ audits: ['new-audit'], notifications: 1 });
    expect(Logger.prototype.error).not.toHaveBeenCalled();
  });

  it('bounds lease-claim conflict retries without consuming an attempt or failing the job', async () => {
    const { runner, prisma, task, writer } = fixture();
    prisma.$executeRaw.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('private body', {
        clientVersion: '7',
        code: 'P2010',
        meta: { code: '40001' },
      }),
    );
    await expect(runner.run('task')).resolves.toBeUndefined();
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(
      GRADUATION_LIMITS.TRANSACTION_RETRIES + 1,
    );
    expect(task).toMatchObject({
      status: 'PENDING',
      attempts: 0,
      leaseToken: null,
    });
    expect(writer.append).not.toHaveBeenCalled();
    expect(Logger.prototype.error).not.toHaveBeenCalled();
    expect(Logger.prototype.warn).toHaveBeenCalled();
  });

  it('leaves an uncharged lease recoverable if conflict deferral also keeps conflicting', async () => {
    const { runner, writer, prisma, task, scheduler, evidence } = fixture();
    task.attempts = GRADUATION_LIMITS.JOB_ATTEMPTS - 1;
    const failure = new Prisma.PrismaClientKnownRequestError('private body', {
      clientVersion: '7',
      code: 'P2034',
    });
    writer.append.mockRejectedValue(failure);
    prisma.graduationReauditTask.updateMany.mockRejectedValue(failure);
    await expect(runner.run('task')).resolves.toBeUndefined();
    expect(prisma.graduationReauditTask.updateMany).toHaveBeenCalledTimes(
      GRADUATION_LIMITS.TRANSACTION_RETRIES + 1,
    );
    expect(task).toMatchObject({
      status: 'RUNNING',
      attempts: GRADUATION_LIMITS.JOB_ATTEMPTS - 1,
    });
    expect(evidence).toMatchObject({ audits: [], notifications: 0 });
    task.leaseUntil = new Date(0);
    prisma.graduationReauditTask.findMany.mockResolvedValue([
      { id: 'task', attempts: task.attempts },
    ]);
    await expect(runner.recover()).resolves.toBe(1);
    expect(scheduler.enqueueReaudit).toHaveBeenCalledWith('task');
    expect(Logger.prototype.error).not.toHaveBeenCalled();
  });

  it('never releases a successor lease when deferring a conflict', async () => {
    const { runner, prisma, task } = fixture();
    prisma.$transaction.mockImplementation(async () => {
      task.leaseToken = 'successor-token';
      throw new Prisma.PrismaClientKnownRequestError('private body', {
        clientVersion: '7',
        code: 'P2034',
      });
    });
    await expect(runner.run('task')).resolves.toBeUndefined();
    expect(task).toMatchObject({
      status: 'RUNNING',
      leaseToken: 'successor-token',
      attempts: 0,
    });
    expect(Logger.prototype.error).not.toHaveBeenCalled();
  });

  it('bounds recovery query conflicts and leaves tasks for the next repeat schedule', async () => {
    const { runner, prisma, scheduler, task } = fixture();
    prisma.graduationReauditTask.findMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('private body', {
        clientVersion: '7',
        code: 'P2034',
      }),
    );
    await expect(runner.recover()).resolves.toBe(0);
    expect(prisma.graduationReauditTask.findMany).toHaveBeenCalledTimes(
      GRADUATION_LIMITS.TRANSACTION_RETRIES + 1,
    );
    expect(scheduler.enqueueReaudit).not.toHaveBeenCalled();
    expect(task).toMatchObject({ status: 'PENDING', attempts: 0 });
    expect(Logger.prototype.error).not.toHaveBeenCalled();
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining('phase=RECOVER'),
    );
  });

  it('recovers missing queue deliveries and fences exhausted expired leases', async () => {
    const { runner, scheduler, prisma } = fixture();
    await expect(runner.recover()).resolves.toBe(1);
    expect(scheduler.enqueueReaudit).toHaveBeenCalledExactlyOnceWith('task');
    prisma.graduationReauditTask.findMany.mockResolvedValue([
      { id: 'exhausted', attempts: 3 },
    ]);
    await runner.recover();
    expect(prisma.graduationReauditTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'exhausted' }),
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });

  it('detects lease expiration while waiting before the restricted read', async () => {
    const { runner, tx, versions, writer } = fixture();
    tx.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    await expect(runner.run('task')).rejects.toBeInstanceOf(
      GraduationLeaseLostError,
    );
    expect(versions.forReauditTask).not.toHaveBeenCalled();
    expect(writer.append).not.toHaveBeenCalled();
  });
});

describe('GraduationReauditService', () => {
  function access(roleCode = 'R1'): AccessContext {
    return new AccessContext('office', [
      {
        assignmentId: 'assignment',
        roleId: roleCode,
        roleCode,
        roleName: roleCode,
        scopeSource: ScopeSource.NONE,
        scopeType: ScopeType.SYSTEM,
        scopeUnit: null,
        scope: { all: true },
        permissions: new Map([
          [PERMISSIONS.GRADUATION_AUDIT, { mode: 'DIRECT', scope: 'ALL' }],
        ]),
      },
    ]);
  }
  function fixture() {
    const task = {
      id: 'task',
      contextId: 'context',
      status: 'FAILED',
      attempts: 3,
      completedAuditId: null,
      errorCode: 'OLD_ERROR',
      context: { programId: 'program' },
      leaseToken: null,
      leaseUntil: null,
      createdAt: new Date(),
      finishedAt: new Date(),
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'task' }]),
      graduationReauditTask: {
        findUnique: vi.fn().mockResolvedValue(task),
        update: vi.fn(async (args: { data: object }) => ({
          ...task,
          ...args.data,
        })),
        findMany: vi.fn().mockResolvedValue([task]),
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const prisma = {
      $transaction: vi.fn(
        async (work: (value: typeof tx) => Promise<unknown>) => work(tx),
      ),
    };
    const scheduler = { enqueueReaudit: vi.fn().mockResolvedValue(undefined) };
    return {
      task,
      tx,
      scheduler,
      service: new GraduationReauditService(
        prisma as unknown as PrismaService,
        scheduler as unknown as GraduationScheduler,
      ),
    };
  }

  it('retries FAILED only, resets its attempt budget and excludes private feed/lease fields', async () => {
    const { service, scheduler } = fixture();
    await expect(service.retry(access(), 'task')).resolves.toEqual({
      id: 'task',
      contextId: 'context',
      status: 'PENDING',
      attempts: 0,
      completedAuditId: null,
      errorCode: null,
    });
    expect(scheduler.enqueueReaudit).toHaveBeenCalledExactlyOnceWith('task');
  });
  it.each(['PENDING', 'RUNNING', 'COMPLETED', 'COVERED'])(
    'returns %s idempotently without overwriting academic history',
    async (status) => {
      const { service, task, tx } = fixture();
      task.status = status;
      await expect(service.retry(access(), 'task')).resolves.toMatchObject({
        status,
      });
      expect(tx.graduationReauditTask.update).not.toHaveBeenCalled();
    },
  );
  it('rejects R3 retry/list access even with a graduation grant', async () => {
    const { service, tx } = fixture();
    await expect(service.retry(access('R3'), 'task')).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
    await expect(
      service.list(
        access('R3'),
        { studentId: 'student', programId: 'program', semesterId: 'semester' },
        { page: 1, pageSize: 20 },
      ),
    ).rejects.toThrow();
    expect(tx.graduationReauditTask.findUnique).not.toHaveBeenCalled();
  });
  it('returns 404 for a guessed task and supports exact-context paginated listing', async () => {
    const { service, tx } = fixture();
    tx.graduationReauditTask.findUnique.mockResolvedValue(null);
    await expect(service.retry(access(), 'guessed')).rejects.toMatchObject({
      code: 'GRADUATION_ACCESS_REVOKED',
    });
    const lookup = {
      studentId: 'student',
      programId: 'program',
      semesterId: 'semester',
    };
    const page = await service.list(access(), lookup, {
      page: 2,
      pageSize: 20,
    });
    expect(page).toMatchObject({ total: 1, page: 2, pageSize: 20 });
    expect(tx.graduationReauditTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { context: lookup },
        skip: 20,
        take: 20,
      }),
    );
    expect(Object.keys(page.items[0]!)).toEqual([
      'id',
      'contextId',
      'status',
      'attempts',
      'completedAuditId',
      'errorCode',
    ]);
  });
  it('keeps retry durable when Redis enqueue fails', async () => {
    const { service, scheduler } = fixture();
    scheduler.enqueueReaudit.mockRejectedValue(new Error('synthetic redis'));
    await expect(service.retry(access(), 'task')).resolves.toMatchObject({
      status: 'PENDING',
    });
  });
});
