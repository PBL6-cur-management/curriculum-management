import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CourseStatus,
  Prisma,
  ScopeSource,
  ScopeType,
  SyllabusStatus,
  type PermissionMode,
} from '../../generated/prisma/client.js';
import {
  AccessContext,
  type ActiveAssignment,
} from '../../shared/authz/access-context.js';
import {
  PERMISSIONS,
  type PermissionCode,
} from '../../shared/authz/permission-codes.js';
import type { CourseUsageReader } from '../../shared/courses/course-usage.reader.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import { SyllabiService } from './syllabi.service.js';

interface Cell {
  code: PermissionCode;
  mode: PermissionMode;
  all?: boolean;
}

function access(
  cells: Cell[],
  scope: { orgUnitIds?: string[]; subjectGroupIds?: string[] } = {},
): AccessContext {
  const assignment: ActiveAssignment = {
    assignmentId: null,
    roleId: 'r',
    roleCode: 'R',
    roleName: 'R',
    scopeSource: ScopeSource.NONE,
    scopeType: ScopeType.ASSIGNMENT,
    scopeUnit: null,
    scope: {
      all: false,
      orgUnitIds: new Set(scope.orgUnitIds),
      subjectGroupIds: new Set(scope.subjectGroupIds),
      programIds: new Set(),
      studentIds: new Set(),
    },
    permissions: new Map(
      cells.map((cell) => [
        cell.code,
        { mode: cell.mode, scope: cell.all ? 'ALL' : 'SCOPED' },
      ]),
    ),
  };
  return new AccessContext('user', [assignment]);
}

const VIEW_SYLLABUS: Cell = {
  code: PERMISSIONS.SYLLABUS_VIEW,
  mode: 'DIRECT',
  all: true,
};
const VIEW_PROGRAMS: Cell = {
  code: PERMISSIONS.PROGRAM_VIEW,
  mode: 'DIRECT',
  all: true,
};
const R1 = access([
  VIEW_SYLLABUS,
  VIEW_PROGRAMS,
  { code: PERMISSIONS.COURSE_EDIT, mode: 'DIRECT', all: true },
  { code: PERMISSIONS.SYLLABUS_EDIT, mode: 'DIRECT', all: true },
]);
const R3 = access(
  [
    VIEW_SYLLABUS,
    VIEW_PROGRAMS,
    { code: PERMISSIONS.SYLLABUS_EDIT, mode: 'VIA_REQUEST' },
  ],
  { orgUnitIds: ['home'] },
);
const R5 = access(
  [
    VIEW_SYLLABUS,
    VIEW_PROGRAMS,
    { code: PERMISSIONS.SYLLABUS_EDIT, mode: 'VIA_REQUEST' },
  ],
  { subjectGroupIds: ['G1'] },
);
const GRADER = access(
  [
    VIEW_SYLLABUS,
    VIEW_PROGRAMS,
    { code: PERMISSIONS.GRADING_FORMULA_EDIT, mode: 'DIRECT' },
  ],
  { orgUnitIds: ['home'] },
);
const R6 = access([
  VIEW_SYLLABUS,
  { code: PERMISSIONS.PROGRAM_VIEW, mode: 'DIRECT' },
]);

function courseRow(patch: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    courseCode: 'IT001',
    courseName: 'Nhập môn',
    englishName: null,
    credits: new Prisma.Decimal('3'),
    status: CourseStatus.ACTIVE,
    ownerFacultyId: 'home',
    ownerGroupId: 'G1',
    ownerFaculty: { unitCode: 'KHOA_CNTT' },
    ...patch,
  };
}

function revisionRow(status: SyllabusStatus, patch = {}) {
  return {
    id: `s-${status}`,
    courseId: 'c1',
    revisionNumber: 1,
    status,
    courseDescription: null,
    englishDescription: null,
    objectives: null,
    teachingMethods: null,
    assessmentMethods: null,
    references: null,
    publishedAt: status === SyllabusStatus.DRAFT ? null : new Date(),
    updatedAt: new Date(),
    weeklyContents: [],
    attachments: [],
    clos: [],
    failingScore: null,
    assessmentComponents: [],
    ...patch,
  };
}

function accessRow(status: SyllabusStatus, course = courseRow()) {
  return { id: 's1', status, courseId: 'c1', course };
}

