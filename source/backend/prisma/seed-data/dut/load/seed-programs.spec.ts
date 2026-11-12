import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../../../src/generated/prisma/client.js';
import type { DutProgramsFile, DutVersion } from '../dut-data.js';
import type { CatalogSeedResult } from './seed-catalog.js';
import { seedDutPrograms } from './seed-programs.js';

const version: DutVersion = {
  frameCode: '1024007',
  programName: 'Công nghệ Thông tin K2024 Đặc thù',
  majorCode: '7480201',
  majorName: 'Công nghệ Thông tin',
  semesterCount: 8,
  totalCredits: '130',
  compulsoryCredits: '122',
  electiveCredits: '8',
  startSemesterCode: '2410',
  cohortCode: null,
  groups: [],
  items: [
    {
      courseCode: '1020013',
      plannedSemester: 1,
      sortOrder: 1,
      isElective: false,
      groupCode: null,
      htDa: true,
      tqDa: false,
      note: null,
    },
  ],
  requisites: [],
};
const file = {
  programs: [
    { programCode: 'CNTT-CN-DT', degreeLevel: 'BACHELOR', versions: [version] },
  ],
} as DutProgramsFile;
const catalog = {
  courseIds: new Map([['1020013', 'course-1']]),
  courses: new Map([
    ['1020013', { courseName: 'Tin học đại cương', credits: '2' }],
  ]),
  semesterIds: new Map([
    [
      '2410',
      { id: 'sem-1', startDate: new Date('2024-07-29T00:00:00Z') },
    ],
  ]),
  semesterIdsByLegacyCode: new Map(),
  cohortIds: new Map(),
} as unknown as CatalogSeedResult;

describe('seedDutPrograms', () => {
  it('skips a program that already exists without touching its versions', async () => {
    const prisma = {
      program: { findUnique: vi.fn().mockResolvedValue({ id: 'p1' }) },
      programVersion: { update: vi.fn(), findMany: vi.fn() },
      $transaction: vi.fn(),
    } as unknown as PrismaClient;

    const result = await seedDutPrograms(prisma, file, {
      facultyId: 'f1',
      publisherId: 'u1',
      catalog,
    });

    expect(result).toEqual({ created: [], skippedExisting: ['CNTT-CN-DT'] });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.programVersion.update).not.toHaveBeenCalled();
  });

  it('releases a version without a decision number and freezes its rows', async () => {
    const tx = {
      program: { create: vi.fn().mockResolvedValue({ id: 'p1' }) },
      programVersion: { create: vi.fn().mockResolvedValue({ id: 'v1' }) },
      electiveGroup: { createManyAndReturn: vi.fn() },
      curriculumItem: {
        createManyAndReturn: vi
          .fn()
          .mockResolvedValue([{ id: 'i1', courseId: 'course-1' }]),
      },
      curriculumRequisite: { createMany: vi.fn() },
      cohortVersion: { create: vi.fn() },
    };
    const prisma = {
      program: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn((work: (client: typeof tx) => Promise<void>) =>
        work(tx),
      ),
    } as unknown as PrismaClient;

    const result = await seedDutPrograms(prisma, file, {
      facultyId: 'f1',
      publisherId: 'u1',
      catalog,
    });

    expect(result.created).toEqual(['CNTT-CN-DT']);
    const data = tx.programVersion.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      versionNumber: '1.0',
      effectiveSemesterId: 'sem-1',
    });
    expect(data).not.toHaveProperty('decisionNumber');
    expect(data).not.toHaveProperty('signedDate');
    expect(
      tx.curriculumItem.createManyAndReturn.mock.calls[0][0].data[0],
    ).toMatchObject({
      courseNameSnapshot: 'Tin học đại cương',
      creditsSnapshot: '2',
    });
  });
});
