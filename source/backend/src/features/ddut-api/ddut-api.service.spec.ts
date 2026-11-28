import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AcademicResultStatus,
  CourseRelationType,
  CourseStatus,
  CourseType,
  Prisma,
  SyllabusMaterialKind,
  SyllabusStatus,
} from '../../generated/prisma/client.js';
import type { GraduationOutcome } from '../../shared/graduation/graduation.types.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import { eligibilityStatusText } from '../../shared/registration-eligibility/eligibility-reasons.js';
import type { RegistrationEligibilityReader } from '../../shared/registration-eligibility/registration-eligibility.reader.js';
import type { AcademicResultsReader } from '../../shared/students/academic-results.reader.js';
import type { StudentAppliedVersionReader } from '../../shared/students/student-applied-version.reader.js';
import type { GraduationService } from '../graduation/graduation.service.js';
import type { StudentPortalService } from '../student-portal/student-portal.service.js';
import { DdutApiService } from './ddut-api.service.js';
import { DdutCoursesService } from './ddut-courses.service.js';
import { DdutCourseCatalogQueryDto } from './dto/ddut-api.dto.js';

const FORBIDDEN_ID_KEYS = [
  'id',
  'itemId',
  'courseId',
  'enrollmentId',
  'programVersionId',
  'studentId',
  'programId',
  'semesterId',
  'cohortAssignmentId',
  'evidenceResultId',
  'curriculumItemId',
  'groupId',
  'attemptId',
  'equivalenceGroupId',
  'electiveGroupId',
];

function collectObjectKeys(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) collectObjectKeys(entry, found);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      found.add(key);
      collectObjectKeys(child, found);
    }
  }
  return found;
}

