import { Prisma } from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import type { FileStorageService } from '../../shared/files/file-storage.service.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import type { RegistrationEligibilityReader } from '../../shared/registration-eligibility/registration-eligibility.reader.js';
import type { AcademicResultsReader } from '../../shared/students/academic-results.reader.js';
import type { StudentAppliedVersionReader } from '../../shared/students/student-applied-version.reader.js';
import { StudentPortalService } from './student-portal.service.js';

const ACCESS = {
  userId: 'u-student',
  assignments: [{ roleCode: 'R6' }],
  permissions: new Map(),
} as unknown as AccessContext;

describe('StudentPortalService.curriculumFor', () => {
  const evaluate = vi.fn();
  const forStudent = vi.fn();
  const findUniqueOrThrow = vi.fn();
  const findFirstEnrollment = vi.fn();

  function buildService(withEnrollmentModel = true) {
    const tx: Record<string, unknown> = {
      programVersion: { findUniqueOrThrow },
    };
    if (withEnrollmentModel) {
      tx.programEnrollment = { findFirst: findFirstEnrollment };
    }
    const prisma = {
      $transaction: vi.fn((fn: (client: unknown) => Promise<unknown>) =>
        fn(tx),
      ),
    } as unknown as PrismaService;
    const eligibility = {
      forAccess: vi.fn(() => ({ evaluate })),
    } as unknown as RegistrationEligibilityReader;
    const results = {
      forAccess: vi.fn(() => ({ forStudent })),
    } as unknown as AcademicResultsReader;
    const versions = {} as unknown as StudentAppliedVersionReader;
    const files = {} as unknown as FileStorageService;
    return new StudentPortalService(
      prisma,
      versions,
      results,
      eligibility,
      files,
    );
  }

  beforeEach(() => {
    evaluate.mockReset();
    forStudent.mockReset();
    findUniqueOrThrow.mockReset();
    findFirstEnrollment.mockReset();
  });

  it('returns base program credits, tracks metadata, enrolledTrackId, and per-course track tags', async () => {
    evaluate.mockResolvedValue({
      context: {
        programVersionId: 'ver-1',
        enrollmentId: 'enr-1',
      },
      items: [
        { itemId: 'item-common', completed: true },
        { itemId: 'item-cnpm', completed: false },
        { itemId: 'item-httt', completed: false },
      ],
    });
    forStudent.mockResolvedValue([
      {
        courseId: 'c-1',
        status: 'PASSED',
        isExempt: false,
        score10: '8.50',
        score4: '3.70',
        letterGrade: 'A',
      },
    ]);
    findUniqueOrThrow.mockResolvedValue({
      programName: 'Công nghệ thông tin',
      versionNumber: '2023.1',
      decisionNumber: 'QĐ-123/ĐHBK',
      totalCredits: new Prisma.Decimal('150'),
      compulsoryCredits: new Prisma.Decimal('120'),
      electiveCredits: new Prisma.Decimal('30'),
      tracks: [
        {
          id: 'tr-cnpm',
          trackCode: 'CNPM',
          trackName: 'Công nghệ phần mềm',
          englishName: 'Software Engineering',
          description: 'Thiết kế và xây dựng hệ thống phần mềm.',
          compulsoryCredits: new Prisma.Decimal('18'),
          electiveCredits: new Prisma.Decimal('6'),
          _count: { curriculumItems: 8 },
        },
        {
          id: 'tr-httt',
          trackCode: 'HTTT',
          trackName: 'Hệ thống thông tin',
          englishName: null,
          description: null,
          compulsoryCredits: null,
          electiveCredits: new Prisma.Decimal('9'),
          _count: { curriculumItems: 6 },
        },
      ],
      curriculumItems: [
        {
          id: 'item-common',
          plannedSemester: 1,
          isElective: false,
          blockSymbol: 'A',
          syllabusId: 'syl-1',
          courseNameSnapshot: 'Nhập môn lập trình',
          creditsSnapshot: new Prisma.Decimal('3'),
          electiveGroup: null,
          track: null,
          course: {
            id: 'c-1',
            courseCode: '1020010',
            courseName: 'Nhập môn lập trình',
            credits: new Prisma.Decimal('3'),
          },
        },
        {
          id: 'item-cnpm',
          plannedSemester: 6,
          isElective: false,
          blockSymbol: 'C',
          syllabusId: null,
          courseNameSnapshot: null,
          creditsSnapshot: null,
          electiveGroup: null,
          track: {
            id: 'tr-cnpm',
            trackCode: 'CNPM',
            trackName: 'Công nghệ phần mềm',
          },
          course: {
            id: 'c-2',
            courseCode: '1020210',
            courseName: 'Kiến trúc phần mềm',
            credits: new Prisma.Decimal('3'),
          },
        },
        {
          id: 'item-httt',
          plannedSemester: 6,
          isElective: true,
          blockSymbol: 'C',
          syllabusId: 'syl-3',
          courseNameSnapshot: null,
          creditsSnapshot: null,
          electiveGroup: { groupName: 'Tự chọn HTTT' },
          track: {
            id: 'tr-httt',
            trackCode: 'HTTT',
            trackName: 'Hệ thống thông tin',
          },
          course: {
            id: 'c-3',
            courseCode: '1020310',
            courseName: 'Kho dữ liệu',
            credits: new Prisma.Decimal('3'),
          },
        },
      ],
    });
    findFirstEnrollment.mockResolvedValue({ trackId: 'tr-cnpm' });

    const service = buildService(true);
    const result = await service.curriculumFor(ACCESS, {
      studentId: 'stu-1',
      programId: 'prog-1',
      semesterId: 'sem-1',
    });

    expect(result.compulsoryCredits).toBe('120');
    expect(result.electiveCredits).toBe('30');
    expect(result.enrolledTrackId).toBe('tr-cnpm');
    expect(result.tracks).toEqual([
      {
        id: 'tr-cnpm',
        trackCode: 'CNPM',
        trackName: 'Công nghệ phần mềm',
        englishName: 'Software Engineering',
        description: 'Thiết kế và xây dựng hệ thống phần mềm.',
        itemCount: 8,
        compulsoryCredits: '18',
        electiveCredits: '6',
      },
      {
        id: 'tr-httt',
        trackCode: 'HTTT',
        trackName: 'Hệ thống thông tin',
        englishName: null,
        description: null,
        itemCount: 6,
        compulsoryCredits: '0',
        electiveCredits: '9',
      },
    ]);

    expect(result.terms).toHaveLength(2);
    expect(result.terms[0].courses[0]).toMatchObject({
      itemId: 'item-common',
      trackId: null,
      trackCode: null,
      trackName: null,
      state: 'PASSED',
      hasSyllabus: true,
    });
    expect(result.terms[1].courses[0]).toMatchObject({
      itemId: 'item-cnpm',
      trackId: 'tr-cnpm',
      trackCode: 'CNPM',
      trackName: 'Công nghệ phần mềm',
      state: 'NOT_TAKEN',
      hasSyllabus: false,
    });
    expect(result.terms[1].courses[1]).toMatchObject({
      itemId: 'item-httt',
      trackId: 'tr-httt',
      trackCode: 'HTTT',
      trackName: 'Hệ thống thông tin',
      groupName: 'Tự chọn HTTT',
      isElective: true,
    });
  });

  it('guards cleanly when programEnrollment is absent from mock tx', async () => {
    evaluate.mockResolvedValue({
      context: { programVersionId: 'ver-1' },
      items: [],
    });
    forStudent.mockResolvedValue([]);
    findUniqueOrThrow.mockResolvedValue({
      programName: 'Kỹ thuật máy tính',
      versionNumber: '2024',
      decisionNumber: null,
      totalCredits: new Prisma.Decimal('130'),
      compulsoryCredits: new Prisma.Decimal('100'),
      electiveCredits: new Prisma.Decimal('30'),
      tracks: [],
      curriculumItems: [],
    });

    const service = buildService(false);
    const result = await service.curriculumFor(ACCESS, {
      studentId: 'stu-1',
      programId: 'prog-1',
      semesterId: 'sem-1',
    });

    expect(result.enrolledTrackId).toBeNull();
    expect(result.tracks).toEqual([]);
    expect(result.compulsoryCredits).toBe('100');
    expect(result.electiveCredits).toBe('30');
  });
});
