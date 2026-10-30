import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { AppException } from '../exception/app.exception.js';
import type { AcademicAttemptFact } from '../students/best-academic-results.js';
import type { GraduationReaderCapability } from './graduation-capability.js';
import {
  decodeGraduationInput,
  encodeGraduationInput,
  graduationInputDigest,
} from './graduation-input.codec.js';
import { GraduationInputReader } from './graduation-input.reader.js';

const START = '2026-09-01T00:00:00.000Z';

function fixture() {
  const catalog = [
    {
      id: 'course-a',
      courseCode: 'SYN101',
      courseName: 'Tên danh mục đã sửa',
      courseType: 'THEORY' as const,
      credits: new Prisma.Decimal('9'),
      equivalenceGroupId: 'eq',
    },
    {
      id: 'course-old',
      courseCode: 'OLD101',
      courseName: 'Học phần đã ngừng mở',
      courseType: 'THEORY' as const,
      credits: new Prisma.Decimal('2.50'),
      equivalenceGroupId: 'eq',
    },
    {
      id: 'course-transitive',
      courseCode: 'SYN102',
      courseName: 'Học phần cùng lớp',
      courseType: 'LAB' as const,
      credits: new Prisma.Decimal('1'),
      equivalenceGroupId: 'eq',
    },
  ];
  const frame = [
    {
      id: 'row-a',
      versionId: 'version-resolved',
      courseId: 'course-a',
      course: catalog[0]!,
      creditsSnapshot: new Prisma.Decimal('3.25') as Prisma.Decimal | null,
      courseNameSnapshot: 'Tên khi ban hành' as string | null,
      isElective: false,
      electiveGroupId: null as string | null,
      blockSymbol: 'UNKNOWN' as string | null,
      plannedSemester: 1,
      sortOrder: 0,
    },
  ];
  const version = {
    id: 'version-resolved',
    programId: 'program',
    status: 'ARCHIVED',
    sourceRequestId: null as string | null,
    versionNumber: '1.0',
    decisionNumber: 'SYN-QD',
    publishedAt: new Date('2024-01-01T00:00:00.000Z'),
    effectiveSemester: { startDate: new Date('2024-09-01T00:00:00.000Z') },
    programName: 'Chương trình tổng hợp',
    program: { programCode: 'SYN' },
    totalCredits: new Prisma.Decimal('3.25'),
    compulsoryCredits: new Prisma.Decimal('3.25'),
    electiveCredits: new Prisma.Decimal('0'),
    curriculumItems: frame,
    electiveGroups: [] as Array<{
      id: string;
      groupCode: string;
      groupName: string;
      minCredits: Prisma.Decimal | null;
      minCourses: number | null;
    }>,
  };
  const enrollment = {
    id: 'enrollment',
    studentId: 'student',
    programId: 'program',
    appliedVersionId: 'stale-pin',
    cohortId: 'enrollment-cohort',
    cohort: { cohortCode: 'SYN24' },
    student: {
      studentCode: 'SYN001',
      fullName: 'Sinh viên tổng hợp',
      cohortId: 'other-cohort',
    },
  };
  const attempts: AcademicAttemptFact[] = [
    {
      id: 'attempt-old',
      studentId: 'student',
      courseId: 'course-old',
      semesterId: 'previous-semester',
      semesterStart: new Date('2025-01-01T00:00:00.000Z'),
      score10: '8.00',
      score4: '3.00',
      letterGrade: 'B',
      status: 'PASSED',
      revision: 2,
      dataSource: 'EXCEL',
    },
    {
      id: 'attempt-current',
      studentId: 'student',
      courseId: 'course-a',
      semesterId: 'semester',
      semesterStart: new Date(START),
      score10: null,
      score4: null,
      letterGrade: null,
      status: 'IN_PROGRESS',
      revision: 1,
      dataSource: 'SCHOOL_DB',
    },
  ];
  const db = {
    programEnrollment: { findUnique: vi.fn().mockResolvedValue(enrollment) },
    semester: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'semester',
        semesterCode: '2026.1',
        startDate: new Date(START),
      }),
    },
    programVersion: { findUnique: vi.fn().mockResolvedValue(version) },
    course: {
      findMany: vi
        .fn()
        .mockResolvedValueOnce(catalog.slice(0, 2))
        .mockResolvedValueOnce(catalog),
    },
    knowledgeBlock: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const capability: GraduationReaderCapability = {
    resolve: vi.fn().mockResolvedValue({
      studentId: 'student',
      programId: 'program',
      semesterId: 'semester',
      enrollmentId: 'enrollment',
      programVersionId: 'version-resolved',
      source: 'COHORT',
      cohortAssignmentId: 'assignment',
    }),
    attempts: vi.fn().mockResolvedValue(attempts),
  };
  const tx = db as unknown as Prisma.TransactionClient;
  return {
    db,
    tx,
    capability,
    version,
    enrollment,
    attempts,
    catalog,
    read: () => new GraduationInputReader().read(capability, tx),
  };
}

