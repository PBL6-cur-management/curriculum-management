import ExcelJS from 'exceljs';
import { GraduationBatchRunner } from '../src/features/graduation/graduation-batch.runner.js';
import { GraduationAuditWriter } from '../src/shared/graduation/graduation-audit.writer.js';
import { createAccount, loginAgent } from './fixtures/accounts.js';
import { assignDirector } from './fixtures/programs.js';
import {
  createSyntheticStudentFixture,
  downloadBinary,
} from './fixtures/students.js';
import {
  GRADUATION_CSRF,
  GRADUATION_TEST_JOBS,
  completeGraduation,
  confirmGraduationBatch,
  graduationFilters,
  graduationHarness,
  graduationWriteCounts,
  seedGraduationFixture,
  waitForGraduationBatch,
  pauseGraduation,
  resumeGraduation,
} from './fixtures/graduation.js';

describe('graduation batch durable acceptance', () => {
  const harness = graduationHarness();

  it('previews without writes, freezes roster and idempotently confirms one batch', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    await completeGraduation(harness, fixture);
    const before = await graduationWriteCounts(harness.prisma);
    const filters = graduationFilters(fixture);
    const preview = await harness.office
      .post('/api/graduation-batches/preview')
      .set(GRADUATION_CSRF)
      .send(filters)
      .expect(200);
    expect(preview.body).toEqual({
      filters,
      studentCount: 2,
      enrollmentCount: 2,
      previewRevision: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect((await graduationWriteCounts(harness.prisma)).slice(0, 4)).toEqual(
      before.slice(0, 4),
    );
    const command = {
      ...filters,
      previewRevision: preview.body.previewRevision,
      requestKey: 'batch-replay',
    };
    const created = await harness.office
      .post('/api/graduation-batches')
      .set(GRADUATION_CSRF)
      .send(command)
      .expect(201);
    const replay = await harness.office
      .post('/api/graduation-batches')
      .set(GRADUATION_CSRF)
      .send(command)
      .expect(201);
    expect(replay.body.id).toBe(created.body.id);
    expect(
      await harness.prisma.graduationBatchItem.count({
        where: { batchId: created.body.id },
      }),
    ).toBe(2);
    const done = await waitForGraduationBatch(harness, created.body.id);
    expect(done).toMatchObject({
      status: 'COMPLETED',
      studentCount: 2,
      enrollmentCount: 2,
      processedCount: 2,
      eligibleCount: 1,
      notEligibleCount: 1,
      errorCount: 0,
      failure: null,
    });
    const lateStudent = await createSyntheticStudentFixture(
      harness.app,
      'GRADLATER',
      fixture.world,
    );
    expect(
      await harness.prisma.graduationBatchItem.count({
        where: { batchId: created.body.id, studentId: lateStudent.studentId },
      }),
    ).toBe(0);
    await harness.office
      .post('/api/graduation-batches')
      .set(GRADUATION_CSRF)
      .send({ ...command, semesterId: fixture.priorSemesterId })
      .expect(409);
  });

  it('rejects confirmation drift and never creates a partially frozen roster', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    const filters = graduationFilters(fixture);
    const preview = await harness.office
      .post('/api/graduation-batches/preview')
      .set(GRADUATION_CSRF)
      .send(filters)
      .expect(200);
    await createSyntheticStudentFixture(
      harness.app,
      'GRADDRIFT',
      fixture.world,
    );
    const before = await harness.prisma.graduationBatch.count();
    const rejected = await harness.office
      .post('/api/graduation-batches')
      .set(GRADUATION_CSRF)
      .send({
        ...filters,
        previewRevision: preview.body.previewRevision,
        requestKey: 'stale-roster',
      })
      .expect(409);
    expect(rejected.body.code).toBe('GRADUATION_STATE_CHANGED');
    expect(await harness.prisma.graduationBatch.count()).toBe(before);
  });

  it('SQL-filters conclusion, outcome and escaped search before pagination/count', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    await completeGraduation(harness, fixture);
    const batch = await confirmGraduationBatch(
      harness,
      fixture,
      'filtered-batch',
    );
    await waitForGraduationBatch(harness, batch.id);
    const page = await harness.office
      .get(`/api/graduation-batches/${batch.id}/items`)
      .query({
        conclusion: 'ELIGIBLE',
        outcome: 'REVIEWED',
        page: 1,
        pageSize: 1,
      })
      .expect(200);
    expect(page.body).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 1,
      items: [
        {
          studentId: fixture.studentId,
          status: 'REVIEWED',
          conclusion: 'ELIGIBLE',
          shortfallCount: 0,
          error: null,
          auditId: expect.any(String),
        },
      ],
    });
    const empty = await harness.office
      .get(`/api/graduation-batches/${batch.id}/items`)
      .query({ q: "%' OR 1=1 --" })
      .expect(200);
    expect(empty.body).toMatchObject({ total: 0, items: [] });
    const student = await harness.prisma.student.findUniqueOrThrow({
      where: { id: fixture.secondStudentId },
    });
    const searched = await harness.office
      .get(`/api/graduation-batches/${batch.id}/items`)
      .query({ q: student.studentCode, conclusion: 'NOT_ELIGIBLE' })
      .expect(200);
    expect(searched.body).toMatchObject({
      total: 1,
      items: [{ studentId: fixture.secondStudentId }],
    });
  });

  it('continues after an enrollment changes and exposes the error rather than a false conclusion', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    await pauseGraduation(harness);
    try {
      const batch = await confirmGraduationBatch(harness, fixture, 'one-error');
      await harness.prisma.programEnrollment.update({
        where: { id: fixture.enrollmentId },
        data: { status: 'ENDED', untilSemesterId: fixture.semesterId },
      });
      await harness.app.get(GraduationBatchRunner).run(batch.id);
      const done = await waitForGraduationBatch(harness, batch.id);
      expect(done).toMatchObject({
        status: 'COMPLETED_WITH_ERRORS',
        processedCount: 2,
        errorCount: 1,
        notEligibleCount: 1,
      });
      const items = await harness.office
        .get(`/api/graduation-batches/${batch.id}/items`)
        .query({ outcome: 'ERROR' })
        .expect(200);
      expect(items.body).toMatchObject({
        total: 1,
        items: [
          {
            studentId: fixture.studentId,
            status: 'ERROR',
            auditId: null,
            conclusion: null,
            shortfallCount: null,
            error: { code: expect.any(String), message: expect.any(String) },
          },
        ],
      });
    } finally {
      await resumeGraduation(harness);
    }
  });

  it('resumes after an item commit and rolls back an interrupted append before lease recovery', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    await pauseGraduation(harness);
    const writer = harness.app.get(GraduationAuditWriter);
    const original = writer.append.bind(writer);
    let calls = 0;
    try {
      const batch = await confirmGraduationBatch(
        harness,
        fixture,
        'crash-recovery',
      );
      const fault = vi
        .spyOn(writer, 'append')
        .mockImplementation(async (...args) => {
          const audit = await original(...args);
          calls += 1;
          if (calls === 2)
            throw new Error('Synthetic crash after append, before item commit');
          return audit;
        });
      try {
        await expect(
          harness.app.get(GraduationBatchRunner).run(batch.id),
        ).rejects.toThrow('Synthetic crash');
      } finally {
        fault.mockRestore();
      }
      expect(
        await harness.prisma.graduationBatchItem.count({
          where: { batchId: batch.id, status: 'REVIEWED' },
        }),
      ).toBe(1);
      expect(
        await harness.prisma.graduationAudit.count({
          where: { batchItem: { batchId: batch.id } },
        }),
      ).toBe(1);
      const checkpoint =
        await harness.prisma.graduationBatchItem.findFirstOrThrow({
          where: { batchId: batch.id, status: 'REVIEWED' },
        });
      await harness.prisma.graduationBatch.update({
        where: { id: batch.id },
        data: {
          status: 'RUNNING',
          leaseToken: 'abandoned-worker',
          leaseUntil: new Date(Date.now() - 1_000),
        },
      });
      await Promise.all([
        harness.app.get(GraduationBatchRunner).run(batch.id),
        harness.app.get(GraduationBatchRunner).run(batch.id),
      ]);
      const done = await waitForGraduationBatch(harness, batch.id);
      expect(done).toMatchObject({
        status: 'COMPLETED',
        processedCount: 2,
        errorCount: 0,
      });
      expect(
        await harness.prisma.graduationAudit.count({
          where: { batchItem: { batchId: batch.id } },
        }),
      ).toBe(2);
      expect(
        (
          await harness.prisma.graduationBatchItem.findUniqueOrThrow({
            where: { id: checkpoint.id },
          })
        ).auditId,
      ).toBe(checkpoint.auditId);
      await harness.app.get(GraduationBatchRunner).run(batch.id);
      expect(
        await harness.prisma.graduationAudit.count({
          where: { batchItem: { batchId: batch.id } },
        }),
      ).toBe(2);
    } finally {
      vi.restoreAllMocks();
      await resumeGraduation(harness);
    }
  });

  it('fences an unexpired lease and recovers a missing enqueue using database state', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    await pauseGraduation(harness);
    let batchId = '';
    try {
      const enqueue = vi
        .spyOn(harness.queue, 'add')
        .mockRejectedValue(new Error('Synthetic Redis enqueue loss'));
      try {
        batchId = (
          await confirmGraduationBatch(harness, fixture, 'lost-enqueue')
        ).id;
      } finally {
        enqueue.mockRestore();
      }
      expect(
        await harness.prisma.graduationBatchItem.count({ where: { batchId } }),
      ).toBe(2);
      await harness.prisma.graduationBatch.update({
        where: { id: batchId },
        data: {
          status: 'RUNNING',
          leaseToken: 'live-worker',
          leaseUntil: new Date(Date.now() + 60_000),
        },
      });
      await harness.app.get(GraduationBatchRunner).run(batchId);
      expect(
        await harness.prisma.graduationBatchItem.count({
          where: { batchId, status: 'PENDING' },
        }),
      ).toBe(2);
      await harness.prisma.graduationBatch.update({
        where: { id: batchId },
        data: { leaseUntil: new Date(Date.now() - 1_000) },
      });
      await harness.app.get(GraduationBatchRunner).recover();
    } finally {
      await resumeGraduation(harness);
    }
    expect(
      (await waitForGraduationBatch(harness, batchId)).processedCount,
    ).toBe(2);
    await harness.queue.add(GRADUATION_TEST_JOBS.RUN_BATCH, { batchId });
    expect(
      await harness.prisma.graduationAudit.count({
        where: { batchItem: { batchId } },
      }),
    ).toBe(2);
  });

  it('restricts batch ownership and exports literal Excel text with private download headers', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    await harness.prisma.student.update({
      where: { id: fixture.studentId },
      data: { fullName: '=SUM(1,2)' },
    });
    const batch = await confirmGraduationBatch(harness, fixture, 'safe-export');
    await waitForGraduationBatch(harness, batch.id);
    const otherAccount = await createAccount(
      harness.app,
      'gradotheroffice',
      'R1',
    );
    const other = await loginAgent(harness.app, otherAccount);
    for (const suffix of ['', '/items', '/export']) {
      await other
        .get(`/api/graduation-batches/${batch.id}${suffix}`)
        .expect(404);
    }
    const foreignList = await other.get('/api/graduation-batches').expect(200);
    expect(foreignList.body.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: batch.id })]),
    );
    const file = await downloadBinary(
      harness.office.get(`/api/graduation-batches/${batch.id}/export`),
    );
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(file.headers['cache-control']).toBe('no-store, private');
    expect(file.headers['content-disposition']).toMatch(
      /attachment;.*filename\*=UTF-8''/,
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(file.body).buffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Tổng hợp',
      'Kết quả',
      'Hạng mục thiếu',
    ]);
    const results = workbook.getWorksheet('Kết quả')!;
    expect(results.rowCount).toBe(3);
    const cells: ExcelJS.Cell[] = [];
    results.eachRow((row) => row.eachCell((cell) => cells.push(cell)));
    expect(cells.some((cell) => cell.value === '=SUM(1,2)')).toBe(true);
    for (const cell of cells) {
      expect(cell.type).not.toBe(ExcelJS.ValueType.Formula);
      if (typeof cell.value === 'string') expect(cell.numFmt).toBe('@');
    }
  });

  it('revalidates the requester before background work and never borrows another R1 identity', async () => {
    const fixture = await seedGraduationFixture(harness.app, harness.office);
    const account = await createAccount(
      harness.app,
      'gradrevokedrequester',
      'R3',
      { unitCode: 'KHOA_CNTT' },
    );
    await assignDirector(harness.app, {
      programId: fixture.programId,
      userId: account.id,
    });
    const director = await loginAgent(harness.app, account);
    await pauseGraduation(harness);
    try {
      const batch = await confirmGraduationBatch(
        { ...harness, office: director, account },
        fixture,
        'revoked-requester',
      );
      await harness.prisma.user.update({
        where: { id: account.id },
        data: { status: 'DISABLED' },
      });
      await harness.app.get(GraduationBatchRunner).run(batch.id);
      const stored = await harness.prisma.graduationBatch.findUniqueOrThrow({
        where: { id: batch.id },
        include: { items: true },
      });
      expect(stored.status).toBe('COMPLETED_WITH_ERRORS');
      expect(stored.items).toHaveLength(2);
      expect(
        stored.items.every(
          (item) => item.status === 'ERROR' && item.auditId === null,
        ),
      ).toBe(true);
      expect(
        await harness.prisma.graduationAudit.count({
          where: { batchItem: { batchId: batch.id } },
        }),
      ).toBe(0);
    } finally {
      await resumeGraduation(harness);
    }
  });
});
