import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CourseRelationType,
  CourseStatus,
  Prisma,
  ScopeSource,
  ScopeType,
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
import {
  type OwnerCourseRow,
  type RelationRow,
} from './course-relation.dto.js';
import { CourseRelationsService } from './course-relations.service.js';
import { CreateCourseRelationDto } from './create-course-relation.dto.js';

const NOW = new Date('2026-10-19T00:00:00.000Z');

function course(
  id: string,
  patch: Partial<OwnerCourseRow> = {},
): OwnerCourseRow {
  return {
    id,
    courseCode: id.toUpperCase(),
    courseName: `Học phần ${id}`,
    credits: new Prisma.Decimal('3.00'),
    status: CourseStatus.ACTIVE,
    ownerFacultyId: 'home',
    ownerGroupId: 'g1',
    ownerFaculty: { unitCode: HOME_FACULTY_CODE },
    ...patch,
  };
}

function relation(
  patch: Partial<RelationRow> & {
    source?: OwnerCourseRow;
    target?: OwnerCourseRow;
  } = {},
): RelationRow {
  const { source, target, ...rest } = patch;
  const sourceCourse = source ?? course('a');
  const targetCourse = target ?? course('b');
  return {
    id: 'rel',
    sourceCourseId: sourceCourse.id,
    targetCourseId: targetCourse.id,
    sourceCourse,
    targetCourse,
    relationType: CourseRelationType.PREREQUISITE,
    minScore: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...rest,
  };
}

function access(
  cells: { code: string; mode: PermissionMode; all?: boolean }[],
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
        cell.code as typeof PERMISSIONS.COURSE_VIEW,
        {
          mode: cell.mode,
          scope: cell.all ? ('ALL' as const) : ('SCOPED' as const),
        },
      ]),
    ),
  };
  return new AccessContext('user', [assignment]);
}

const VIEW = { code: PERMISSIONS.COURSE_VIEW, mode: 'DIRECT', all: true };
const R1 = access([
  VIEW,
  { code: PERMISSIONS.COURSE_EDIT, mode: 'DIRECT', all: true },
  { code: PERMISSIONS.COURSE_RELATION_EDIT, mode: 'DIRECT', all: true },
] as never);
const R3 = access([
  VIEW,
  { code: PERMISSIONS.COURSE_RELATION_EDIT, mode: 'VIA_REQUEST', all: true },
] as never);
const R5 = access(
  [
    VIEW,
    { code: PERMISSIONS.COURSE_RELATION_EDIT, mode: 'VIA_REQUEST' },
  ] as never,
  { subjectGroupIds: ['g1'] },
);
const R6 = access([VIEW] as never);

const P2002 = new Prisma.PrismaClientKnownRequestError('dup', {
  code: 'P2002',
  clientVersion: 'test',
});

function dto(patch: Partial<CreateCourseRelationDto> = {}) {
  return {
    sourceCourseId: 'a',
    targetCourseId: 'b',
    relationType: CourseRelationType.PREREQUISITE,
    ...patch,
  } as CreateCourseRelationDto;
}