describe('DdutApiService & DdutCoursesService (natural codes, CUID-free)', () => {
  let courseFindMany: ReturnType<typeof vi.fn>;
  let courseCount: ReturnType<typeof vi.fn>;
  let courseFindFirst: ReturnType<typeof vi.fn>;
  let eqGroupFindMany: ReturnType<typeof vi.fn>;
  let studentFindUnique: ReturnType<typeof vi.fn>;
  let semesterFindUnique: ReturnType<typeof vi.fn>;
  let enrollmentFindFirst: ReturnType<typeof vi.fn>;
  let programVersionFindUniqueOrThrow: ReturnType<typeof vi.fn>;
  let curriculumItemFindFirst: ReturnType<typeof vi.fn>;
  let resolveForStudent: ReturnType<typeof vi.fn>;
  let resultsForStudent: ReturnType<typeof vi.fn>;
  let eligibilityEvaluate: ReturnType<typeof vi.fn>;
  let graduationLive: ReturnType<typeof vi.fn>;
  let curriculumFor: ReturnType<typeof vi.fn>;
  let syllabusProjection: ReturnType<typeof vi.fn>;
  let service: DdutApiService;

  beforeEach(() => {
    courseFindMany = vi.fn().mockResolvedValue([]);
    courseCount = vi.fn().mockResolvedValue(0);
    courseFindFirst = vi.fn().mockResolvedValue(null);
    eqGroupFindMany = vi.fn().mockResolvedValue([]);
    studentFindUnique = vi.fn().mockResolvedValue({
      id: 'cuid_student_internal',
      studentCode: '102220001',
    });
    semesterFindUnique = vi.fn().mockResolvedValue({
      id: 'cuid_semester_internal',
      semesterCode: '2610',
      startDate: new Date('2026-08-10T00:00:00.000Z'),
    });
    enrollmentFindFirst = vi.fn().mockResolvedValue({
      programId: 'cuid_program_internal',
    });
    programVersionFindUniqueOrThrow = vi.fn().mockResolvedValue({
      programName: 'Kỹ sư Công nghệ Thông tin',
      versionNumber: '1.0',
      decisionNumber: '1234/QĐ-ĐHBK',
      program: { programCode: 'CNTT-KS' },
    });
    curriculumItemFindFirst = vi.fn().mockResolvedValue({
      syllabus: {
        id: 'cuid_syllabus_internal',
        status: SyllabusStatus.PUBLISHED,
        revisionNumber: 2,
      },
    });
    resolveForStudent = vi.fn().mockResolvedValue({
      enrollmentId: 'cuid_enrollment_internal',
      programVersionId: 'cuid_version_internal',
      source: 'COHORT',
      cohortAssignmentId: 'cuid_cohort_assign_internal',
    });
    resultsForStudent = vi.fn().mockResolvedValue([{ id: 'cuid_attempt_1' }]);
    eligibilityEvaluate = vi.fn();
    graduationLive = vi.fn();
    curriculumFor = vi.fn();
    syllabusProjection = vi.fn();

    const prisma = {
      course: {
        findMany: courseFindMany,
        count: courseCount,
        findFirst: courseFindFirst,
      },
      equivalentCourseGroup: { findMany: eqGroupFindMany },
      student: { findUnique: studentFindUnique },
      semester: { findUnique: semesterFindUnique },
      programEnrollment: { findFirst: enrollmentFindFirst },
      programVersion: { findUniqueOrThrow: programVersionFindUniqueOrThrow },
      curriculumItem: { findFirst: curriculumItemFindFirst },
      $transaction: vi.fn(async (arg: unknown) => {
        if (Array.isArray(arg)) return Promise.all(arg);
        if (typeof arg === 'function') return arg(prisma);
        return arg;
      }),
    } as unknown as PrismaService;

    const coursesService = new DdutCoursesService(prisma);
    service = new DdutApiService(
      prisma,
      {
        forAccess: () => ({ resolveForStudent }),
      } as unknown as StudentAppliedVersionReader,
      {
        forAccess: () => ({ forStudent: resultsForStudent }),
      } as unknown as AcademicResultsReader,
      {
        forAccess: () => ({ evaluate: eligibilityEvaluate }),
      } as unknown as RegistrationEligibilityReader,
      { live: graduationLive } as unknown as GraduationService,
      {
        curriculumFor,
        syllabusProjection,
      } as unknown as StudentPortalService,
      coursesService,
    );
  });

  it('lists course catalog keyed strictly by natural codes with no id fields', async () => {
    courseFindMany.mockResolvedValueOnce([
      {
        courseCode: 'IT1010',
        courseName: 'Nhập môn lập trình',
        englishName: 'Intro to Programming',
        credits: new Prisma.Decimal('3.00'),
        courseType: CourseType.THEORY,
        status: CourseStatus.ACTIVE,
        updatedAt: new Date('2026-11-01T00:00:00.000Z'),
        ownerFaculty: { unitCode: 'CNTT', unitName: 'Khoa Công nghệ Thông tin' },
        ownerGroup: { groupCode: 'CNPM', groupName: 'Công nghệ phần mềm' },
        syllabi: [{ revisionNumber: 3 }],
      },
    ]);
    courseCount.mockResolvedValueOnce(1);

    const query = Object.assign(new DdutCourseCatalogQueryDto(), {
      search: 'lập trình',
      facultyCode: 'CNTT',
      page: 1,
      pageSize: 20,
    });
    const page = await service.courseCatalog(query);

    expect(page.total).toBe(1);
    expect(page.items[0]).toEqual({
      courseCode: 'IT1010',
      courseName: 'Nhập môn lập trình',
      englishName: 'Intro to Programming',
      credits: '3',
      courseType: CourseType.THEORY,
      status: CourseStatus.ACTIVE,
      ownerFacultyCode: 'CNTT',
      ownerFacultyName: 'Khoa Công nghệ Thông tin',
      ownerGroupCode: 'CNPM',
      ownerGroupName: 'Công nghệ phần mềm',
      latestSyllabusRevision: 3,
      updatedAt: '2026-11-01T00:00:00.000Z',
    });
    const keys = collectObjectKeys(page);
    for (const forbidden of FORBIDDEN_ID_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it('returns full course detail with latest published syllabus, grading formula, and relations by courseCode', async () => {
    courseFindFirst.mockResolvedValueOnce({
      courseCode: 'IT2020',
      courseName: 'Cấu trúc dữ liệu',
      englishName: 'Data Structures',
      credits: new Prisma.Decimal('3.00'),
      courseType: CourseType.THEORY,
      status: CourseStatus.ACTIVE,
      updatedAt: new Date('2026-11-15T00:00:00.000Z'),
      ownerFaculty: { unitCode: 'CNTT', unitName: 'Khoa Công nghệ Thông tin' },
      ownerGroup: { groupCode: 'KHMT', groupName: 'Khoa học máy tính' },
      equivalenceGroup: { groupCode: 'EQ-DS' },
      syllabi: [
        {
          revisionNumber: 2,
          publishedAt: new Date('2026-09-01T00:00:00.000Z'),
          documentNumber: '45/TB-CNTT',
          signedDate: new Date('2026-08-25T00:00:00.000Z'),
          courseDescription: 'Mô tả học phần',
          englishDescription: 'Course description',
          objectives: 'Mục tiêu',
          teachingMethods: 'Giảng dạy',
          assessmentMethods: 'Đánh giá',
          references: 'Tài liệu',
          failingScore: new Prisma.Decimal('4.00'),
          effectiveSemester: { semesterCode: '2610' },
          clos: [
            {
              cloCode: 'CLO1',
              description: 'Hiểu CTDL',
              englishDescription: null,
              cognitiveLevel: 'C3',
            },
          ],
          assessmentComponents: [
            {
              componentCode: 'CK',
              componentName: 'Thi cuối kỳ',
              weight: new Prisma.Decimal('50.00'),
              assessmentForm: 'Tự luận',
              isConditional: false,
              conditionThreshold: null,
              failingScore: new Prisma.Decimal('3.00'),
              mappings: [{ clo: { cloCode: 'CLO1' } }],
            },
          ],
        },
      ],
      relationsAsTarget: [
        {
          relationType: CourseRelationType.PREREQUISITE,
          minScore: new Prisma.Decimal('4.00'),
          sourceCourse: {
            courseCode: 'IT1010',
            courseName: 'Nhập môn lập trình',
          },
        },
      ],
      relationsAsSource: [
        {
          relationType: CourseRelationType.REPLACEMENT,
          minScore: null,
          targetCourse: {
            courseCode: 'IT2021',
            courseName: 'Cấu trúc dữ liệu nâng cao',
          },
        },
      ],
    });

    const detail = await service.courseDetail('IT2020');
    expect(detail.courseCode).toBe('IT2020');
    expect(detail.equivalenceGroupCode).toBe('EQ-DS');
    expect(detail.latestPublishedSyllabus?.revisionNumber).toBe(2);
    expect(detail.latestPublishedSyllabus?.effectiveSemesterCode).toBe('2610');
    expect(detail.gradingFormula).toEqual([
      {
        componentCode: 'CK',
        componentName: 'Thi cuối kỳ',
        weight: '50',
        assessmentForm: 'Tự luận',
        isConditional: false,
        conditionThreshold: null,
        failingScore: '3',
        cloCodes: ['CLO1'],
      },
    ]);
    expect(detail.relations).toEqual([
      {
        relationType: CourseRelationType.PREREQUISITE,
        sourceCourseCode: 'IT1010',
        sourceCourseName: 'Nhập môn lập trình',
        targetCourseCode: 'IT2020',
        targetCourseName: 'Cấu trúc dữ liệu',
        minScore: '4',
      },
      {
        relationType: CourseRelationType.REPLACEMENT,
        sourceCourseCode: 'IT2020',
        sourceCourseName: 'Cấu trúc dữ liệu',
        targetCourseCode: 'IT2021',
        targetCourseName: 'Cấu trúc dữ liệu nâng cao',
        minScore: null,
      },
    ]);
    const keys = collectObjectKeys(detail);
    for (const forbidden of FORBIDDEN_ID_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
    }

    courseFindFirst.mockResolvedValueOnce(null);
    await expect(service.courseDetail('UNKNOWN')).rejects.toMatchObject({
      code: 'API_COURSE_NOT_FOUND',
    });
  });

  it('strips all internal CUID fields from applicableProgram, syllabus, progress, eligibility, and graduation responses', async () => {
    const applicable = await service.applicableProgram(
      'client-1',
      '102220001',
      '2610',
    );
    expect(applicable.context).toEqual({
      studentCode: '102220001',
      programCode: 'CNTT-KS',
      programName: 'Kỹ sư Công nghệ Thông tin',
      versionNumber: '1.0',
      decisionNumber: '1234/QĐ-ĐHBK',
      semesterCode: '2610',
      semesterStartDate: '2026-08-10',
      versionSource: 'COHORT',
    });

    syllabusProjection.mockResolvedValueOnce({
      courseCode: 'IT1010',
      courseName: 'Nhập môn lập trình',
      credits: '3',
      revisionNumber: 2,
      publishedAt: '2026-09-01T00:00:00.000Z',
      courseDescription: 'Mô tả',
      objectives: null,
      teachingMethods: null,
      assessmentMethods: null,
      references: null,
      clos: [{ cloCode: 'CLO1', description: 'Mô tả CLO' }],
      weeks: [{ weekLabel: 'Tuần 1', content: 'Giới thiệu' }],
      assessments: [
        {
          componentCode: 'CK',
          componentName: 'Cuối kỳ',
          weight: '60',
          assessmentForm: 'Thi viết',
        },
      ],
      attachments: [
        {
          id: 'cuid_attachment_internal',
          fileName: 'de-cuong-IT1010.pdf',
          materialKind: SyllabusMaterialKind.SIGNED_SYLLABUS,
          sizeBytes: 10240,
        },
      ],
    });
    const syllabusRes = await service.syllabus('client-1', 'IT1010', {
      mssv: '102220001',
      semester: '2610',
    });
    expect(syllabusRes.syllabus.attachments).toEqual([
      {
        fileName: 'de-cuong-IT1010.pdf',
        materialKind: SyllabusMaterialKind.SIGNED_SYLLABUS,
        sizeBytes: 10240,
      },
    ]);

    curriculumFor.mockResolvedValueOnce({
      programName: 'Kỹ sư Công nghệ Thông tin',
      versionNumber: '1.0',
      decisionNumber: '1234/QĐ-ĐHBK',
      totalCredits: '150',
      terms: [
        {
          plannedSemester: 1,
          credits: '3',
          courses: [
            {
              itemId: 'cuid_item_internal',
              courseId: 'cuid_course_internal',
              courseCode: 'IT1010',
              courseName: 'Nhập môn lập trình',
              credits: '3',
              isElective: false,
              groupName: null,
              blockSymbol: 'CS',
              state: 'PASSED',
              attemptCount: 1,
              score10: '8.5',
              score4: '3.5',
              letterGrade: 'B+',
              hasSyllabus: true,
            },
          ],
        },
      ],
    });

    const gradOutcome: GraduationOutcome = {
      status: 'REVIEWED',
      error: null,
      result: {
        schemaVersion: 1,
        ruleVersion: 'graduation-v1',
        evaluatedAt: '2026-11-28T00:00:00.000Z',
        context: {
          studentId: 'cuid_student_internal',
          programId: 'cuid_program_internal',
          semesterId: 'cuid_semester_internal',
          enrollmentId: 'cuid_enrollment_internal',
          studentCode: '102220001',
          fullName: 'Nguyễn Văn A',
          programCode: 'CNTT-KS',
          programName: 'Kỹ sư Công nghệ Thông tin',
          cohortId: 'cuid_cohort_internal',
          cohortCode: 'K2022',
          programVersionId: 'cuid_version_internal',
          versionNumber: '1.0',
          semesterCode: '2610',
          semesterStartDate: '2026-08-10',
          versionSource: 'COHORT',
          cohortAssignmentId: 'cuid_cohort_assign_internal',
        },
        conclusion: 'NOT_ELIGIBLE',
        shortfalls: [
          {
            code: 'MANDATORY_COURSE_MISSING',
            category: 'MANDATORY_COURSE',
            curriculumItemId: 'cuid_item_2',
            course: {
              id: 'cuid_course_2',
              courseCode: 'IT3030',
              courseName: 'Mạng máy tính',
            },
            blockSymbol: 'CN',
            reason: 'NOT_TAKEN',
            message: 'Chưa học Mạng máy tính',
          },
          {
            code: 'ELECTIVE_CREDITS_MISSING',
            category: 'ELECTIVE_GROUP',
            groupId: 'cuid_group_1',
            groupCode: 'TC-CN1',
            groupName: 'Tự chọn chuyên ngành 1',
            requiredCredits: '6',
            earnedCredits: '3',
            missingCredits: '3',
            message: 'Thiếu 3 TC tự chọn',
          },
        ],
        warnings: [
          {
            code: 'EQUIVALENT_CREDIT_GAP',
            curriculumItemId: 'cuid_item_1',
            courseId: 'cuid_course_warn',
            creditGap: '1',
            message: 'Chênh lệch tín chỉ tương đương',
          },
        ],
        credits: {
          requiredTotal: '150',
          recognizedTotal: '3',
          missingTotal: '147',
          compulsory: '3',
          elective: '0',
          free: '2',
        },
        electiveGroups: [
          {
            groupId: 'cuid_group_1',
            groupCode: 'TC-CN1',
            groupName: 'Tự chọn chuyên ngành 1',
            requiredCredits: '6',
            earnedCredits: '3',
            missingCredits: '3',
            requiredCourses: null,
            earnedCourses: 1,
            missingCourses: null,
          },
        ],
        knowledgeBlocks: [],
        recognitions: [
          {
            curriculumItemId: 'cuid_item_1',
            requiredCourse: {
              id: 'cuid_course_1',
              courseCode: 'IT1010',
              courseName: 'Nhập môn lập trình',
            },
            studiedCourse: {
              id: 'cuid_course_eq',
              courseCode: 'IT1010E',
              courseName: 'Nhập môn lập trình (cũ)',
            },
            attemptId: 'cuid_attempt_1',
            attemptRevision: 1,
            completionStatus: 'PASSED',
            viaEquivalence: true,
            equivalenceGroupId: 'cuid_eq_group_1',
            requiredCredits: '3',
            recognizedCredits: '3',
            creditBasis: 'APPLIED_VERSION_SNAPSHOT',
            category: 'ELECTIVE_GROUP',
            electiveGroupId: 'cuid_group_1',
            blockSymbol: 'CS',
          },
        ],
        freeCredits: [
          {
            course: {
              id: 'cuid_course_free',
              courseCode: 'FL1001',
              courseName: 'Tiếng Nhật 1',
            },
            attemptId: 'cuid_attempt_free',
            credits: '2',
            creditBasis: 'CURRENT_CATALOG',
            reason: 'OUTSIDE_FRAME',
          },
        ],
      },
    };
    graduationLive.mockResolvedValue(gradOutcome);
    courseFindMany.mockResolvedValue([{ id: 'cuid_course_warn', courseCode: 'IT1010' }]);
    eqGroupFindMany.mockResolvedValue([{ id: 'cuid_eq_group_1', groupCode: 'EQ-IT1010' }]);

    const progressRes = await service.progress('client-1', '102220001', '2610');
    const gradRes = await service.graduationFor('client-1', '102220001', '2610');

    eligibilityEvaluate.mockResolvedValueOnce({
      evaluatedAt: new Date('2026-11-28T00:00:00.000Z'),
      context: {
        studentId: 'cuid_student_internal',
        enrollmentId: 'cuid_enrollment_internal',
        programId: 'cuid_program_internal',
        semesterId: 'cuid_semester_internal',
        programVersionId: 'cuid_version_internal',
        source: 'COHORT',
        cohortAssignmentId: 'cuid_cohort_assign_internal',
      },
      items: [
        {
          itemId: 'cuid_item_2',
          course: {
            id: 'cuid_course_2',
            courseCode: 'IT3030',
            courseName: 'Mạng máy tính',
            nameSource: 'SNAPSHOT',
          },
          credits: new Prisma.Decimal('3.00'),
          catalogStatus: CourseStatus.ACTIVE,
          plannedSemester: 5,
          completed: false,
          eligibility: 'INELIGIBLE',
          statusText: eligibilityStatusText(false, 'INELIGIBLE'),
          reasons: [
            {
              code: 'PREREQUISITE_NOT_PASSED',
              causeCode: null,
              message: 'Chưa đạt IT1010',
              relationType: 'PREREQUISITE',
              requiredCourse: {
                id: 'cuid_course_1',
                courseCode: 'IT1010',
                courseName: 'Nhập môn lập trình',
                nameSource: 'SNAPSHOT',
              },
              viaCourse: null,
              evidenceCourse: null,
              evidenceResultId: 'cuid_result_internal',
              requiredScore4: new Prisma.Decimal('1.00'),
              actualScore4: new Prisma.Decimal('0.00'),
              actualStatus: AcademicResultStatus.FAILED,
              path: [],
            },
          ],
          requiredConcurrentCourses: [],
        },
      ],
      warnings: [],
    });
    const eligRes = await service.eligibilityFor('client-1', '102220001', '2610');

    for (const payload of [
      applicable,
      syllabusRes,
      progressRes,
      eligRes,
      gradRes,
    ]) {
      const keys = collectObjectKeys(payload);
      for (const forbidden of FORBIDDEN_ID_KEYS) {
        expect(keys.has(forbidden)).toBe(false);
      }
      expect(JSON.stringify(payload)).not.toContain('cuid_');
    }

    if (gradRes.graduation.status === 'REVIEWED') {
      expect(gradRes.graduation.result.recognitions[0]).toMatchObject({
        equivalenceGroupCode: 'EQ-IT1010',
        electiveGroupCode: 'TC-CN1',
      });
      expect(gradRes.graduation.result.warnings[0]?.courseCode).toBe('IT1010');
    }
  });
});
