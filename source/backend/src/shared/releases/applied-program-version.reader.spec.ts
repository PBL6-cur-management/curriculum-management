import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AppliedProgramVersionReader } from './applied-program-version.reader.js';
import { readProgramCohortSchedule } from './cohort-version-schedule.js';

function setup() {
  const first = {
    id: 's1',
    semesterCode: 'Z',
    academicYear: 'Y',
    termInYear: 1,
    startDate: new Date('2025-01-01'),
  };
  const later = {
    ...first,
    id: 's3',
    semesterCode: 'A',
    startDate: new Date('2026-01-01'),
  };
  const cohort = { id: 'c1', cohortCode: 'K2023', intakeYear: 2023 };
  const second = { id: 'c2', cohortCode: 'K2025', intakeYear: 2025 };
  const version = {
    id: 'v1',
    programId: 'p',
    versionNumber: '1.0',
    status: 'HISTORICAL',
    sourceRequestId: null,
    publishedAt: new Date('2025-01-01'),
    decisionNumber: 'QD',
    effectiveSemester: first,
  };
  const link = {
    id: 'link',
    cohortId: cohort.id,
    programVersionId: version.id,
    fromSemesterId: first.id,
    cohort,
    programVersion: version,
    fromSemester: first,
    createdAt: new Date('2025-01-01'),
  };
  const tx = {
    program: { findUnique: vi.fn().mockResolvedValue({ id: 'p' }) },
    cohort: { findMany: vi.fn().mockResolvedValue([cohort, second]) },
    semester: {
      findUnique: vi.fn().mockResolvedValue(later),
      findMany: vi.fn().mockResolvedValue([first, later]),
    },
    cohortVersion: { findMany: vi.fn().mockResolvedValue([link]) },
  };
  const db = {
    $transaction: vi.fn(
      async (operation: (tx: Prisma.TransactionClient) => unknown) =>
        operation(tx as unknown as Prisma.TransactionClient),
    ),
  };
  return {
    first,
    later,
    cohort,
    second,
    version,
    link,
    tx,
    db,
    reader: new AppliedProgramVersionReader(db as unknown as PrismaService),
    transaction: tx as unknown as Prisma.TransactionClient,
  };
}
const lookup = {
  programId: 'p',
  cohortIds: ['c2', 'c1', 'c2'],
  semesterId: 's3',
};
describe('AppliedProgramVersionReader', () => {
  it('deduplicates in input order, isolates program and cohort, and returns null without an ACTIVE fallback', async () => {
    const { reader, db, tx } = setup();
    const result = await reader.forCohorts(lookup);
    expect(result.map((row) => row.cohort.id)).toEqual(['c2', 'c1']);
    expect(result[0].assignment).toBeNull();
    expect(result[1].assignment?.version.id).toBe('v1');
    expect(tx.cohortVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          cohortId: { in: ['c2', 'c1'] },
          programVersion: { programId: 'p' },
        },
      }),
    );
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
    });
  });
  it('resolves a released version that has no decision number yet (seeded from the school data)', async () => {
    const { reader, version } = setup();
    Object.assign(version, { decisionNumber: null });
    const result = await reader.forCohorts(lookup);
    expect(result[1].assignment?.version).toMatchObject({
      id: 'v1',
      decisionNumber: null,
    });
  });
  it('exclusively uses an explicitly supplied transaction and performs no writes', async () => {
    const { reader, transaction, db, tx, cohort } = setup();
    tx.cohort.findMany.mockResolvedValue([cohort]);
    expect(
      (
        await reader.forCohort(
          { programId: 'p', cohortId: 'c1', semesterId: 's3' },
          transaction,
        )
      ).assignment?.id,
    ).toBe('link');
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.cohortVersion.findMany).toHaveBeenCalledOnce();
  });
  it('returns empty bulk input without any database lookup', async () => {
    const { reader, tx, transaction } = setup();
    expect(
      await reader.forCohorts({ ...lookup, cohortIds: [] }, transaction),
    ).toEqual([]);
    expect(tx.program.findUnique).not.toHaveBeenCalled();
  });
  it.each(['PENDING', 'HISTORICAL', 'ACTIVE'])(
    'resolves valid issued status %s, independent of worker timing',
    async (status) => {
      const { reader, version } = setup();
      version.status = status;
      expect(
        (await reader.forCohorts(lookup))[1].assignment?.version.status,
      ).toBe(status);
    },
  );
  it('has no assignment before the earliest scheduled link', async () => {
    const { reader, tx, first } = setup();
    tx.semester.findUnique.mockResolvedValue({
      ...first,
      startDate: new Date('2024-01-01'),
    });
    expect((await reader.forCohorts(lookup))[1].assignment).toBeNull();
  });
  it('rejects unknown program, cohort and semester rather than returning partial output', async () => {
    const missingProgram = setup();
    missingProgram.tx.program.findUnique.mockResolvedValue(null);
    await expect(
      missingProgram.reader.forCohorts(lookup),
    ).rejects.toMatchObject({ code: 'PROGRAM_NOT_FOUND' });
    const missingCohort = setup();
    missingCohort.tx.cohort.findMany.mockResolvedValue([missingCohort.cohort]);
    await expect(missingCohort.reader.forCohorts(lookup)).rejects.toMatchObject(
      { code: 'COHORT_NOT_FOUND' },
    );
    expect(missingCohort.tx.cohortVersion.findMany).not.toHaveBeenCalled();
    const missingSemester = setup();
    missingSemester.tx.semester.findUnique.mockResolvedValue(null);
    await expect(
      missingSemester.reader.forCohorts(lookup),
    ).rejects.toMatchObject({ code: 'SEMESTER_NOT_FOUND' });
  });
  it.each(['query', 'from', 'effective'])(
    'rejects an unknown %s start date',
    async (field) => {
      const { reader, tx, first, version } = setup();
      if (field === 'query')
        tx.semester.findUnique.mockResolvedValue({ ...first, startDate: null });
      else if (field === 'from') Object.assign(first, { startDate: null });
      else
        Object.assign(version, {
          effectiveSemester: { ...first, startDate: null },
        });
      await expect(reader.forCohorts(lookup)).rejects.toMatchObject({
        code: 'SEMESTER_START_UNKNOWN',
      });
    },
  );
  it.each([
    { status: 'DRAFT' },
    { sourceRequestId: 'request' },
    { effectiveSemester: null },
  ])('rejects malformed issued timeline %j', async (patch) => {
    const { reader, version } = setup();
    Object.assign(version, patch);
    await expect(reader.forCohorts(lookup)).rejects.toMatchObject({
      code: 'INVALID_COHORT_ASSIGNMENT',
    });
  });
  it('does not ignore an invalid future link before version eligibility', async () => {
    const { reader, version, later } = setup();
    version.effectiveSemester = later;
    await expect(reader.forCohorts(lookup)).rejects.toMatchObject({
      code: 'INVALID_COHORT_ASSIGNMENT',
    });
  });
  it('reads full program schedules and all calendar dates for the same revision regardless of query order', async () => {
    const { transaction, tx, first, later, link } = setup();
    const initial = await readProgramCohortSchedule(transaction, 'p');
    tx.semester.findMany.mockResolvedValue([later, first]);
    expect((await readProgramCohortSchedule(transaction, 'p')).revision).toBe(
      initial.revision,
    );
    tx.cohortVersion.findMany.mockResolvedValue([
      { ...link, createdAt: new Date('2025-02-01') },
    ]);
    expect(
      (await readProgramCohortSchedule(transaction, 'p')).revision,
    ).not.toBe(initial.revision);
    expect(tx.cohortVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { programVersion: { programId: 'p' } },
      }),
    );
  });
});