describe('GraduationInputReader', () => {
  it('uses resolved historical version, enrollment cohort, frozen frame and student-wide attempts', async () => {
    const data = fixture();
    const input = await data.read();
    expect(data.capability.resolve).toHaveBeenCalledWith(data.tx);
    expect(data.capability.attempts).toHaveBeenCalledWith(data.tx);
    expect(data.db.programVersion.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'version-resolved' } }),
    );
    expect(input.context).toMatchObject({
      programVersionId: 'version-resolved',
      cohortId: 'enrollment-cohort',
      cohortCode: 'SYN24',
    });
    expect(input.frame[0]).toMatchObject({
      course: { courseName: 'Tên khi ban hành' },
      credits: '3.25',
      blockSymbol: 'UNKNOWN',
    });
    expect(
      input.courses.find((course) => course.course.id === 'course-a'),
    ).toMatchObject({
      credits: '3.25',
      creditBasis: 'APPLIED_VERSION_SNAPSHOT',
    });
    expect(
      input.courses.find((course) => course.course.id === 'course-old'),
    ).toMatchObject({ credits: '2.5', creditBasis: 'CURRENT_CATALOG' });
    expect(input.courses).toHaveLength(3);
    expect(input.attempts).toHaveLength(2);
    expect(
      input.attempts.find((attempt) => attempt.id === 'attempt-old')?.score4,
    ).toBe('3.00');
    expect(data.db.course.findMany).toHaveBeenCalledTimes(2);
  });

  it('retains exception resolution and allows future semesters without a latest-version fallback', async () => {
    const data = fixture();
    vi.mocked(data.capability.resolve).mockResolvedValue({
      studentId: 'student',
      programId: 'program',
      semesterId: 'semester',
      enrollmentId: 'enrollment',
      programVersionId: 'version-resolved',
      source: 'EXCEPTION',
      cohortAssignmentId: null,
    });
    data.db.semester.findUnique.mockResolvedValue({
      id: 'semester',
      semesterCode: '2028.1',
      startDate: new Date('2028-09-01T00:00:00.000Z'),
    });
    data.attempts[1]!.semesterId = 'earlier-semester';
    expect((await data.read()).context).toMatchObject({
      versionSource: 'EXCEPTION',
      cohortAssignmentId: null,
      semesterStartDate: '2028-09-01T00:00:00.000Z',
    });
  });

  it.each([
    'name',
    'credits',
    'empty',
    'draft',
    'unpublished',
    'working-copy',
    'not-effective',
  ])('rejects incomplete issued source: %s', async (kind) => {
    const data = fixture();
    if (kind === 'name')
      data.version.curriculumItems[0]!.courseNameSnapshot = null;
    if (kind === 'credits')
      data.version.curriculumItems[0]!.creditsSnapshot = null;
    if (kind === 'empty') data.version.curriculumItems = [];
    if (kind === 'draft') data.version.status = 'DRAFT';
    if (kind === 'unpublished') data.version.decisionNumber = '';
    if (kind === 'working-copy') data.version.sourceRequestId = 'request';
    if (kind === 'not-effective')
      data.version.effectiveSemester.startDate = new Date(
        '2027-01-01T00:00:00.000Z',
      );
    await expect(data.read()).rejects.toMatchObject({
      code: 'GRADUATION_SNAPSHOT_INCOMPLETE',
    });
  });

  it.each([
    'program',
    'student',
    'attempt-owner',
    'future-attempt',
    'unknown-date',
    'foreign-group',
    'negative',
    'empty-minima',
    'missing-course',
    'duplicate-course',
  ])('rejects inconsistent inputs: %s', async (kind) => {
    const data = fixture();
    if (kind === 'program') data.version.programId = 'wrong';
    if (kind === 'student') data.enrollment.studentId = 'wrong';
    if (kind === 'attempt-owner') data.attempts[0]!.studentId = 'wrong';
    if (kind === 'future-attempt')
      data.attempts[0]!.semesterStart = new Date('2029-01-01T00:00:00.000Z');
    if (kind === 'unknown-date')
      data.attempts[0]!.semesterStart = new Date('invalid');
    if (kind === 'foreign-group')
      Object.assign(data.version.curriculumItems[0]!, {
        isElective: true,
        electiveGroupId: 'foreign',
      });
    if (kind === 'negative')
      data.version.totalCredits = new Prisma.Decimal('-1');
    if (kind === 'empty-minima')
      data.version.electiveGroups.push({
        id: 'group',
        groupCode: 'G',
        groupName: 'Nhóm',
        minCredits: null,
        minCourses: null,
      });
    if (kind === 'missing-course')
      data.db.course.findMany.mockReset().mockResolvedValue([]);
    if (kind === 'duplicate-course')
      data.version.curriculumItems.push({
        ...data.version.curriculumItems[0]!,
        id: 'duplicate',
      });
    await expect(data.read()).rejects.toBeInstanceOf(AppException);
  });
});

