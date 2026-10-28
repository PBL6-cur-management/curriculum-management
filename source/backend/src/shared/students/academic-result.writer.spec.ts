import { Prisma } from '../../generated/prisma/client.js';
import { writeAcademicResultSource } from './academic-result.writer.js';
import type {
  AcademicResultPlanRow,
  SourceWriteContext,
} from './student-import.types.js';

const EXCEL: SourceWriteContext = { source: 'EXCEL', actorId: 'u1' };

const value = (over: Partial<AcademicResultPlanRow['value']> = {}) => ({
  studentId: 's1',
  courseId: 'c1',
  semesterId: 'sem1',
  score10: '8.5',
  score4: '3.5',
  letterGrade: 'B+',
  status: 'PASSED' as const,
  ...over,
});
const planRow = (
  over: Partial<AcademicResultPlanRow> = {},
): AcademicResultPlanRow => ({
  rowNumber: 2,
  action: 'CREATE',
  existingId: null,
  expectedRevision: null,
  value: value(),
  ...over,
});
const stored = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  studentId: 's1',
  courseId: 'c1',
  semesterId: 'sem1',
  revision: 1,
  score10: new Prisma.Decimal('8.50'),
  score4: new Prisma.Decimal('3.50'),
  letterGrade: 'B+',
  status: 'PASSED',
  dataSource: 'EXCEL',
  ...over,
});

function client(rows: unknown[] = []) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    academicResult: {
      findMany: vi.fn().mockResolvedValue(rows),
      create: vi.fn().mockResolvedValue({ id: 'new' }),
      update: vi.fn().mockResolvedValue({}),
    },
    academicResultChange: { create: vi.fn().mockResolvedValue({}) },
  };
}
const run = (
  db: ReturnType<typeof client>,
  rows: AcademicResultPlanRow[],
  context = EXCEL,
) =>
  writeAcademicResultSource(
    db as unknown as Prisma.TransactionClient,
    { rows },
    context,
  );

describe('writeAcademicResultSource', () => {
  it('creates an attempt with revision 1 and a feed entry without a before image', async () => {
    const db = client();
    const outcome = await run(db, [planRow()]);
    expect(outcome).toEqual({
      created: 1,
      updated: 0,
      unchanged: 0,
      sourcePreserved: 0,
    });
    expect(db.academicResultChange.create).toHaveBeenCalledWith({
      data: {
        academicResultId: 'new',
        revision: 1,
        before: Prisma.JsonNull,
        after: {
          score10: '8.5',
          score4: '3.5',
          letterGrade: 'B+',
          status: 'PASSED',
          dataSource: 'EXCEL',
        },
      },
    });
  });

  it('updates in place, bumps the revision and records both images', async () => {
    const db = client([stored()]);
    const outcome = await run(db, [
      planRow({
        action: 'UPDATE',
        existingId: 'r1',
        expectedRevision: 1,
        value: value({ score4: '4', score10: '9.5', letterGrade: 'A' }),
      }),
    ]);
    expect(outcome.updated).toBe(1);
    expect(db.academicResult.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: expect.objectContaining({ revision: 2 }),
      }),
    );
    const change = db.academicResultChange.create.mock.calls[0]![0].data;
    expect(change.revision).toBe(2);
    expect(change.before).toMatchObject({ score4: '3.5', dataSource: 'EXCEL' });
    expect(change.after).toMatchObject({ score4: '4', letterGrade: 'A' });
  });

  it('replays a no-op without a new revision or feed entry', async () => {
    const db = client([stored()]);
    const outcome = await run(db, [
      planRow({ action: 'UNCHANGED', existingId: 'r1', expectedRevision: 1 }),
    ]);
    expect(outcome.unchanged).toBe(1);
    expect(db.academicResult.update).not.toHaveBeenCalled();
    expect(db.academicResultChange.create).not.toHaveBeenCalled();
  });

  it('never lets Excel overwrite an official attempt, even when it became official after validation', async () => {
    const db = client([stored({ dataSource: 'SCHOOL_DB' })]);
    const outcome = await run(db, [
      planRow({
        action: 'UPDATE',
        existingId: 'r1',
        expectedRevision: 1,
        value: value({ score4: '1' }),
      }),
    ]);
    expect(outcome.sourcePreserved).toBe(1);
    expect(db.academicResult.update).not.toHaveBeenCalled();
  });

  it('lets the official source supersede Excel with a null actor', async () => {
    const db = client([stored()]);
    const outcome = await run(
      db,
      [planRow({ action: 'UNCHANGED', existingId: 'r1', expectedRevision: 1 })],
      { source: 'SCHOOL_DB', actorId: null },
    );
    expect(outcome.updated).toBe(1);
    expect(
      db.academicResultChange.create.mock.calls[0]![0].data.after.dataSource,
    ).toBe('SCHOOL_DB');
  });

  it('counts a planned preserve without touching the row', async () => {
    const db = client([stored({ dataSource: 'SCHOOL_DB' })]);
    const outcome = await run(db, [
      planRow({
        action: 'PRESERVE_SOURCE',
        existingId: 'r1',
        expectedRevision: 1,
      }),
    ]);
    expect(outcome.sourcePreserved).toBe(1);
  });

  it('throws on a stale revision, a vanished row and an appeared row so the caller rolls back', async () => {
    await expect(
      run(client([stored({ revision: 3 })]), [
        planRow({ action: 'UPDATE', existingId: 'r1', expectedRevision: 1 }),
      ]),
    ).rejects.toMatchObject({ code: 'ENROLLMENT_STATE_CHANGED' });
    await expect(
      run(client(), [
        planRow({ action: 'UPDATE', existingId: 'r1', expectedRevision: 1 }),
      ]),
    ).rejects.toMatchObject({ code: 'ENROLLMENT_STATE_CHANGED' });
    await expect(run(client([stored()]), [planRow()])).rejects.toMatchObject({
      code: 'ENROLLMENT_STATE_CHANGED',
    });
  });

  it('requires an actor for Excel', async () => {
    await expect(
      run(client(), [planRow()], { source: 'EXCEL', actorId: null }),
    ).rejects.toThrow();
  });
});
