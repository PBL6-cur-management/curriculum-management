import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChangeRequestType,
  type Prisma,
} from '../../generated/prisma/client.js';
import {
  SNAPSHOT_ENTITY,
  type ChangeItemDraft,
} from '../../shared/change-requests/diff/snapshot-entry.js';
import { HOME_FACULTY_CODE } from '../../shared/org-units/home-faculty.js';
import { RoutingPlanner, type RoutingSubject } from './routing-planner.js';

const TODAY = new Date('2026-10-19T00:00:00.000Z');
const COURSE_A = { id: 'cA', ownerGroupId: 'gA' };
const COURSE_B = { id: 'cB', ownerGroupId: 'gB' };

const program = (id: string) => ({
  id,
  programCode: id.toUpperCase(),
  versions: [{ programName: `Chương trình ${id}` }],
});
const coordinator = (groupId: string, id: string) => ({
  subjectGroupId: groupId,
  lecturerId: id,
  lecturer: { fullName: `Điều phối ${id}` },
});
const director = (programId: string, id: string) => ({
  programId,
  directorId: id,
  director: { fullName: `GĐ ${id}` },
});

interface World {
  holders?: string[];
  courses?: { id: string; ownerGroupId: string | null }[];
  groups?: string[];
  members?: ReturnType<typeof coordinator>[];
  programs?: ReturnType<typeof program>[];
  directors?: ReturnType<typeof director>[];
  selfApprovers?: string[];
}

function world(state: World) {
  const holders = state.holders ?? ['office1', 'office2'];
  return {
    roleAssignment: {
      findFirst: vi.fn(
        ({ where }: { where: { userId: string | { not: string } } }) => {
          const wanted = where.userId;
          const found =
            typeof wanted === 'string'
              ? holders.includes(wanted)
              : holders.some((holder) => holder !== wanted.not);
          return Promise.resolve(found ? { id: 'ra' } : null);
        },
      ),
    },
    course: { findMany: vi.fn().mockResolvedValue(state.courses ?? []) },
    subjectGroup: {
      findMany: vi.fn().mockResolvedValue(
        (state.groups ?? []).map((id) => ({
          id,
          groupCode: id.toUpperCase(),
        })),
      ),
    },
    subjectGroupMember: {
      findMany: vi.fn().mockResolvedValue(state.members ?? []),
    },
    program: {
      findMany: vi.fn().mockResolvedValue(state.programs ?? []),
      findUnique: vi.fn().mockResolvedValue((state.programs ?? [])[0] ?? null),
    },
    programDirectorAssignment: {
      findMany: vi.fn().mockResolvedValue(state.directors ?? []),
    },
    user: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          (state.selfApprovers ?? []).includes(where.id)
            ? { canSelfApprove: true }
            : null,
        ),
      ),
    },
  } as unknown as Prisma.TransactionClient;
}

const courseRequest = (
  patch: Partial<RoutingSubject> = {},
): RoutingSubject => ({
  requestType: ChangeRequestType.SYLLABUS_CONTENT,
  createdById: 'author',
  courseId: 'cA',
  programId: null,
  course: { id: 'cA', ownerGroupId: 'gA', ownerFacultyCode: HOME_FACULTY_CODE },
  ...patch,
});

const programRequest = (
  patch: Partial<RoutingSubject> = {},
): RoutingSubject => ({
  requestType: ChangeRequestType.CURRICULUM,
  createdById: 'author',
  courseId: null,
  programId: 'p1',
  course: null,
  ...patch,
});

const curriculumItem = (code: string): ChangeItemDraft => ({
  sortOrder: 0,
  entityType: SNAPSHOT_ENTITY.CURRICULUM_ITEM,
  itemKey: code,
  label: code,
  recordId: null,
  oldValue: null,
  newValue: { plannedSemester: '1' },
  baseVersion: 'v1',
});