describe('graduation input codec and digest', () => {
  it('round trips exact decimals and canonicalizes order without mutating input', async () => {
    const input = await fixture().read();
    input.frame[0]!.credits = '3.2500';
    input.courses.find((course) => course.course.id === 'course-a')!.credits =
      '3.2500';
    const original = structuredClone(input);
    const encoded = encodeGraduationInput(input);
    expect(decodeGraduationInput(encoded as Prisma.JsonValue)).toEqual(input);
    const reversed = structuredClone(input);
    reversed.attempts.reverse();
    reversed.courses.reverse();
    expect(graduationInputDigest(reversed)).toBe(graduationInputDigest(input));
    expect(graduationInputDigest(input)).toMatch(/^[a-f0-9]{64}$/);
    expect(input).toEqual(original);
  });

  it.each([
    'revision',
    'membership',
    'credits',
    'status',
    'minimum',
    'context',
  ])('changes digest for academic fact: %s', async (kind) => {
    const input = await fixture().read();
    const changed = structuredClone(input);
    if (kind === 'revision') changed.attempts[0]!.revision++;
    if (kind === 'membership') changed.courses[0]!.equivalenceGroupId = 'new';
    if (kind === 'credits') changed.version.totalCredits = '3.5';
    if (kind === 'status')
      changed.attempts.find((attempt) => attempt.status === 'PASSED')!.status =
        'FAILED';
    if (kind === 'minimum')
      changed.groups.push({
        id: 'group',
        groupCode: 'G',
        groupName: 'Nhóm',
        minCredits: '2.5',
        minCourses: 1,
      });
    if (kind === 'context') changed.context.programVersionId = 'different';
    expect(graduationInputDigest(changed)).not.toBe(
      graduationInputDigest(input),
    );
  });

  it.each([
    'unknown-status',
    'bad-date',
    'bad-decimal',
    'missing-field',
    'unknown-field',
    'bad-enum',
    'duplicate-attempt',
    'inconsistent-date',
    'missing-score',
    'negative-revision',
  ])('validates nested boundary: %s', async (kind) => {
    const input = await fixture().read();
    if (kind === 'unknown-status')
      Object.assign(input.attempts[0]!, { status: 'UNKNOWN' });
    if (kind === 'bad-date') input.context.semesterStartDate = '2026-09-01';
    if (kind === 'bad-decimal') input.version.totalCredits = 'NaN';
    if (kind === 'missing-field')
      Reflect.deleteProperty(input.courses[0]!, 'credits');
    if (kind === 'unknown-field')
      Object.assign(input.frame[0]!, { unexpected: true });
    if (kind === 'bad-enum')
      Object.assign(input.courses[0]!, { creditBasis: 'HISTORICAL' });
    if (kind === 'duplicate-attempt')
      input.attempts.push({ ...input.attempts[0]! });
    if (kind === 'inconsistent-date')
      input.attempts.find(
        (attempt) => attempt.id === 'attempt-old',
      )!.semesterId = input.context.semesterId;
    if (kind === 'missing-score')
      input.attempts.find((attempt) => attempt.status === 'PASSED')!.score4 =
        null;
    if (kind === 'negative-revision') input.attempts[0]!.revision = -1;
    expect(() => encodeGraduationInput(input)).toThrow(AppException);
  });

  it('rejects unsupported versions rather than recomputing history', async () => {
    const input = await fixture().read();
    Object.assign(input, { schemaVersion: 2 });
    expect(() => encodeGraduationInput(input)).toThrow(
      expect.objectContaining({
        code: 'GRADUATION_UNSUPPORTED_SCHEMA_VERSION',
      }),
    );
  });
});
