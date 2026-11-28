import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  MajorStatus,
  OrgUnitStatus,
  OrgUnitType,
  Prisma,
  ProgramStatus,
  ProgramVersionStatus,
} from '../../generated/prisma/client.js';
import {
  AccessContext,
  type ActiveAssignment,
} from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import { MajorsService } from './majors.service.js';

const NOW = new Date('2026-11-28T00:00:00Z');
const R1 = new AccessContext('admin', [
  {
    assignmentId: 'a1',
    roleId: 'r1',
    roleCode: 'R1',
    scopeType: 'SYSTEM',
    scopeUnitId: null,
    scope: { orgUnitIds: [], programIds: [], subjectGroupIds: [] },
    permissions: new Map([
      [PERMISSIONS.PROGRAM_EDIT_INFO, { mode: 'DIRECT', scope: 'ALL' }],
      [PERMISSIONS.PROGRAM_VIEW, { mode: 'DIRECT', scope: 'ALL' }],
    ]),
  } as unknown as ActiveAssignment,
]);

const majorRow = (patch: Record<string, unknown> = {}) => ({
  id: 'm1',
  majorCode: '7480201',
  majorName: 'Công nghệ Thông tin',
  englishName: 'Information Technology',
  degreeGroup: 'CD01',
  facultyId: 'f1',
  faculty: {
    id: 'f1',
    unitCode: 'KHOA_CNTT',
    unitName: 'Khoa Công nghệ Thông tin',
  },
  status: MajorStatus.ACTIVE,
  _count: { programs: 4 },
  createdAt: NOW,
  updatedAt: NOW,
  ...patch,
});