describe('RoutingPlanner', () => {
  let planner: RoutingPlanner;
  beforeEach(() => {
    planner = new RoutingPlanner();
  });

  const level = (
    plan: Awaited<ReturnType<RoutingPlanner['plan']>>,
    n: number,
  ) => plan.steps.filter((step) => step.approvalLevel === n);

  it('routes a course to the coordinator of its own group only (KB-040)', async () => {
    const db = world({
      courses: [COURSE_A],
      groups: ['gA'],
      members: [coordinator('gA', 'coordA')],
      programs: [program('p1')],
      directors: [director('p1', 'dir1')],
    });
    const plan = await planner.plan(db, courseRequest(), [], TODAY);
    expect(level(plan, 1)).toEqual([
      expect.objectContaining({
        approverId: 'coordA',
        forSubjectGroupId: 'gA',
        isSkipped: false,
      }),
    ]);
    expect(level(plan, 2)).toEqual([
      expect.objectContaining({ approverId: 'dir1', forProgramId: 'p1' }),
    ]);
    expect(level(plan, 3)).toEqual([
      expect.objectContaining({ approverId: null, isSkipped: false }),
    ]);
    expect(plan.affectedPrograms).toEqual([
      { id: 'p1', programCode: 'P1', programName: 'Chương trình p1' },
    ]);
  });

  it('needs every coordinator of every group of a program copy (KB-041, EC-22)', async () => {
    const db = world({
      courses: [COURSE_A, COURSE_B],
      groups: ['gA', 'gB'],
      members: [
        coordinator('gA', 'c1'),
        coordinator('gB', 'c2'),
        coordinator('gB', 'c3'),
      ],
      programs: [program('p1')],
      directors: [director('p1', 'dir1')],
    });
    const plan = await planner.plan(
      db,
      programRequest({ createdById: 'dir1' }),
      [curriculumItem('IT1'), curriculumItem('IT2')],
      TODAY,
    );
    expect(level(plan, 1).map((step) => step.approverId)).toEqual([
      'c1',
      'c2',
      'c3',
    ]);
    expect(level(plan, 2)).toEqual([
      expect.objectContaining({
        approverId: 'dir1',
        isSkipped: true,
        skipReason: 'Người duyệt là người tạo đề xuất',
      }),
    ]);
  });

  it('needs the director of every program that lists the course (KB-042)', async () => {
    const db = world({
      courses: [COURSE_A],
      groups: ['gA'],
      members: [coordinator('gA', 'coordA')],
      programs: [program('p1'), program('p2'), program('p3')],
      directors: [
        director('p1', 'd1'),
        director('p2', 'd2'),
        director('p3', 'd3'),
      ],
    });
    const plan = await planner.plan(db, courseRequest(), [], TODAY);
    expect(level(plan, 2).map((step) => step.forProgramId)).toEqual([
      'p1',
      'p2',
      'p3',
    ]);
    expect(plan.affectedPrograms).toHaveLength(3);
  });

  it('skips levels 1 and 2 for a course of another faculty (KB-043)', async () => {
    const db = world({});
    const plan = await planner.plan(
      db,
      courseRequest({
        course: { id: 'cF', ownerGroupId: null, ownerFacultyCode: 'KHOA_KHAC' },
      }),
      [],
      TODAY,
    );
    expect(plan.steps).toHaveLength(3);
    expect(
      plan.steps
        .slice(0, 2)
        .every(
          (step) =>
            step.isSkipped && step.skipReason?.startsWith('Không áp dụng'),
        ),
    ).toBe(true);
    expect(plan.steps[2].isSkipped).toBe(false);
    expect(plan.affectedPrograms).toEqual([]);
  });

  it('records why a level has nobody instead of dropping it', async () => {
    const noGroup = await planner.plan(
      world({ programs: [] }),
      courseRequest({
        course: {
          id: 'cA',
          ownerGroupId: null,
          ownerFacultyCode: HOME_FACULTY_CODE,
        },
      }),
      [],
      TODAY,
    );
    expect(level(noGroup, 1)[0].skipReason).toBe(
      'Học phần chưa thuộc nhóm chuyên môn nào',
    );
    expect(level(noGroup, 2)[0].skipReason).toBe(
      'Học phần chưa thuộc chương trình đào tạo nào',
    );
    const noCoordinator = await planner.plan(
      world({ courses: [COURSE_A], groups: ['gA'], programs: [program('p1')] }),
      courseRequest(),
      [],
      TODAY,
    );
    expect(level(noCoordinator, 1)[0]).toMatchObject({
      forSubjectGroupId: 'gA',
      skipReason: 'Nhóm chuyên môn chưa có Điều phối',
    });
    expect(level(noCoordinator, 2)[0]).toMatchObject({
      forProgramId: 'p1',
      skipReason: 'Chương trình chưa có Giám đốc CTĐT',
    });
    const noCourse = await planner.plan(
      world({ programs: [program('p1')] }),
      programRequest(),
      [],
      TODAY,
    );
    expect(level(noCourse, 1)[0].skipReason).toBe(
      'Đề xuất không thay đổi học phần nào',
    );
    // A curriculum change that only moves another faculty's course (e.g. mathematics) is not "no course".
    const foreignOnly = await planner.plan(
      world({ courses: [], programs: [program('p1')] }),
      programRequest(),
      [curriculumItem('3190141')],
      TODAY,
    );
    expect(level(foreignOnly, 1)[0].skipReason).toBe(
      'Không áp dụng — học phần của khoa khác',
    );
  });

  it('skips the row of the creator, wherever it is', async () => {
    const db = world({
      courses: [COURSE_A],
      groups: ['gA'],
      members: [coordinator('gA', 'author')],
      programs: [program('p1')],
      directors: [director('p1', 'dir1')],
    });
    const plan = await planner.plan(db, courseRequest(), [], TODAY);
    expect(level(plan, 1)[0]).toMatchObject({
      approverId: 'author',
      isSkipped: true,
      skipReason: 'Người duyệt là người tạo đề xuất',
    });
    expect(level(plan, 2)[0].isSkipped).toBe(false);
  });

  it('keeps the row of a demo creator (canSelfApprove) so the demo can walk every level', async () => {
    const db = world({
      courses: [COURSE_A],
      groups: ['gA'],
      members: [coordinator('gA', 'author')],
      programs: [program('p1')],
      directors: [director('p1', 'dir1')],
      selfApprovers: ['author'],
    });
    const plan = await planner.plan(db, courseRequest(), [], TODAY);
    expect(level(plan, 1)[0]).toMatchObject({
      approverId: 'author',
      isSkipped: false,
    });
  });

  it('lets a demo academic-office creator submit when nobody else holds the role', async () => {
    const plan = await planner.plan(
      world({ holders: ['author'], selfApprovers: ['author'] }),
      programRequest({ requestType: ChangeRequestType.ORGANIZATION }),
      [],
      TODAY,
    );
    expect(level(plan, 3)).toHaveLength(1);
  });

  it('sends an organisational request to the academic office alone', async () => {
    const db = world({});
    const plan = await planner.plan(
      db,
      programRequest({ requestType: ChangeRequestType.ORGANIZATION }),
      [],
      TODAY,
    );
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].approvalLevel).toBe(3);
  });

  it('refuses an academic-office creator when nobody else holds the role (F13-01)', async () => {
    await expect(
      planner.plan(world({ holders: ['author'] }), courseRequest(), [], TODAY),
    ).rejects.toMatchObject({ code: 'NO_OTHER_ACADEMIC_OFFICE' });
    await expect(
      planner.plan(
        world({ holders: ['author', 'other'] }),
        programRequest({ requestType: ChangeRequestType.ORGANIZATION }),
        [],
        TODAY,
      ),
    ).resolves.toBeDefined();
    await expect(
      planner.plan(
        world({ holders: [] }),
        programRequest({ requestType: ChangeRequestType.ORGANIZATION }),
        [],
        TODAY,
      ),
    ).resolves.toBeDefined();
  });
});
