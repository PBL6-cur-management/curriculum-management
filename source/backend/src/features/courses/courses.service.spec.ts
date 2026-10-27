import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CourseStatus,
  CourseType,
  OrgUnitStatus,
  OrgUnitType,
  Prisma,
  ScopeSource,
  ScopeType,
  SubjectGroupStatus,
  type PermissionMode,
} from '../../generated/prisma/client.js';
import {
  AccessContext,
  type ActiveAssignment,
} from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { CourseUsageReader } from '../../shared/courses/course-usage.reader.js';
import { HOME_FACULTY_CODE } from '../../shared/org-units/home-faculty.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { CourseQueryDto } from './course-query.dto.js';
import { COURSE_INCLUDE, type CourseRow } from './course.dto.js';
import { CoursesService } from './courses.service.js';
import { CreateCourseDto } from './create-course.dto.js';

const NOW = new Date('2026-10-19T00:00:00.000Z');
const HOME = { id: 'home', unitCode: HOME_FACULTY_CODE, unitName: 'Khoa CNTT' };
const MATH = { id: 'math', unitCode: 'KHOA_TOAN', unitName: 'Khoa Toán' };
const G1 = {
  id: 'g1',
  groupCode: 'G1',
  groupName: 'G1',
  status: SubjectGroupStatus.ACTIVE,
};

function row(patch: Partial<CourseRow> = {}): CourseRow {
  return {
    id: 'course',
    courseCode: 'IT001',
    courseName: 'Nhập môn',
    englishName: null,
    credits: new Prisma.Decimal('2.50'),
    courseType: CourseType.THEORY,
    status: CourseStatus.ACTIVE,
    ownerFacultyId: HOME.id,
    ownerFaculty: HOME,
    ownerGroupId: G1.id,
    ownerGroup: G1,
    equivalenceGroupId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...patch,
  };
}

interface Cell {
  code: typeof PERMISSIONS.COURSE_EDIT | typeof PERMISSIONS.COURSE_VIEW;
  mode: PermissionMode;
  all?: boolean;
}

function access(
  cells: Cell[],
  scope: { orgUnitIds?: string[]; subjectGroupIds?: string[] } = {},
): AccessContext {
  const assignment: ActiveAssignment = {
    assignmentId: 'a',
    roleId: 'r',
    roleCode: 'R',
    roleName: 'R',
    scopeSource: ScopeSource.NONE,
    scopeType: ScopeType.UNIT,
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
        {
          mode: cell.mode,
          scope: cell.all ? ('ALL' as const) : ('SCOPED' as const),
        },
      ]),
    ),
  };
  return new AccessContext('user', [assignment]);
}

const R1 = access([
  { code: PERMISSIONS.COURSE_VIEW, mode: 'DIRECT', all: true },
  { code: PERMISSIONS.COURSE_EDIT, mode: 'DIRECT', all: true },
]);
const R3 = access([
  { code: PERMISSIONS.COURSE_VIEW, mode: 'DIRECT', all: true },
  { code: PERMISSIONS.COURSE_EDIT, mode: 'VIA_REQUEST', all: true },
]);
const R4 = access(
  [
    { code: PERMISSIONS.COURSE_VIEW, mode: 'DIRECT', all: true },
    { code: PERMISSIONS.COURSE_EDIT, mode: 'VIA_REQUEST' },
  ],
  { subjectGroupIds: ['g1'] },
);
const R6 = access([
  { code: PERMISSIONS.COURSE_VIEW, mode: 'DIRECT', all: true },
]);

const CREATE = {
  courseCode: 'IT002',
  courseName: 'Lập trình',
  credits: '2.5',
  courseType: CourseType.THEORY,
  ownerFacultyId: HOME.id,
} satisfies CreateCourseDto;

function query(patch: Partial<CourseQueryDto> = {}): CourseQueryDto {
  return Object.assign(new CourseQueryDto(), patch);
}

