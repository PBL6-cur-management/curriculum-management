import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { GRADUATION_LIMITS } from '../../shared/graduation/graduation.constants.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import {
  GraduationResultChangeScanner,
  validateAcademicResultChangeSnapshot,
} from './graduation-result-change.scanner.js';
import type { GraduationScheduler } from './graduation.scheduler.js';

const snapshot = {
  score10: '8.5',
  score4: '3.5',
  letterGrade: 'B+',
  status: 'PASSED',
  dataSource: 'EXCEL',
};
beforeEach(() => {
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('AcademicResultChange snapshots', () => {
  it('accepts exactly the five actual producer fields, including nullable grades', () => {
    expect(() => validateAcademicResultChangeSnapshot(snapshot)).not.toThrow();
    expect(() =>
      validateAcademicResultChangeSnapshot({
        score10: null,
        score4: null,
        letterGrade: null,
        status: 'EXEMPT',
        dataSource: 'SCHOOL_DB',
      }),
    ).not.toThrow();
  });
  it.each([
    null,
    [],
    { ...snapshot, studentId: 'not-a-snapshot-field' },
    { score10: '8', score4: '3', status: 'PASSED', dataSource: 'EXCEL' },
    { ...snapshot, score10: 8 },
    { ...snapshot, score10: '-1' },
    { ...snapshot, score10: '11' },
    { ...snapshot, score4: 'NaN' },
    { ...snapshot, score4: '4.1' },
    { ...snapshot, status: 'UNKNOWN' },
    { ...snapshot, dataSource: 'UNKNOWN' },
    { ...snapshot, letterGrade: 5 },
  ])('rejects malformed evidence without inventing identity: %j', (value) => {
    expect(() => validateAcademicResultChangeSnapshot(value)).toThrow();
  });
});

describe('GraduationResultChangeScanner', () => {
  function fixture() {
    const change = {
      id: 'change',
      revision: 2,
      academicResultId: 'result',
      before: snapshot,
      after: { ...snapshot, status: 'FAILED' },
      academicResult: {
        studentId: 'student',
        courseId: 'course',
        semesterId: 'semester-before',
        semester: { startDate: new Date('2026-01-01') },
      },
    };
    const contexts = [
      {
        id: 'context-major',
        programId: 'program-major',
        lastAuditId: 'audit-major',
        semester: { startDate: new Date('2026-09-01') },
      },
      {
        id: 'context-historical',
        programId: 'program-second',
        lastAuditId: 'audit-historical',
        semester: { startDate: new Date('2026-01-01') },
      },
    ];
    const committed = { receipts: 0, tasks: [] as string[] };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'change' }]),
      academicResultChange: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(change),
      },
      graduationResultChangeReceipt: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(async () => {
          committed.receipts += 1;
          return {};
        }),
      },
      graduationAuditContext: { findMany: vi.fn().mockResolvedValue(contexts) },
      graduationReauditTask: {
        create: vi.fn(async (_args: unknown) => {
          const id = `task-${committed.tasks.length}`;
          committed.tasks.push(id);
          return { id };
        }),
      },
    };
    const prisma = {
      academicResultChange: {
        findMany: vi.fn().mockResolvedValue([{ id: 'change' }]),
      },
      $transaction: vi.fn(
        async (work: (value: typeof tx) => Promise<unknown>) => {
          const before = {
            receipts: committed.receipts,
            tasks: [...committed.tasks],
          };
          try {
            return await work(tx);
          } catch (error) {
            committed.receipts = before.receipts;
            committed.tasks = before.tasks;
            throw error;
          }
        },
      ),
    };
    const scheduler = { enqueueReaudit: vi.fn().mockResolvedValue(undefined) };
    const scanner = new GraduationResultChangeScanner(
      prisma as unknown as PrismaService,
      scheduler as unknown as GraduationScheduler,
    );
    return { scanner, prisma, tx, scheduler, change, contexts, committed };
  }

  it('derives immutable identity through the parent result and fans out all historical/dual-major heads atomically', async () => {
    const { scanner, tx, scheduler, committed } = fixture();
    await expect(scanner.scan()).resolves.toEqual({ receipts: 1, targets: 2 });
    expect(tx.academicResultChange.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          academicResult: expect.objectContaining({
            select: expect.objectContaining({
              studentId: true,
              courseId: true,
              semesterId: true,
            }),
          }),
        },
      }),
    );
    expect(tx.graduationAuditContext.findMany.mock.calls[0][0]).toMatchObject({
      where: {
        studentId: 'student',
        lastAuditId: { not: null },
        OR: [
          { semester: { startDate: { gte: new Date('2026-01-01') } } },
          { semester: { startDate: null } },
        ],
      },
    });
    expect(
      tx.graduationReauditTask.create.mock.calls.map((call) => call[0]),
    ).toEqual([
      {
        data: {
          changeId: 'change',
          contextId: 'context-major',
          baselineAuditId: 'audit-major',
        },
        select: { id: true },
      },
      {
        data: {
          changeId: 'change',
          contextId: 'context-historical',
          baselineAuditId: 'audit-historical',
        },
        select: { id: true },
      },
    ]);
    expect(committed).toEqual({ receipts: 1, tasks: ['task-0', 'task-1'] });
    expect(scheduler.enqueueReaudit).toHaveBeenCalledTimes(2);
    expect(tx.graduationAuditContext.findMany).toHaveBeenCalledTimes(2);
    const statements = tx.$queryRaw.mock.calls.map((call) =>
      (call[0] as TemplateStringsArray).join(''),
    );
    expect(statements[0]).toContain('FOR UPDATE SKIP LOCKED');
    expect(statements[1]).toContain('Program');
    expect(statements[2]).toContain('Student');
    expect(statements[3]).toContain('GraduationAuditContext');
  });

  it('never uses a high-water timestamp, so late older feed rows remain selectable', async () => {
    const { scanner, prisma, tx } = fixture();
    tx.graduationAuditContext.findMany.mockResolvedValue([]);
    await scanner.scan();
    await scanner.scan();
    for (const [query] of prisma.academicResultChange.findMany.mock.calls) {
      expect(query.where).toEqual({ graduationReceipt: null });
      expect(query.orderBy).toEqual([{ recordedAt: 'asc' }, { id: 'asc' }]);
    }
  });

  it('records a zero-target receipt without filtering by active enrollment or current status', async () => {
    const { scanner, tx } = fixture();
    tx.graduationAuditContext.findMany.mockResolvedValue([]);
    await expect(scanner.scan()).resolves.toEqual({ receipts: 1, targets: 0 });
    expect(tx.graduationResultChangeReceipt.create).toHaveBeenCalledWith({
      data: { changeId: 'change', targetCount: 0, reason: 'NO_PREVIOUS_AUDIT' },
    });
    expect(tx.graduationReauditTask.create).not.toHaveBeenCalled();
  });

  it('skips receipt replay and rows claimed concurrently by another scanner', async () => {
    const { scanner, tx } = fixture();
    tx.graduationResultChangeReceipt.findUnique.mockResolvedValue({
      changeId: 'change',
    });
    await expect(scanner.scan()).resolves.toEqual({ receipts: 0, targets: 0 });
    tx.$queryRaw.mockResolvedValue([]);
    await expect(scanner.scan()).resolves.toEqual({ receipts: 0, targets: 0 });
    expect(tx.graduationResultChangeReceipt.create).not.toHaveBeenCalled();
  });

  it('does not acknowledge an incomplete fan-out when a target insert fails', async () => {
    const { scanner, tx, committed, scheduler } = fixture();
    tx.graduationReauditTask.create.mockRejectedValueOnce(
      new Error('synthetic insert failure'),
    );
    await expect(scanner.scan()).rejects.toMatchObject({
      code: 'GRADUATION_JOB_FAILED',
    });
    expect(committed).toEqual({ receipts: 0, tasks: [] });
    expect(scheduler.enqueueReaudit).not.toHaveBeenCalled();
  });

  it('retains durable targets if enqueue fails after commit', async () => {
    const { scanner, scheduler, committed } = fixture();
    scheduler.enqueueReaudit.mockRejectedValue(
      new Error('synthetic redis unavailable'),
    );
    await expect(scanner.scan()).rejects.toMatchObject({
      code: 'GRADUATION_JOB_FAILED',
    });
    expect(committed).toEqual({ receipts: 1, tasks: ['task-0', 'task-1'] });
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'phase=ENQUEUE name=Error code=UNCLASSIFIED_EXECUTION',
      ),
    );
  });

  it.each(['40001', '40P01'])(
    'defers an exhausted %s transaction without acknowledging the event or failing the job',
    async (sqlState) => {
      const { scanner, tx, committed, scheduler, prisma } = fixture();
      tx.graduationReauditTask.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('private body', {
          clientVersion: '7',
          code: 'P2010',
          meta: { code: sqlState },
        }),
      );
      await expect(scanner.scan()).resolves.toEqual({
        receipts: 0,
        targets: 0,
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(
        GRADUATION_LIMITS.TRANSACTION_RETRIES + 1,
      );
      expect(committed).toEqual({ receipts: 0, tasks: [] });
      expect(scheduler.enqueueReaudit).not.toHaveBeenCalled();
      expect(Logger.prototype.error).not.toHaveBeenCalled();
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `phase=CONSUME name=PrismaClientKnownRequestError code=P2010 sqlState=${sqlState}`,
        ),
      );
      tx.graduationReauditTask.create.mockImplementation(async () => {
        const id = `task-${committed.tasks.length}`;
        committed.tasks.push(id);
        return { id };
      });
      await expect(scanner.scan()).resolves.toEqual({
        receipts: 1,
        targets: 2,
      });
    },
  );

  it('retries a transient conflict within the scan and commits only once', async () => {
    const { scanner, tx, committed, prisma } = fixture();
    tx.graduationReauditTask.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('private body', {
        clientVersion: '7',
        code: 'P2034',
      }),
    );
    await expect(scanner.scan()).resolves.toEqual({ receipts: 1, targets: 2 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(committed).toEqual({ receipts: 1, tasks: ['task-0', 'task-1'] });
    expect(Logger.prototype.error).not.toHaveBeenCalled();
  });

  it('bounds feed-selection conflict retries and leaves the feed untouched', async () => {
    const { scanner, prisma, committed } = fixture();
    prisma.academicResultChange.findMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('private body', {
        clientVersion: '7',
        code: 'P2034',
      }),
    );
    await expect(scanner.scan()).resolves.toEqual({ receipts: 0, targets: 0 });
    expect(prisma.academicResultChange.findMany).toHaveBeenCalledTimes(
      GRADUATION_LIMITS.TRANSACTION_RETRIES + 1,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(committed).toEqual({ receipts: 0, tasks: [] });
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining('phase=SELECT'),
    );
    expect(Logger.prototype.error).not.toHaveBeenCalled();
  });

  it('does not acknowledge malformed snapshot evidence', async () => {
    const { scanner, change, tx } = fixture();
    Object.assign(change.after, { studentId: 'not-in-producer-snapshot' });
    await expect(scanner.scan()).rejects.toThrow();
    expect(tx.graduationResultChangeReceipt.create).not.toHaveBeenCalled();
  });

  it('does not acknowledge an event with unknown source semester chronology', async () => {
    const { scanner, change, tx } = fixture();
    Object.assign(change.academicResult.semester, { startDate: null });
    await expect(scanner.scan()).rejects.toThrow();
    expect(tx.graduationResultChangeReceipt.create).not.toHaveBeenCalled();
  });

  it('handles the initial creation event with a null before snapshot', async () => {
    const { scanner, change } = fixture();
    Object.assign(change, { revision: 1, before: null });
    await expect(scanner.scan()).resolves.toEqual({ receipts: 1, targets: 2 });
  });

  it('does not lose other feed rows when an individual event fails', async () => {
    const { scanner, prisma, tx, committed } = fixture();
    prisma.academicResultChange.findMany.mockResolvedValue([
      { id: 'broken' },
      { id: 'change' },
    ]);
    tx.academicResultChange.findUniqueOrThrow.mockRejectedValueOnce(
      new Error('synthetic malformed event'),
    );
    await expect(scanner.scan()).rejects.toThrow();
    expect(committed.receipts).toBe(1);
    expect(committed.tasks).toHaveLength(2);
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'phase=CONSUME name=Error code=UNCLASSIFIED_EXECUTION',
      ),
    );
  });
});
