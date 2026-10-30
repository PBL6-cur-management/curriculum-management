import ExcelJS from 'exceljs';
import { GraduationBatchRunner } from '../src/features/graduation/graduation-batch.runner.js';
import { GraduationResultChangeScanner } from '../src/features/graduation/graduation-result-change.scanner.js';
import { GraduationReauditRunner } from '../src/features/graduation/graduation-reaudit.runner.js';
import { GraduationNotificationsWriter } from '../src/shared/graduation/graduation-notifications.writer.js';
import { AcademicResultsReader } from '../src/shared/students/academic-results.reader.js';
import { StudentAppliedVersionReader } from '../src/shared/students/student-applied-version.reader.js';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import { assignDirector } from './fixtures/programs.js';
import { downloadBinary } from './fixtures/students.js';
import {
  GRADUATION_CSRF,
  completeGraduation,
  confirmGraduationBatch,
  graduationHarness,
  graduationQuery,
  pauseGraduation,
  resumeGraduation,
  saveGraduation,
  seedGraduationFixture,
  setGraduationResult,
  waitForGraduationBatch,
  type GraduationAuditResponse,
  type GraduationFixture,
} from './fixtures/graduation.js';

describe('graduation F-17 correction consumer acceptance', () => {
  const harness = graduationHarness();
  const noticeCount = () =>
    harness.prisma.notification.count({
      where: { notificationType: 'GRADUATION_CONCLUSION_CHANGED' },
    });
  async function drainChanges() {
    while (
      await harness.prisma.academicResultChange.count({
        where: { graduationReceipt: null },
      })
    ) {
      await harness.app.get(GraduationResultChangeScanner).scan();
    }
  }
  async function correctionCase(
    work: (
      fixture: GraduationFixture,
      baseline: GraduationAuditResponse,
    ) => Promise<void>,
  ) {
    await pauseGraduation(harness);
    try {
      const fixture = await seedGraduationFixture(harness.app, harness.office);
      await completeGraduation(harness, fixture);
      await drainChanges();
      const baseline = await saveGraduation(
        harness.office,
        fixture,
        `baseline-${fixture.studentId}`,
      );
      await work(fixture, baseline);
    } finally {
      vi.restoreAllMocks();
      await resumeGraduation(harness);
    }
  }
  async function latestChange(
    fixture: GraduationFixture,
    semesterId = fixture.priorSemesterId,
  ) {
    return harness.prisma.academicResultChange.findFirstOrThrow({
      where: {
        academicResult: {
          studentId: fixture.studentId,
          courseId: fixture.courseIds.mandatory,
          semesterId,
        },
      },
      orderBy: { revision: 'desc' },
      include: { academicResult: true },
    });
  }
  async function scanTask(fixture: GraduationFixture, contextId: string) {
    const change = await latestChange(fixture);
    await drainChanges();
    return harness.prisma.graduationReauditTask.findUniqueOrThrow({
      where: { changeId_contextId: { changeId: change.id, contextId } },
    });
  }

  it('keeps F-17 producer independent, joins identity and creates one durable receipt/target', () =>
    correctionCase(async (fixture, baseline) => {
      const beforeFeed = await harness.prisma.academicResultChange.count();
      const beforeNotices = await noticeCount();
      const outcome = await setGraduationResult(
        harness,
        fixture,
        fixture.courseIds.mandatory,
        'FAILED',
      );
      expect(outcome).toMatchObject({ updated: 1, created: 0 });
      expect(await harness.prisma.academicResultChange.count()).toBe(
        beforeFeed + 1,
      );
      expect(
        await harness.prisma.graduationAudit.count({
          where: { contextId: baseline.contextId },
        }),
      ).toBe(1);
      expect(await noticeCount()).toBe(beforeNotices);
      const change = await latestChange(fixture);
      expect(change.academicResult).toMatchObject({
        studentId: fixture.studentId,
        courseId: fixture.courseIds.mandatory,
        semesterId: fixture.priorSemesterId,
      });
      expect(change.before).toEqual({
        score10: '8',
        score4: '3',
        letterGrade: 'B',
        status: 'PASSED',
        dataSource: 'EXCEL',
      });
      expect(change.after).toEqual({
        score10: '2',
        score4: '1',
        letterGrade: 'F',
        status: 'FAILED',
        dataSource: 'EXCEL',
      });
      const pending = await harness.office
        .get(`/api/graduation-audits/${baseline.id}`)
        .expect(200);
      expect(pending.body.freshness).toBe('RECHECK_PENDING');
      const task = await scanTask(fixture, baseline.contextId);
      await Promise.all([
        harness.app.get(GraduationResultChangeScanner).scan(),
        harness.app.get(GraduationResultChangeScanner).scan(),
      ]);
      expect(
        await harness.prisma.graduationResultChangeReceipt.count({
          where: { changeId: change.id },
        }),
      ).toBe(1);
      expect(
        await harness.prisma.graduationReauditTask.count({
          where: { changeId: change.id },
        }),
      ).toBe(1);
      expect(task).toMatchObject({
        baselineAuditId: baseline.id,
        status: 'PENDING',
      });
      await harness.app.get(GraduationReauditRunner).run(task.id);
      const completed =
        await harness.prisma.graduationReauditTask.findUniqueOrThrow({
          where: { id: task.id },
        });
      expect(completed).toMatchObject({
        status: 'COMPLETED',
        errorCode: null,
        leaseToken: null,
        leaseUntil: null,
      });
      const result = await harness.office
        .get(`/api/graduation-audits/${completed.completedAuditId}`)
        .expect(200);
      expect(result.body).toMatchObject({
        trigger: 'RESULT_CHANGE',
        auditedBy: null,
        supersedesId: baseline.id,
        result: { conclusion: 'NOT_ELIGIBLE' },
      });
      expect(result.body.inputDigest).not.toBe(baseline.inputDigest);
      expect(await noticeCount()).toBe(beforeNotices + 1);
      const notice = await harness.prisma.notification.findFirstOrThrow({
        where: { notificationType: 'GRADUATION_CONCLUSION_CHANGED' },
        orderBy: { createdAt: 'desc' },
      });
      expect(notice).toMatchObject({
        recipientId: harness.account.id,
        changeRequestId: null,
      });
      const old = await harness.office
        .get(`/api/graduation-audits/${baseline.id}`)
        .expect(200);
      expect(old.body.result).toEqual(baseline.result);
      await harness.app.get(GraduationReauditRunner).run(task.id);
      expect(await noticeCount()).toBe(beforeNotices + 1);
      expect(
        await harness.prisma.graduationAudit.count({
          where: { contextId: baseline.contextId },
        }),
      ).toBe(2);
    }));

  it('does not emit a change for no-op source writes and adds no task/audit', () =>
    correctionCase(async (fixture, baseline) => {
      const changes = await harness.prisma.academicResultChange.count();
      const outcome = await setGraduationResult(
        harness,
        fixture,
        fixture.courseIds.mandatory,
        'PASSED',
      );
      expect(outcome).toMatchObject({ unchanged: 1, updated: 0, created: 0 });
      expect(await harness.prisma.academicResultChange.count()).toBe(changes);
      await drainChanges();
      expect(
        await harness.prisma.graduationReauditTask.count({
          where: { contextId: baseline.contextId },
        }),
      ).toBe(0);
      expect(
        await harness.prisma.graduationAudit.count({
          where: { contextId: baseline.contextId },
        }),
      ).toBe(1);
    }));

  it('stores an unchanged conclusion without a notice and marks older out-of-order tasks COVERED', () =>
    correctionCase(async (fixture, baseline) => {
      const notices = await noticeCount();
      await setGraduationResult(
        harness,
        fixture,
        fixture.courseIds.mandatory,
        'PASSED',
        { score4: '2' },
      );
      const older = await scanTask(fixture, baseline.contextId);
      await setGraduationResult(
        harness,
        fixture,
        fixture.courseIds.mandatory,
        'PASSED',
        { score4: '4' },
      );
      const newer = await scanTask(fixture, baseline.contextId);
      await harness.app.get(GraduationReauditRunner).run(newer.id);
      await harness.app.get(GraduationReauditRunner).run(older.id);
      const covered =
        await harness.prisma.graduationReauditTask.findUniqueOrThrow({
          where: { id: older.id },
        });
      expect(covered.status).toBe('COVERED');
      expect(await noticeCount()).toBe(notices);
      expect(
        await harness.prisma.graduationAudit.count({
          where: { contextId: baseline.contextId },
        }),
      ).toBe(2);
      const head =
        await harness.prisma.graduationAuditContext.findUniqueOrThrow({
          where: { id: baseline.contextId },
        });
      expect(covered.completedAuditId).toBe(head.lastAuditId);
    }));

  it('rolls back the notice, audit and head together then retries with exactly-once effect', () =>
    correctionCase(async (fixture, baseline) => {
      await setGraduationResult(
        harness,
        fixture,
        fixture.courseIds.mandatory,
        'FAILED',
      );
      const task = await scanTask(fixture, baseline.contextId);
      const notices = await noticeCount();
      const notifier = harness.app.get(GraduationNotificationsWriter);
      const original = notifier.conclusionChanged.bind(notifier);
      const fault = vi
        .spyOn(notifier, 'conclusionChanged')
        .mockImplementationOnce(async (...args) => {
          await original(...args);
          throw new Error('Synthetic failure after notification insert');
        });
      try {
        await expect(
          harness.app.get(GraduationReauditRunner).run(task.id),
        ).rejects.toThrow('Synthetic failure');
      } finally {
        fault.mockRestore();
      }
      expect(await noticeCount()).toBe(notices);
      expect(
        await harness.prisma.graduationAudit.count({
          where: { contextId: baseline.contextId },
        }),
      ).toBe(1);
      expect(
        (
          await harness.prisma.graduationAuditContext.findUniqueOrThrow({
            where: { id: baseline.contextId },
          })
        ).lastAuditId,
      ).toBe(baseline.id);
      expect(
        (
          await harness.prisma.graduationReauditTask.findUniqueOrThrow({
            where: { id: task.id },
          })
        ).status,
      ).toBe('PENDING');
      await Promise.all([
        harness.app.get(GraduationReauditRunner).run(task.id),
        harness.app.get(GraduationReauditRunner).run(task.id),
      ]);
      expect(await noticeCount()).toBe(notices + 1);
      expect(
        await harness.prisma.graduationAudit.count({
          where: { contextId: baseline.contextId },
        }),
      ).toBe(2);
    }));

  it('discovers late-visible changes older than prior receipts and observes the semester cutoff', () =>
    correctionCase(async (fixture, baseline) => {
      const prior = await saveGraduation(
        harness.office,
        { ...fixture, semesterId: fixture.priorSemesterId },
        'historical-cutoff',
      );
      await setGraduationResult(
        harness,
        fixture,
        fixture.courseIds.mandatory,
        'FAILED',
        { semesterId: fixture.semesterId },
      );
      const laterChange = await latestChange(fixture, fixture.semesterId);
      const recordedAt = new Date('2001-01-01T00:00:00.000Z');
      await harness.prisma.academicResultChange.update({
        where: { id: laterChange.id },
        data: { recordedAt },
      });
      await drainChanges();
      expect(
        await harness.prisma.graduationResultChangeReceipt.findUnique({
          where: { changeId: laterChange.id },
        }),
      ).not.toBeNull();
      expect(
        await harness.prisma.graduationReauditTask.count({
          where: { changeId: laterChange.id, contextId: prior.contextId },
        }),
      ).toBe(0);
      expect(
        await harness.prisma.graduationReauditTask.count({
          where: { changeId: laterChange.id, contextId: baseline.contextId },
        }),
      ).toBe(1);
    }));

  it('authorizes restricted readers only for the exact current unexpired task lease', () =>
    correctionCase(async (fixture, baseline) => {
      await setGraduationResult(
        harness,
        fixture,
        fixture.courseIds.mandatory,
        'FAILED',
      );
      const task = await scanTask(fixture, baseline.contextId);
      const versions = harness.app.get(StudentAppliedVersionReader);
      const results = harness.app.get(AcademicResultsReader);
      await expect(
        harness.prisma.$transaction((tx) =>
          versions.forReauditTask(task.id, 'guess', tx),
        ),
      ).rejects.toThrow();
      await harness.prisma.graduationReauditTask.update({
        where: { id: task.id },
        data: {
          status: 'RUNNING',
          leaseToken: 'authorized-lease',
          leaseUntil: new Date(Date.now() + 60_000),
        },
      });
      await harness.prisma.$transaction(async (tx) => {
        const version = await versions.forReauditTask(
          task.id,
          'authorized-lease',
          tx,
        );
        expect((await version.resolveForStudent()).studentId).toBe(
          fixture.studentId,
        );
        const transcript = await results.forReauditTask(
          task.id,
          'authorized-lease',
          tx,
        );
        expect(
          (await transcript.forStudent()).every(
            (row) => row.studentId === fixture.studentId,
          ),
        ).toBe(true);
      });
      await harness.prisma.graduationReauditTask.update({
        where: { id: task.id },
        data: { leaseUntil: new Date(Date.now() - 1_000) },
      });
      await expect(
        harness.prisma.$transaction((tx) =>
          results.forReauditTask(task.id, 'authorized-lease', tx),
        ),
      ).rejects.toThrow();
      await harness.app.get(GraduationReauditRunner).run(task.id);
      expect(
        (
          await harness.prisma.graduationReauditTask.findUniqueOrThrow({
            where: { id: task.id },
          })
        ).status,
      ).toBe('COMPLETED');
    }));

  it('keeps system re-audit valid after reviewer revocation and hides task operations from R3', () =>
    correctionCase(async (fixture) => {
      const reviewer = await createAccount(
        harness.app,
        'gradcorrectiondirector',
        'R3',
        { unitCode: 'KHOA_CNTT' },
      );
      await assignDirector(harness.app, {
        programId: fixture.programId,
        userId: reviewer.id,
      });
      const director = await loginAgent(harness.app, reviewer);
      const staffAudit = await saveGraduation(
        director,
        fixture,
        'reviewer-revoked',
      );
      await setGraduationResult(
        harness,
        fixture,
        fixture.courseIds.mandatory,
        'FAILED',
      );
      const task = await scanTask(fixture, staffAudit.contextId);
      await director
        .get(`/api/students/${fixture.studentId}/graduation-reaudit-tasks`)
        .query(graduationQuery(fixture))
        .expect(403);
      await director
        .post(`/api/graduation-reaudit-tasks/${task.id}/retry`)
        .set(GRADUATION_CSRF)
        .expect(403);
      await harness.prisma.user.update({
        where: { id: reviewer.id },
        data: { status: 'DISABLED' },
      });
      await harness.app.get(GraduationReauditRunner).run(task.id);
      const done = await harness.prisma.graduationReauditTask.findUniqueOrThrow(
        { where: { id: task.id } },
      );
      expect(done.status).toBe('COMPLETED');
      const current = await harness.office
        .get(`/api/graduation-audits/${done.completedAuditId}`)
        .expect(200);
      expect(current.body).toMatchObject({
        trigger: 'RESULT_CHANGE',
        auditedBy: null,
        supersedesId: staffAudit.id,
      });
      const completedRetry = await harness.office
        .post(`/api/graduation-reaudit-tasks/${task.id}/retry`)
        .set(GRADUATION_CSRF)
        .expect(200);
      expect(completedRetry.body.status).toBe('COMPLETED');
      await harness.office
        .post('/api/graduation-reaudit-tasks/unknown-task/retry')
        .set(GRADUATION_CSRF)
        .expect(404);
    }));

  it('atomically rolls back receipt and target creation and discovers the same event again', () =>
    correctionCase(async (fixture, baseline) => {
      await setGraduationResult(
        harness,
        fixture,
        fixture.courseIds.mandatory,
        'FAILED',
      );
      const change = await latestChange(fixture);
      const transaction = harness.prisma.$transaction.bind(harness.prisma);
      const fault = vi
        .spyOn(harness.prisma, '$transaction')
        .mockImplementationOnce((work, options) =>
          transaction(async (tx) => {
            if (typeof work !== 'function')
              throw new Error('Expected interactive scanner transaction');
            await work(tx);
            throw new Error(
              'Synthetic crash before receipt transaction commit',
            );
          }, options),
        );
      try {
        await expect(
          harness.app.get(GraduationResultChangeScanner).scan(),
        ).rejects.toThrow();
      } finally {
        fault.mockRestore();
      }
      expect(
        await harness.prisma.graduationResultChangeReceipt.findUnique({
          where: { changeId: change.id },
        }),
      ).toBeNull();
      expect(
        await harness.prisma.graduationReauditTask.count({
          where: { changeId: change.id },
        }),
      ).toBe(0);
      const task = await scanTask(fixture, baseline.contextId);
      expect(task.baselineAuditId).toBe(baseline.id);
      expect(
        await harness.prisma.graduationResultChangeReceipt.count({
          where: { changeId: change.id },
        }),
      ).toBe(1);
    }));

  it('keeps a frozen old batch export after a newer correction audit changes the conclusion', () =>
    correctionCase(async (fixture, baseline) => {
      const batch = await confirmGraduationBatch(
        harness,
        fixture,
        'historical-export',
      );
      await harness.app.get(GraduationBatchRunner).run(batch.id);
      await waitForGraduationBatch(harness, batch.id);
      const before = await downloadBinary(
        harness.office.get(`/api/graduation-batches/${batch.id}/export`),
      );
      expect(before.status).toBe(200);
      const beforeBook = new ExcelJS.Workbook();
      await beforeBook.xlsx.load(new Uint8Array(before.body).buffer);
      const originalItems = await harness.prisma.graduationBatchItem.findMany({
        where: { batchId: batch.id },
        orderBy: { id: 'asc' },
      });
      await setGraduationResult(
        harness,
        fixture,
        fixture.courseIds.mandatory,
        'FAILED',
      );
      const task = await scanTask(fixture, baseline.contextId);
      await harness.app.get(GraduationReauditRunner).run(task.id);
      const after = await downloadBinary(
        harness.office.get(`/api/graduation-batches/${batch.id}/export`),
      );
      expect(after.status).toBe(200);
      const afterBook = new ExcelJS.Workbook();
      await afterBook.xlsx.load(new Uint8Array(after.body).buffer);
      for (const name of ['Kết quả', 'Hạng mục thiếu']) {
        expect(afterBook.getWorksheet(name)!.getSheetValues()).toEqual(
          beforeBook.getWorksheet(name)!.getSheetValues(),
        );
      }
      expect(
        await harness.prisma.graduationBatchItem.findMany({
          where: { batchId: batch.id },
          orderBy: { id: 'asc' },
        }),
      ).toEqual(originalItems);
      const eligible = await harness.office
        .get(`/api/graduation-batches/${batch.id}/items`)
        .query({ conclusion: 'ELIGIBLE' })
        .expect(200);
      expect(eligible.body).toMatchObject({
        total: 1,
        items: [{ studentId: fixture.studentId, conclusion: 'ELIGIBLE' }],
      });
    }));

  it('exposes failed freshness and permits idempotent R1 retry without deleting history', () =>
    correctionCase(async (fixture, baseline) => {
      await setGraduationResult(
        harness,
        fixture,
        fixture.courseIds.mandatory,
        'FAILED',
      );
      const task = await scanTask(fixture, baseline.contextId);
      await harness.prisma.graduationReauditTask.update({
        where: { id: task.id },
        data: {
          status: 'FAILED',
          attempts: 3,
          errorCode: 'GRADUATION_JOB_FAILED',
          finishedAt: new Date(),
        },
      });
      const stale = await harness.office
        .get(`/api/graduation-audits/${baseline.id}`)
        .expect(200);
      expect(stale.body.freshness).toBe('RECHECK_FAILED');
      const list = await harness.office
        .get(`/api/students/${fixture.studentId}/graduation-reaudit-tasks`)
        .query(graduationQuery(fixture))
        .expect(200);
      expect(list.body).toMatchObject({
        total: 1,
        items: [
          { id: task.id, status: 'FAILED', errorCode: 'GRADUATION_JOB_FAILED' },
        ],
      });
      for (let retry = 0; retry < 2; retry += 1) {
        const response = await harness.office
          .post(`/api/graduation-reaudit-tasks/${task.id}/retry`)
          .set(GRADUATION_CSRF)
          .expect(200);
        expect(response.body).toEqual({
          id: task.id,
          contextId: task.contextId,
          status: 'PENDING',
          attempts: 0,
          completedAuditId: null,
          errorCode: null,
        });
      }
      await harness.app.get(GraduationReauditRunner).run(task.id);
      expect(
        await harness.prisma.graduationAudit.count({
          where: { contextId: baseline.contextId },
        }),
      ).toBe(2);
    }));
});