describe('CoursesService', () => {
  let course: Record<
    'findMany' | 'findUnique' | 'count' | 'create' | 'update',
    ReturnType<typeof vi.fn>
  >;
  let orgUnit: { findUnique: ReturnType<typeof vi.fn> };
  let subjectGroup: { findUnique: ReturnType<typeof vi.fn> };
  let courseRelation: { upsert: ReturnType<typeof vi.fn> };
  let equivalentCourseGroup: { findUnique: ReturnType<typeof vi.fn> };
  let usage: Record<keyof CourseUsageReader, ReturnType<typeof vi.fn>>;
  let service: CoursesService;

  beforeEach(() => {
    course = {
      findMany: vi.fn().mockResolvedValue([row()]),
      findUnique: vi.fn().mockResolvedValue(row()),
      count: vi.fn().mockResolvedValue(1),
      create: vi
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve(
            row({ ...data, credits: new Prisma.Decimal(data.credits) }),
          ),
        ),
      update: vi
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve(row(stripUndefined(data))),
        ),
    };
    orgUnit = {
      findUnique: vi.fn().mockResolvedValue({
        ...HOME,
        unitType: OrgUnitType.FACULTY,
        status: OrgUnitStatus.ACTIVE,
      }),
    };
    subjectGroup = {
      findUnique: vi.fn().mockResolvedValue({ ...G1, facultyId: HOME.id }),
    };
    usage = {
      releasedCourseIds: vi.fn().mockResolvedValue(new Set()),
      inReleasedVersion: vi.fn().mockResolvedValue(false),
      hasStudyResults: vi.fn().mockResolvedValue(false),
      programsUsing: vi.fn().mockResolvedValue([]),
      hasActiveReplacement: vi.fn().mockResolvedValue(false),
    };
    courseRelation = { upsert: vi.fn().mockResolvedValue({}) };
    equivalentCourseGroup = { findUnique: vi.fn().mockResolvedValue(null) };
    const client: Record<string, unknown> = {
      course,
      orgUnit,
      subjectGroup,
      courseRelation,
      equivalentCourseGroup,
    };
    // Interactive transactions run the callback against the same mock; array transactions resolve together.
    client.$transaction = (work: unknown) =>
      typeof work === 'function'
        ? (work as (tx: unknown) => Promise<unknown>)(client)
        : Promise.all(work as Promise<unknown>[]);
    service = new CoursesService(
      client as unknown as PrismaService,
      usage as unknown as CourseUsageReader,
    );
  });

  describe('list', () => {
    it('searches code and name case-insensitively', async () => {
      await service.list(query({ q: 'it0' }), R1);
      expect(course.findMany.mock.calls[0][0].where.AND).toEqual([
        {
          OR: [
            { courseCode: { contains: 'it0', mode: 'insensitive' } },
            { courseName: { contains: 'it0', mode: 'insensitive' } },
          ],
        },
      ]);
    });

    it('hides cancelled courses from callers without course.edit', async () => {
      await service.list(query(), R6);
      expect(course.findMany.mock.calls[0][0].where.AND).toEqual([
        { status: { not: CourseStatus.CANCELLED } },
      ]);
      await service.list(query(), R1);
      expect(course.findMany.mock.calls[1][0].where.AND).toEqual([]);
    });

    it('filters by a list of statuses', async () => {
      await service.list(
        query({ status: [CourseStatus.ACTIVE, CourseStatus.DISCONTINUED] }),
        R1,
      );
      expect(course.findMany.mock.calls[0][0].where.status).toEqual({
        in: [CourseStatus.ACTIVE, CourseStatus.DISCONTINUED],
      });
      await service.list(query(), R1);
      expect(course.findMany.mock.calls[1][0].where.status).toBeUndefined();
    });

    it.each([
      [true, { not: HOME_FACULTY_CODE }],
      [false, HOME_FACULTY_CODE],
    ])(
      'filters foreign=%s by the home faculty code',
      async (foreign, unitCode) => {
        await service.list(query({ foreign }), R1);
        expect(course.findMany.mock.calls[0][0].where.AND).toEqual([
          { ownerFaculty: { unitCode } },
        ]);
      },
    );

    it('sorts with the code as tie-breaker and returns the page', async () => {
      const page = await service.list(
        query({ sort: 'credits', order: 'desc', page: 2, pageSize: 10 }),
        R1,
      );
      expect(course.findMany.mock.calls[0][0]).toMatchObject({
        orderBy: [{ credits: 'desc' }, { courseCode: 'asc' }],
        skip: 10,
        take: 10,
        include: COURSE_INCLUDE,
      });
      expect(page).toMatchObject({ total: 1, page: 2, pageSize: 10 });
      expect(page.items[0]).toMatchObject({ credits: '2.5', isForeign: false });
    });
  });

  describe('detail', () => {
    it('does not reveal a cancelled course to callers without course.edit', async () => {
      course.findUnique.mockResolvedValue(
        row({ status: CourseStatus.CANCELLED }),
      );
      await expect(service.detail('course', R6)).rejects.toMatchObject({
        code: 'COURSE_NOT_FOUND',
      });
      await expect(service.detail('course', R1)).resolves.toMatchObject({
        status: CourseStatus.CANCELLED,
        editPath: null,
        canChangeStatus: false,
      });
    });

    it('reports the edit path the caller would take', async () => {
      const r5 = access(
        [
          { code: PERMISSIONS.COURSE_VIEW, mode: 'DIRECT', all: true },
          { code: PERMISSIONS.COURSE_EDIT, mode: 'VIA_REQUEST' },
        ],
        { subjectGroupIds: ['g1'] },
      );
      await expect(service.detail('course', r5)).resolves.toMatchObject({
        editPath: 'DIRECT',
        canChangeStatus: false,
      });
      const outside = access(
        [
          { code: PERMISSIONS.COURSE_VIEW, mode: 'DIRECT', all: true },
          { code: PERMISSIONS.COURSE_EDIT, mode: 'VIA_REQUEST' },
        ],
        { subjectGroupIds: ['g2'] },
      );
      await expect(service.detail('course', outside)).resolves.toMatchObject({
        editPath: null,
      });
      usage.inReleasedVersion.mockResolvedValue(true);
      await expect(service.detail('course', R1)).resolves.toMatchObject({
        editPath: 'VIA_REQUEST',
        canChangeStatus: true,
      });
    });
  });

  describe('equivalence group on the detail', () => {
    it('is null for a course in no group and lists the other members otherwise (US-017 AC1)', async () => {
      await expect(service.detail('course', R6)).resolves.toMatchObject({
        equivalenceGroup: null,
      });
      expect(equivalentCourseGroup.findUnique).not.toHaveBeenCalled();
      course.findUnique.mockResolvedValue(row({ equivalenceGroupId: 'grp' }));
      equivalentCourseGroup.findUnique.mockResolvedValue({
        id: 'grp',
        groupCode: 'EQ1',
        members: [
          {
            id: 'b',
            courseCode: 'IT900',
            courseName: 'B',
            credits: new Prisma.Decimal('3.00'),
            status: CourseStatus.ACTIVE,
          },
        ],
      });
      const detail = await service.detail('course', R6);
      expect(detail.equivalenceGroup).toEqual({
        id: 'grp',
        groupCode: 'EQ1',
        members: [
          {
            id: 'b',
            courseCode: 'IT900',
            courseName: 'B',
            credits: '3',
            status: CourseStatus.ACTIVE,
          },
        ],
      });
      expect(
        equivalentCourseGroup.findUnique.mock.calls[0][0].select.members.where,
      ).toEqual({ id: { not: 'course' } });
    });
  });

  describe('create', () => {
    it('creates a foreign course as R1 and flags it', async () => {
      orgUnit.findUnique.mockResolvedValue({
        ...MATH,
        unitType: OrgUnitType.FACULTY,
        status: OrgUnitStatus.ACTIVE,
      });
      course.create.mockResolvedValue(
        row({
          ownerFacultyId: MATH.id,
          ownerFaculty: MATH,
          ownerGroupId: null,
          ownerGroup: null,
        }),
      );
      const created = await service.create(
        { ...CREATE, ownerFacultyId: MATH.id },
        R1,
      );
      expect(created.isForeign).toBe(true);
      expect(course.create.mock.calls[0][0].data.ownerGroupId).toBeNull();
    });

    it('asks R3 to use a change request for a foreign course', async () => {
      orgUnit.findUnique.mockResolvedValue({
        ...MATH,
        unitType: OrgUnitType.FACULTY,
        status: OrgUnitStatus.ACTIVE,
      });
      await expect(
        service.create({ ...CREATE, ownerFacultyId: MATH.id }, R3),
      ).rejects.toMatchObject({ code: 'CHANGE_REQUEST_REQUIRED' });
    });

    it('lets R3 create a home-faculty course directly (draft is open)', async () => {
      await expect(service.create(CREATE, R3)).resolves.toMatchObject({
        courseCode: 'IT002',
      });
    });

    it('refuses a group outside the caller scope', async () => {
      const r5 = access(
        [
          { code: PERMISSIONS.COURSE_VIEW, mode: 'DIRECT', all: true },
          { code: PERMISSIONS.COURSE_EDIT, mode: 'VIA_REQUEST' },
        ],
        { subjectGroupIds: ['g2'] },
      );
      await expect(
        service.create({ ...CREATE, ownerGroupId: G1.id }, r5),
      ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
    });

    it('refuses a group of another faculty, naming the field', async () => {
      subjectGroup.findUnique.mockResolvedValue({ ...G1, facultyId: 'other' });
      await expect(
        service.create({ ...CREATE, ownerGroupId: G1.id }, R1),
      ).rejects.toMatchObject({
        code: 'OWNER_GROUP_INVALID',
        details: [{ field: 'ownerGroupId' }],
      });
    });

    it('refuses an inactive group', async () => {
      subjectGroup.findUnique.mockResolvedValue({
        ...G1,
        status: SubjectGroupStatus.INACTIVE,
        facultyId: HOME.id,
      });
      await expect(
        service.create({ ...CREATE, ownerGroupId: G1.id }, R1),
      ).rejects.toMatchObject({ code: 'OWNER_GROUP_INVALID' });
    });

    it('refuses an owner that is not an active faculty', async () => {
      orgUnit.findUnique.mockResolvedValue({
        ...HOME,
        unitType: OrgUnitType.OFFICE,
        status: OrgUnitStatus.ACTIVE,
      });
      await expect(service.create(CREATE, R1)).rejects.toMatchObject({
        code: 'OWNER_FACULTY_INVALID',
      });
    });

    it('maps a duplicate code', async () => {
      course.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      await expect(service.create(CREATE, R1)).rejects.toMatchObject({
        code: 'COURSE_CODE_TAKEN',
        details: [{ field: 'courseCode' }],
      });
    });
  });

  describe('update', () => {
    it('lets a group holder edit an unreleased course of the group', async () => {
      await expect(
        service.update('course', { courseName: 'Mới', credits: '3' }, R4),
      ).resolves.toMatchObject({ courseName: 'Mới' });
      expect(course.update.mock.calls[0][0].data).toMatchObject({
        courseName: 'Mới',
        ownerFacultyId: undefined,
        ownerGroupId: undefined,
      });
    });

    it('asks for a change request once the course is in a released version', async () => {
      usage.inReleasedVersion.mockResolvedValue(true);
      await expect(
        service.update('course', { courseName: 'Mới' }, R1),
      ).rejects.toMatchObject({ code: 'CHANGE_REQUEST_REQUIRED' });
    });

    it('refuses moving a course to a group the caller does not coordinate', async () => {
      subjectGroup.findUnique.mockResolvedValue({
        ...G1,
        id: 'g2',
        facultyId: HOME.id,
      });
      await expect(
        service.update('course', { ownerGroupId: 'g2' }, R4),
      ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
    });

    it('does not revalidate owners that did not change', async () => {
      await service.update(
        'course',
        { ownerFacultyId: HOME.id, ownerGroupId: G1.id, courseName: 'Mới' },
        R1,
      );
      expect(orgUnit.findUnique).not.toHaveBeenCalled();
    });

    it('clears the group with null', async () => {
      await service.update('course', { ownerGroupId: null }, R1);
      expect(course.update.mock.calls[0][0].data.ownerGroupId).toBeNull();
    });

    it('refuses a cancelled course', async () => {
      course.findUnique.mockResolvedValue(
        row({ status: CourseStatus.CANCELLED }),
      );
      await expect(
        service.update('course', { courseName: 'Mới' }, R1),
      ).rejects.toMatchObject({ code: 'COURSE_CANCELLED' });
    });
  });

  describe('transition', () => {
    it('refuses to discontinue without an active replacement', async () => {
      await expect(
        service.transition('course', 'discontinue', R1),
      ).rejects.toMatchObject({ code: 'REPLACEMENT_REQUIRED' });
      expect(course.update).not.toHaveBeenCalled();
    });

    it('discontinues when the reader finds a replacement, then reopens', async () => {
      usage.hasActiveReplacement.mockResolvedValue(true);
      await expect(
        service.transition('course', 'discontinue', R1),
      ).resolves.toMatchObject({ status: CourseStatus.DISCONTINUED });
      course.findUnique.mockResolvedValue(
        row({ status: CourseStatus.DISCONTINUED }),
      );
      await expect(
        service.transition('course', 'reopen', R1),
      ).resolves.toMatchObject({ status: CourseStatus.ACTIVE });
    });

    it('discontinues with a replacement given in the same call, writing the relation first (US-014 AC1)', async () => {
      course.findUnique.mockImplementation(({ where }) =>
        Promise.resolve(
          where.id === 'course'
            ? row()
            : { ...row({ id: 'other' }), status: CourseStatus.ACTIVE },
        ),
      );
      usage.hasActiveReplacement.mockResolvedValue(true);
      await expect(
        service.transition('course', 'discontinue', R1, {
          replacementCourseId: 'other',
        }),
      ).resolves.toMatchObject({ status: CourseStatus.DISCONTINUED });
      expect(courseRelation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: {
            sourceCourseId: 'course',
            targetCourseId: 'other',
            relationType: 'REPLACEMENT',
          },
          update: {},
        }),
      );
      expect(usage.hasActiveReplacement).toHaveBeenCalledWith(
        'course',
        expect.anything(),
      );
    });

    it('refuses a replacement that is the course itself, missing or not Active', async () => {
      await expect(
        service.transition('course', 'discontinue', R1, {
          replacementCourseId: 'course',
        }),
      ).rejects.toMatchObject({ code: 'REPLACEMENT_INVALID' });
      course.findUnique.mockImplementation(({ where }) =>
        Promise.resolve(
          where.id === 'course' ? row() : { status: CourseStatus.DISCONTINUED },
        ),
      );
      await expect(
        service.transition('course', 'discontinue', R1, {
          replacementCourseId: 'other',
        }),
      ).rejects.toMatchObject({ code: 'REPLACEMENT_INVALID' });
      course.findUnique.mockImplementation(({ where }) =>
        Promise.resolve(where.id === 'course' ? row() : null),
      );
      await expect(
        service.transition('course', 'discontinue', R1, {
          replacementCourseId: 'missing',
        }),
      ).rejects.toMatchObject({ code: 'REPLACEMENT_INVALID' });
      expect(course.update).not.toHaveBeenCalled();
    });

    it('refuses reopening an active course', async () => {
      await expect(
        service.transition('course', 'reopen', R1),
      ).rejects.toMatchObject({ code: 'STATUS_TRANSITION_INVALID' });
    });

    it('refuses cancelling a course with study results or in a released version', async () => {
      usage.hasStudyResults.mockResolvedValue(true);
      await expect(
        service.transition('course', 'cancel', R1),
      ).rejects.toMatchObject({ code: 'COURSE_IN_USE' });
      usage.hasStudyResults.mockResolvedValue(false);
      usage.inReleasedVersion.mockResolvedValue(true);
      await expect(
        service.transition('course', 'cancel', R1),
      ).rejects.toMatchObject({ code: 'COURSE_IN_USE' });
    });

    it('cancels a never-used course and treats Cancelled as final', async () => {
      await expect(
        service.transition('course', 'cancel', R1),
      ).resolves.toMatchObject({ status: CourseStatus.CANCELLED });
      course.findUnique.mockResolvedValue(
        row({ status: CourseStatus.CANCELLED }),
      );
      await expect(
        service.transition('course', 'cancel', R1),
      ).rejects.toMatchObject({ code: 'COURSE_CANCELLED' });
    });

    it('keeps status changes to callers whose raw mode is DIRECT', async () => {
      await expect(
        service.transition('course', 'cancel', R4),
      ).rejects.toMatchObject({ code: 'CHANGE_REQUEST_REQUIRED' });
      expect(course.update).not.toHaveBeenCalled();
    });
  });
});

function stripUndefined(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  );
}