describe('SyllabiService', () => {
  let prisma: {
    course: { findUnique: ReturnType<typeof vi.fn> };
    syllabus: {
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let service: SyllabiService;

  beforeEach(() => {
    prisma = {
      course: { findUnique: vi.fn().mockResolvedValue(courseRow()) },
      syllabus: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn(),
      },
    };
    const usage = { programsUsing: vi.fn().mockResolvedValue([]) };
    const config = { get: vi.fn().mockReturnValue(20) };
    service = new SyllabiService(
      prisma as unknown as PrismaService,
      usage as unknown as CourseUsageReader,
      config as never,
    );
  });

  describe('forCourse', () => {
    it('offers creation to a request holder in scope when there is no revision (KB-036)', async () => {
      const result = await service.forCourse('c1', R3);

      expect(result).toMatchObject({
        published: null,
        draft: null,
        canCreate: true,
        editPath: 'DIRECT',
      });
      expect(result.attachmentRules.maxBytes).toBe(20 * 1024 * 1024);
    });

    it('offers nothing to a student', async () => {
      const result = await service.forCourse('c1', R6);

      expect(result).toMatchObject({
        canCreate: false,
        editPath: null,
        draft: null,
      });
    });

    it('hides the Draft from a student and shows it to staff', async () => {
      prisma.syllabus.findMany.mockResolvedValue([
        revisionRow(SyllabusStatus.DRAFT),
      ]);

      expect((await service.forCourse('c1', R6)).draft).toBeNull();
      expect((await service.forCourse('c1', R3)).draft?.revisionNumber).toBe(1);
    });

    it('routes a foreign-faculty course through a request for a scoped holder of the same group', async () => {
      prisma.course.findUnique.mockResolvedValue(
        courseRow({ ownerFaculty: { unitCode: 'KHOA_TOAN' } }),
      );

      const result = await service.forCourse('c1', R5);

      expect(result).toMatchObject({
        editPath: 'VIA_REQUEST',
        canCreate: false,
      });
    });

    it('hides a cancelled course from callers without course.edit', async () => {
      prisma.course.findUnique.mockResolvedValue(
        courseRow({ status: CourseStatus.CANCELLED }),
      );

      await expect(service.forCourse('c1', R5)).rejects.toMatchObject({
        code: 'COURSE_NOT_FOUND',
      });
    });

    it('does not offer creation once a revision has been published', async () => {
      prisma.syllabus.findMany.mockResolvedValue([
        revisionRow(SyllabusStatus.PUBLISHED),
      ]);
      prisma.syllabus.findFirst.mockResolvedValue({ id: 's' });

      const result = await service.forCourse('c1', R1);

      expect(result).toMatchObject({
        canCreate: false,
        editPath: 'VIA_REQUEST',
      });
      expect(result.published?.status).toBe(SyllabusStatus.PUBLISHED);
    });
  });

  describe('grading capabilities', () => {
    it('opens the formula to a grading-only holder without opening the text', async () => {
      prisma.syllabus.findMany.mockResolvedValue([
        revisionRow(SyllabusStatus.DRAFT),
      ]);

      const grader = await service.forCourse('c1', GRADER);
      const author = await service.forCourse('c1', R3);

      expect(grader).toMatchObject({
        gradingEditPath: 'DIRECT',
        canEditGradingFormula: true,
        editPath: null,
      });
      expect(author).toMatchObject({
        gradingEditPath: null,
        canEditGradingFormula: false,
      });
    });

    it('routes a released syllabus through a request and shows an empty aggregate when no formula exists', async () => {
      prisma.syllabus.findMany.mockResolvedValue([
        revisionRow(SyllabusStatus.PUBLISHED),
      ]);
      prisma.syllabus.findFirst.mockResolvedValue({ id: 's' });

      const result = await service.forCourse('c1', GRADER);

      expect(result).toMatchObject({
        gradingEditPath: 'VIA_REQUEST',
        canEditGradingFormula: false,
      });
      expect(result.published?.gradingFormula).toEqual({
        failingScore: null,
        totalWeight: '0',
        components: [],
        warnings: [],
      });
    });

    it('names an uncovered CLO of the revision itself', async () => {
      prisma.syllabus.findMany.mockResolvedValue([
        revisionRow(SyllabusStatus.DRAFT, {
          clos: [
            {
              id: 'k1',
              cloCode: 'CLO1',
              description: 'd',
              englishDescription: null,
              cognitiveLevel: null,
              sortOrder: 1,
              ploLinks: [],
              _count: { assessmentLinks: 0 },
            },
          ],
        }),
      ]);

      const result = await service.forCourse('c1', GRADER);

      expect(result.draft?.gradingFormula.warnings).toMatchObject([
        { code: 'ASSESSMENT_CLO_UNCOVERED', cloId: 'k1', cloCode: 'CLO1' },
      ]);
    });
  });

  describe('create', () => {
    it('refuses a second creation', async () => {
      prisma.syllabus.count.mockResolvedValue(1);

      await expect(service.create('c1', R3)).rejects.toMatchObject({
        code: 'SYLLABUS_ALREADY_EXISTS',
      });
      expect(prisma.syllabus.create).not.toHaveBeenCalled();
    });

    it('maps a lost race on the unique index to the same conflict', async () => {
      prisma.syllabus.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.create('c1', R3)).rejects.toMatchObject({
        code: 'SYLLABUS_ALREADY_EXISTS',
      });
    });

    it('refuses a cancelled course even for R1', async () => {
      prisma.course.findUnique.mockResolvedValue(
        courseRow({ status: CourseStatus.CANCELLED }),
      );

      await expect(service.create('c1', R1)).rejects.toMatchObject({
        code: 'COURSE_CANCELLED',
      });
    });

    it('refuses a caller outside the course group and faculty', async () => {
      prisma.course.findUnique.mockResolvedValue(
        courseRow({ ownerFacultyId: 'other', ownerGroupId: 'G2' }),
      );

      await expect(service.create('c1', R5)).rejects.toMatchObject({
        code: 'OUT_OF_SCOPE',
      });
    });

    it('starts revision 1 as a Draft', async () => {
      await service.create('c1', R3);

      expect(prisma.syllabus.create).toHaveBeenCalledWith({
        data: {
          courseId: 'c1',
          revisionNumber: 1,
          status: SyllabusStatus.DRAFT,
        },
      });
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.syllabus.findUnique.mockResolvedValue(
        accessRow(SyllabusStatus.DRAFT),
      );
      prisma.syllabus.update.mockResolvedValue(
        revisionRow(SyllabusStatus.DRAFT),
      );
    });

    it('writes only the sections that were sent, sanitized', async () => {
      await service.update(
        's1',
        { objectives: '<p>Mục tiêu<script>x()</script></p>' },
        R3,
      );

      expect(prisma.syllabus.update.mock.calls[0][0].data).toEqual({
        objectives: '<p>Mục tiêu</p>',
      });
    });

    it('stores an emptied section as null', async () => {
      await service.update(
        's1',
        { englishDescription: '<p></p>', references: null },
        R3,
      );

      expect(prisma.syllabus.update.mock.calls[0][0].data).toEqual({
        englishDescription: null,
        references: null,
      });
    });

    it('is out of scope for a group member of another group', async () => {
      prisma.syllabus.findUnique.mockResolvedValue(
        accessRow(
          SyllabusStatus.DRAFT,
          courseRow({ ownerFacultyId: 'other', ownerGroupId: 'G2' }),
        ),
      );

      await expect(
        service.update('s1', { objectives: 'x' }, R5),
      ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
    });

    it('asks for a change request on a published revision before it mentions the Draft rule', async () => {
      prisma.syllabus.findUnique.mockResolvedValue(
        accessRow(SyllabusStatus.PUBLISHED),
      );
      prisma.syllabus.findFirst.mockResolvedValue({ id: 's1' });

      await expect(
        service.update('s1', { objectives: 'x' }, R1),
      ).rejects.toMatchObject({ code: 'CHANGE_REQUEST_REQUIRED' });
    });

    it('does not reveal a Draft to a student', async () => {
      await expect(
        service.update('s1', { objectives: 'x' }, R6),
      ).rejects.toMatchObject({ code: 'SYLLABUS_NOT_FOUND' });
    });

    it('refuses a revision that is not a Draft when nothing earlier blocks the write', async () => {
      prisma.syllabus.findUnique.mockResolvedValue(
        accessRow(SyllabusStatus.HISTORICAL),
      );
      // No released row is found, so only the Draft rule remains to refuse the write.
      prisma.syllabus.findFirst.mockResolvedValue(null);

      await expect(
        service.update('s1', { objectives: 'x' }, R1),
      ).rejects.toMatchObject({ code: 'SYLLABUS_NOT_DRAFT' });
    });
  });
});