describe('CourseRelationsService', () => {
  let courses: Map<string, OwnerCourseRow>;
  let courseModel: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  let relationModel: Record<
    'findMany' | 'findUnique' | 'create' | 'update' | 'delete' | 'count',
    ReturnType<typeof vi.fn>
  >;
  let executeRaw: ReturnType<typeof vi.fn>;
  let usage: Record<keyof CourseUsageReader, ReturnType<typeof vi.fn>>;
  let service: CourseRelationsService;
  let order: string[];

  beforeEach(() => {
    order = [];
    courses = new Map(
      ['a', 'b', 'c'].map((id) => [id, course(id)] as [string, OwnerCourseRow]),
    );
    courseModel = {
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(courses.get(where.id) ?? null),
      ),
      findMany: vi.fn(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(
          where.id.in.map((id) => courses.get(id)).filter(Boolean),
        ),
      ),
    };
    relationModel = {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(relation()),
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        order.push('create');
        return Promise.resolve(
          relation({
            ...data,
            source: courses.get(data.sourceCourseId as string),
            target: courses.get(data.targetCourseId as string),
            minScore: (data.minScore as Prisma.Decimal | null) ?? null,
          } as never),
        );
      }),
      update: vi.fn(({ data }: { data: { minScore: Prisma.Decimal | null } }) =>
        Promise.resolve(relation({ minScore: data.minScore })),
      ),
      delete: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    };
    executeRaw = vi.fn(() => {
      order.push('lock');
      return Promise.resolve([]);
    });
    usage = {
      releasedCourseIds: vi.fn().mockResolvedValue(new Set()),
      inReleasedVersion: vi.fn().mockResolvedValue(false),
      hasStudyResults: vi.fn().mockResolvedValue(false),
      programsUsing: vi.fn().mockResolvedValue([]),
      hasActiveReplacement: vi.fn().mockResolvedValue(false),
    };
    const client: Record<string, unknown> = {
      course: courseModel,
      courseRelation: relationModel,
      $executeRaw: executeRaw,
    };
    client.$transaction = (work: (tx: unknown) => Promise<unknown>) =>
      work(client);
    service = new CourseRelationsService(
      client as unknown as PrismaService,
      usage as unknown as CourseUsageReader,
    );
  });

  describe('create', () => {
    it('refuses a relation of a course with itself', async () => {
      await expect(
        service.create(dto({ targetCourseId: 'a' }), R1),
      ).rejects.toMatchObject({ code: 'RELATION_SELF' });
    });

    it('refuses a score on anything but a prerequisite', async () => {
      await expect(
        service.create(
          dto({ relationType: CourseRelationType.PRIOR, minScore: '2' }),
          R1,
        ),
      ).rejects.toMatchObject({
        code: 'MIN_SCORE_NOT_ALLOWED',
        details: [{ field: 'minScore', constraints: ['gradePoint'] }],
      });
    });

    it('refuses an unknown course', async () => {
      await expect(
        service.create(dto({ targetCourseId: 'ghost' }), R1),
      ).rejects.toMatchObject({ code: 'RELATION_COURSE_NOT_FOUND' });
    });

    it('refuses a Cancelled course on either end', async () => {
      courses.set('b', course('b', { status: CourseStatus.CANCELLED }));
      await expect(service.create(dto(), R1)).rejects.toMatchObject({
        code: 'RELATION_COURSE_CANCELLED',
      });
      await expect(
        service.create(dto({ sourceCourseId: 'b', targetCourseId: 'a' }), R1),
      ).rejects.toMatchObject({ code: 'RELATION_COURSE_CANCELLED' });
    });

    it('lets R5 of the owning group create a prerequisite, taking the lock before the insert', async () => {
      const created = await service.create(dto({ minScore: '2.5' }), R5);
      expect(order).toEqual(['lock', 'create']);
      expect(created).toMatchObject({
        relationType: 'PREREQUISITE',
        minScore: '2.5',
        editPath: 'DIRECT',
      });
    });

    it('refuses R5 outside the owning course scope', async () => {
      courses.set('b', course('b', { ownerGroupId: 'g2' }));
      await expect(service.create(dto(), R5)).rejects.toMatchObject({
        code: 'OUT_OF_SCOPE',
      });
      expect(relationModel.create).not.toHaveBeenCalled();
    });

    it('checks a replacement against the discontinued SOURCE course', async () => {
      courses.set(
        'a',
        course('a', {
          ownerFacultyId: 'math',
          ownerGroupId: null,
          ownerFaculty: { unitCode: 'KHOA_TOAN' },
        }),
      );
      await expect(
        service.create(
          dto({ relationType: CourseRelationType.REPLACEMENT }),
          R3,
        ),
      ).rejects.toMatchObject({ code: 'CHANGE_REQUEST_REQUIRED' });
    });

    it('checks a prerequisite against the TARGET: a foreign source is fine for R1', async () => {
      courses.set(
        'a',
        course('a', {
          ownerFacultyId: 'math',
          ownerGroupId: null,
          ownerFaculty: { unitCode: 'KHOA_TOAN' },
        }),
      );
      await expect(service.create(dto(), R1)).resolves.toMatchObject({
        relationType: 'PREREQUISITE',
      });
    });

    it('asks R3 for a change request once the owning course is released', async () => {
      usage.inReleasedVersion.mockResolvedValue(true);
      await expect(service.create(dto(), R3)).rejects.toMatchObject({
        code: 'CHANGE_REQUEST_REQUIRED',
      });
    });

    it('refuses a prerequisite that closes a loop and names its path with course codes (US-016 AC1)', async () => {
      relationModel.findMany.mockResolvedValue([
        { sourceCourseId: 'a', targetCourseId: 'b' },
        { sourceCourseId: 'b', targetCourseId: 'c' },
      ]);
      // New edge c -> a: c is studied before a, but a already leads to c.
      await expect(
        service.create(dto({ sourceCourseId: 'c', targetCourseId: 'a' }), R1),
      ).rejects.toSatisfy((error: { code: string; message: string }) => {
        return (
          error.code === 'REQUISITE_CYCLE' &&
          error.message.endsWith(': A → B → C → A.')
        );
      });
      expect(relationModel.create).not.toHaveBeenCalled();
    });

    it('only loads prior and prerequisite edges for the check', async () => {
      await service.create(dto(), R1);
      expect(relationModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { relationType: { in: ['PRIOR', 'PREREQUISITE'] } },
        }),
      );
    });

    it('does not run the cycle check for a corequisite, in either direction', async () => {
      relationModel.findMany.mockResolvedValue([
        { sourceCourseId: 'a', targetCourseId: 'b' },
      ]);
      await expect(
        service.create(
          dto({
            sourceCourseId: 'b',
            targetCourseId: 'a',
            relationType: CourseRelationType.COREQUISITE,
          }),
          R1,
        ),
      ).resolves.toMatchObject({ relationType: 'COREQUISITE' });
      expect(relationModel.findMany).not.toHaveBeenCalled();
    });

    it('maps a duplicate to RELATION_EXISTS', async () => {
      relationModel.create.mockRejectedValue(P2002);
      await expect(service.create(dto(), R1)).rejects.toMatchObject({
        code: 'RELATION_EXISTS',
      });
    });
  });

  describe('updateMinScore', () => {
    it('refuses a score on a corequisite but lets it be cleared', async () => {
      relationModel.findUnique.mockResolvedValue(
        relation({ relationType: CourseRelationType.COREQUISITE }),
      );
      await expect(
        service.updateMinScore('rel', { minScore: '2' }, R1),
      ).rejects.toMatchObject({ code: 'MIN_SCORE_NOT_ALLOWED' });
      await expect(
        service.updateMinScore('rel', { minScore: null }, R1),
      ).resolves.toMatchObject({ minScore: null });
    });

    it('sets the threshold of a prerequisite', async () => {
      await expect(
        service.updateMinScore('rel', { minScore: '2.5' }, R1),
      ).resolves.toMatchObject({ minScore: '2.5' });
    });

    it('refuses an unknown relation and a caller who cannot edit it', async () => {
      relationModel.findUnique.mockResolvedValue(null);
      await expect(
        service.updateMinScore('x', { minScore: null }, R1),
      ).rejects.toMatchObject({ code: 'RELATION_NOT_FOUND' });
      relationModel.findUnique.mockResolvedValue(relation());
      await expect(
        service.updateMinScore('rel', { minScore: null }, R6),
      ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    });
  });

  describe('remove', () => {
    const replacement = (sourceStatus: CourseStatus) =>
      relation({
        relationType: CourseRelationType.REPLACEMENT,
        source: course('a', { status: sourceStatus }),
      });

    it('keeps the last active replacement of a Discontinued course', async () => {
      relationModel.findUnique.mockResolvedValue(
        replacement(CourseStatus.DISCONTINUED),
      );
      await expect(service.remove('rel', R1)).rejects.toMatchObject({
        code: 'REPLACEMENT_STILL_NEEDED',
      });
      expect(relationModel.delete).not.toHaveBeenCalled();
    });

    it('removes a replacement when another active one remains', async () => {
      relationModel.findUnique.mockResolvedValue(
        replacement(CourseStatus.DISCONTINUED),
      );
      relationModel.count.mockResolvedValue(1);
      await service.remove('rel', R1);
      expect(relationModel.delete).toHaveBeenCalledWith({
        where: { id: 'rel' },
      });
    });

    it('removes the replacement of an Active course without counting', async () => {
      relationModel.findUnique.mockResolvedValue(
        replacement(CourseStatus.ACTIVE),
      );
      await service.remove('rel', R1);
      expect(relationModel.count).not.toHaveBeenCalled();
      expect(relationModel.delete).toHaveBeenCalled();
    });
  });

  describe('listForCourse', () => {
    it('hides a Cancelled course from callers without course.edit', async () => {
      courseModel.findUnique.mockResolvedValue({
        status: CourseStatus.CANCELLED,
      });
      await expect(service.listForCourse('a', R6)).rejects.toMatchObject({
        code: 'COURSE_NOT_FOUND',
      });
      await expect(service.listForCourse('a', R1)).resolves.toEqual([]);
    });

    it('refuses an unknown course and reports each relation edit path for the caller', async () => {
      courseModel.findUnique.mockResolvedValueOnce(null);
      await expect(service.listForCourse('x', R1)).rejects.toMatchObject({
        code: 'COURSE_NOT_FOUND',
      });
      courseModel.findUnique.mockResolvedValue({ status: CourseStatus.ACTIVE });
      relationModel.findMany.mockResolvedValue([
        relation({ minScore: new Prisma.Decimal('2.50') }),
      ]);
      const [first] = await service.listForCourse('a', R6);
      expect(first).toMatchObject({ minScore: '2.5', editPath: null });
      expect(first.targetCourse.credits).toBe('3');
      const [forAdmin] = await service.listForCourse('a', R1);
      expect(forAdmin.editPath).toBe('DIRECT');
    });
  });
});