describe('MajorsService', () => {
  let major: Record<string, ReturnType<typeof vi.fn>>;
  let orgUnit: Record<string, ReturnType<typeof vi.fn>>;
  let program: Record<string, ReturnType<typeof vi.fn>>;
  let programEnrollment: Record<string, ReturnType<typeof vi.fn>>;
  let cohortVersion: Record<string, ReturnType<typeof vi.fn>>;
  let subjectGroup: Record<string, ReturnType<typeof vi.fn>>;
  let curriculumItem: Record<string, ReturnType<typeof vi.fn>>;
  let syllabus: Record<string, ReturnType<typeof vi.fn>>;
  let service: MajorsService;

  beforeEach(() => {
    major = {
      findMany: vi.fn().mockResolvedValue([majorRow()]),
      count: vi.fn().mockResolvedValue(1),
      findUnique: vi.fn().mockResolvedValue(majorRow()),
      create: vi.fn().mockResolvedValue(majorRow()),
      update: vi.fn().mockResolvedValue(majorRow()),
    };
    orgUnit = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'f1',
        unitType: OrgUnitType.FACULTY,
        status: OrgUnitStatus.ACTIVE,
      }),
    };
    program = {
      groupBy: vi
        .fn()
        .mockResolvedValue([{ majorId: 'm1', _count: { _all: 2 } }]),
      findMany: vi.fn().mockResolvedValue([]),
    };
    programEnrollment = {
      findMany: vi.fn().mockResolvedValue([
        { studentId: 's1', program: { majorId: 'm1' } },
        { studentId: 's2', program: { majorId: 'm1' } },
      ]),
    };
    cohortVersion = { findMany: vi.fn().mockResolvedValue([]) };
    subjectGroup = { findMany: vi.fn().mockResolvedValue([]) };
    curriculumItem = { findMany: vi.fn().mockResolvedValue([]) };
    syllabus = { findMany: vi.fn().mockResolvedValue([]) };
    const prisma = {
      major,
      orgUnit,
      program,
      programEnrollment,
      cohortVersion,
      subjectGroup,
      curriculumItem,
      syllabus,
      $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
    };
    service = new MajorsService(prisma as unknown as PrismaService);
  });

  it('lists majors with pagination and filters', async () => {
    const page = await service.list({ page: 1, pageSize: 20, q: '748' });
    expect(page.total).toBe(1);
    expect(page.items[0]?.majorCode).toBe('7480201');
    expect(page.items[0]?.programCount).toBe(4);
    expect(page.items[0]?.activeProgramCount).toBe(2);
    expect(page.items[0]?.studentCount).toBe(2);
    expect(program.groupBy).toHaveBeenCalledTimes(1);
  });

  it('filters by hasPrograms', async () => {
    await service.list({ page: 1, pageSize: 20, hasPrograms: true });
    expect(major.findMany.mock.calls[0]?.[0].where.programs).toEqual({
      some: {},
    });
    await service.list({ page: 1, pageSize: 20, hasPrograms: false });
    expect(major.findMany.mock.calls[1]?.[0].where.programs).toEqual({
      none: {},
    });
    await service.list({ page: 1, pageSize: 20 });
    expect(major.findMany.mock.calls[2]?.[0].where.programs).toBeUndefined();
  });

  it('detail includes stats and 404s unknown major', async () => {
    const d = await service.detail('m1');
    expect(d.activeProgramCount).toBe(2);
    expect(d.studentCount).toBe(2);
    major.findUnique.mockResolvedValueOnce(null);
    await expect(service.detail('x')).rejects.toMatchObject({
      code: 'MAJOR_NOT_FOUND',
    });
  });

  it('overview 404s unknown major', async () => {
    major.findUnique.mockResolvedValueOnce(null);
    await expect(service.overview('x')).rejects.toMatchObject({
      code: 'MAJOR_NOT_FOUND',
    });
  });

  describe('overview', () => {
    const faculty = { id: 'f1', unitCode: 'K', unitName: 'Khoa' };
    const ver = (
      id: string,
      status: ProgramVersionStatus,
      day: number,
      extra: Record<string, unknown> = {},
    ) => ({
      id,
      versionNumber: id,
      status,
      programName: 'Name ' + id,
      totalCredits: 150,
      publishedAt: null,
      createdAt: new Date(2026, 0, day),
      _count: { tracks: 1, plos: 5 },
      ...extra,
    });
    const prog = (
      id: string,
      code: string,
      status: ProgramStatus,
      versions: unknown[],
    ) => ({
      id,
      programCode: code,
      degreeLevel: 'BACHELOR',
      status,
      faculty,
      versions,
      directors: [{ director: { id: 'u1', userCode: 'GV1', fullName: 'Dir' } }],
    });
    const course = (id: string, code: string) => ({
      id,
      courseCode: code,
      courseName: code,
      credits: 3,
      courseType: 'THEORY',
      ownerGroup: null,
    });

    beforeEach(() => {
      program.findMany.mockResolvedValue([
        prog('p1', 'P1', ProgramStatus.ACTIVE, [
          ver('v1d', ProgramVersionStatus.DRAFT, 5),
          ver('v1a', ProgramVersionStatus.ACTIVE, 1),
          ver('v1h', ProgramVersionStatus.HISTORICAL, 9),
        ]),
        prog('p2', 'P2', ProgramStatus.ACTIVE, [
          ver('v2d', ProgramVersionStatus.DRAFT, 2),
        ]),
        prog('p3', 'P3', ProgramStatus.INACTIVE, []),
      ]);
      programEnrollment.findMany.mockResolvedValue([
        {
          studentId: 's1',
          programId: 'p1',
          cohortId: 'c1',
          cohort: { cohortCode: '2021' },
        },
        {
          studentId: 's2',
          programId: 'p1',
          cohortId: 'c2',
          cohort: { cohortCode: '2022' },
        },
        {
          studentId: 's1',
          programId: 'p2',
          cohortId: 'c1',
          cohort: { cohortCode: '2021' },
        },
      ]);
      cohortVersion.findMany.mockResolvedValue([
        { cohort: { cohortCode: '2020' }, programVersion: { programId: 'p1' } },
      ]);
      subjectGroup.findMany.mockResolvedValue([
        {
          id: 'g1',
          groupCode: 'G1',
          groupName: 'G',
          status: 'ACTIVE',
          members: [{ id: 'm' }, { id: 'n' }],
          _count: { ownedCourses: 3 },
        },
      ]);
      curriculumItem.findMany.mockResolvedValue([
        { versionId: 'v1a', course: course('c1', 'B') },
        { versionId: 'v1a', course: course('c1', 'B') },
        { versionId: 'v1a', course: course('c2', 'A') },
        { versionId: 'v2d', course: course('c2', 'A') },
        { versionId: 'v2d', course: course('c3', 'C') },
      ]);
      syllabus.findMany.mockResolvedValue([{ courseId: 'c1' }]);
    });

    it('picks representative versions and computes stats', async () => {
      const o = await service.overview('m1');
      expect(o.programs.map((p) => p.latestVersionId)).toEqual([
        'v1a',
        'v2d',
        null,
      ]);
      expect(o.programs[0]).toMatchObject({
        programName: 'Name v1a',
        hasReleasedVersion: true,
        releasedVersionCount: 2,
        courseCount: 2,
        studentCount: 2,
        ploCount: 5,
        trackCount: 1,
        totalCredits: 150,
        cohorts: ['2020', '2021', '2022'],
      });
      expect(o.programs[1]).toMatchObject({
        hasReleasedVersion: false,
        courseCount: 2,
        studentCount: 1,
      });
      expect(o.programs[2]).toMatchObject({
        programName: 'P3',
        latestVersionStatus: null,
        totalCredits: null,
        courseCount: 0,
      });
      expect(o.programs[0]?.directors).toEqual([
        { id: 'u1', userCode: 'GV1', fullName: 'Dir' },
      ]);
      expect(o.stats).toEqual({
        totalPrograms: 3,
        activePrograms: 1,
        draftPrograms: 1,
        inactivePrograms: 1,
        releasedVersions: 2,
        totalStudents: 2,
        totalCourses: 3,
        publishedSyllabi: 1,
        totalPlos: 10,
        subjectGroupCount: 1,
      });
      expect(o.major.studentCount).toBe(2);
      expect(o.major.activeProgramCount).toBe(2);
    });

    it('sorts courses and cohort breakdown', async () => {
      const o = await service.overview('m1');
      expect(
        o.courses.map((c) => [
          c.courseCode,
          c.programCount,
          c.hasPublishedSyllabus,
        ]),
      ).toEqual([
        ['A', 2, false],
        ['B', 1, true],
        ['C', 1, false],
      ]);
      expect(
        o.cohortBreakdown.map((b) => [
          b.cohortCode,
          b.programCode,
          b.studentCount,
        ]),
      ).toEqual([
        ['2022', 'P1', 1],
        ['2021', 'P1', 1],
        ['2021', 'P2', 1],
      ]);
      expect(o.subjectGroups[0]).toMatchObject({
        memberCount: 2,
        courseCount: 3,
      });
    });

    it('skips subject groups when major has no faculty', async () => {
      major.findUnique.mockResolvedValueOnce(
        majorRow({ facultyId: null, faculty: null }),
      );
      const o = await service.overview('m1');
      expect(subjectGroup.findMany).not.toHaveBeenCalled();
      expect(o.stats.subjectGroupCount).toBe(0);
    });
  });

  it('creates a major and maps duplicate code to 409', async () => {
    const created = await service.create(
      {
        majorCode: '7480201',
        majorName: 'Công nghệ Thông tin',
        facultyId: 'f1',
      },
      R1,
    );
    expect(created.majorCode).toBe('7480201');

    major.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.create({ majorCode: '7480201', majorName: 'Dup' }, R1),
    ).rejects.toMatchObject({ code: 'MAJOR_CODE_TAKEN' });
  });

  it('rejects unchanged status transition', async () => {
    await expect(
      service.setStatus('m1', MajorStatus.ACTIVE, R1),
    ).rejects.toMatchObject({ code: 'MAJOR_STATUS_UNCHANGED' });
  });
});
