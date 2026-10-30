import { Prisma } from '../../generated/prisma/client.js';
import { readEligibilityContext } from './eligibility-context.reader.js';
import { attempt, eligibilityFixture } from './eligibility.test-fixtures.js';

function fixture() {
  const context = eligibilityFixture();
  const courses = context.rows.map((row) => ({
    id: row.course.id,
    courseCode: row.course.courseCode,
    courseName: 'Live name',
    status: 'ACTIVE',
    equivalenceGroupId: null,
    relationsAsSource: [],
  }));
  const version = {
    id: 'version',
    programId: 'program',
    status: 'ACTIVE',
    sourceRequestId: null,
    versionNumber: '1',
    decisionNumber: 'SYN',
    publishedAt: new Date('2025-01-01'),
    effectiveSemester: { id: 'semester', startDate: new Date('2025-01-01') },
    curriculumItems: context.rows.map((row) => ({
      id: row.itemId,
      courseId: row.course.id,
      course: courses.find((course) => course.id === row.course.id),
      courseNameSnapshot: row.course.courseName,
      creditsSnapshot: row.credits,
      minStudiedScore: null,
      plannedSemester: 1,
      sortOrder: row.sortOrder,
      requisites: [] as {
        id: string;
        sourceCourseId: string;
        relationType: string;
        minScore: Prisma.Decimal | null;
      }[],
    })),
  };
  const db = {
    programVersion: { findFirst: vi.fn().mockResolvedValue(version) },
    semester: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'semester',
        startDate: new Date('2026-01-01'),
      }),
    },
    course: {
      findMany: vi
        .fn()
        .mockResolvedValueOnce(courses)
        .mockResolvedValueOnce([]),
    },
  };
  return {
    context,
    version,
    courses,
    db,
    read: (attempts = [] as ReturnType<typeof attempt>[]) =>
      readEligibilityContext(db as never, context.resolution, attempts),
  };
}
describe('eligibility context reader', () => {
  it('uses supplied transaction, frozen labels, zero credits and bounded bulk phases', async () => {
    const test = fixture();
    const result = await test.read();
    expect(result.rows[0].course.courseName).toBe('Frozen A');
    expect(result.rows[0].credits.toString()).toBe('0');
    expect(result.rows[0].requisites).toEqual([]);
    expect(test.db.course.findMany).toHaveBeenCalledTimes(2);
    expect(test.db.programVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'version', programId: 'program', sourceRequestId: null },
      }),
    );
  });
  it('rejects missing snapshots rather than using catalog fallback', async () => {
    const test = fixture();
    test.db.programVersion.findFirst.mockResolvedValue({
      ...test.version,
      curriculumItems: test.version.curriculumItems.map((row, index) =>
        index === 0 ? { ...row, creditsSnapshot: null } : row,
      ),
    });
    await expect(test.read()).rejects.toMatchObject({
      code: 'ELIGIBILITY_SNAPSHOT_INCOMPLETE',
    });
  });
  it.each(['REPLACEMENT', 'PRIOR', 'PREREQUISITE'])(
    'rejects corrupt frozen %s edge',
    async (relationType) => {
      const test = fixture();
      test.version.curriculumItems[0].requisites = [
        {
          id: 'edge',
          sourceCourseId: relationType === 'PREREQUISITE' ? 'A' : 'B',
          relationType,
          minScore: new Prisma.Decimal(2),
        },
      ];
      await expect(test.read()).rejects.toMatchObject({
        code: 'ELIGIBILITY_DATA_INVALID',
      });
    },
  );
  it.each([
    attempt('A', 'PASSED', '4.01'),
    { ...attempt('A', 'PASSED'), studentId: 'other' },
    { ...attempt('A', 'PASSED'), semesterStart: new Date('2027-01-01') },
  ])('rejects malformed or inconsistent attempts', async (row) => {
    await expect(fixture().read([row])).rejects.toMatchObject({
      code: 'ELIGIBILITY_DATA_INVALID',
    });
  });
  it('rejects missing referenced course metadata', async () => {
    const test = fixture();
    test.db.course.findMany.mockReset().mockResolvedValue([]);
    await expect(test.read()).rejects.toMatchObject({
      code: 'ELIGIBILITY_DATA_INVALID',
    });
  });
});
