import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Prisma,
  ProgramVersionStatus,
  ScopeSource,
  ScopeType,
  type PermissionMode,
} from '../../generated/prisma/client.js';
import {
  AccessContext,
  type ActiveAssignment,
} from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import type { VersionRow } from './curriculum-access.js';
import type { CurriculumReadService } from './curriculum-read.service.js';
import { BulkAssignTrackMode } from './program-track.dto.js';
import { ProgramTracksService } from './program-tracks.service.js';

const VERSION: VersionRow = {
  id: 'v1',
  status: ProgramVersionStatus.DRAFT,
  semesterCount: 8,
  programId: 'p1',
  programName: 'Kỹ thuật máy tính',
  versionNumber: null,
  totalCredits: new Prisma.Decimal('150'),
  compulsoryCredits: new Prisma.Decimal('100'),
  electiveCredits: new Prisma.Decimal('50'),
  program: { id: 'p1', facultyId: 'home', programCode: '1024034' },
  sourceRequest: null,
  correctionOfId: null,
};

function access(
  mode: PermissionMode,
  all: boolean,
  subjectGroupIds: string[] = [],
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
      orgUnitIds: new Set(),
      subjectGroupIds: new Set(subjectGroupIds),
      programIds: new Set(),
      studentIds: new Set(),
    },
    permissions: new Map([
      [
        PERMISSIONS.CURRICULUM_EDIT,
        { mode, scope: all ? ('ALL' as const) : ('SCOPED' as const) },
      ],
    ]),
  };
  return new AccessContext('user', [assignment]);
}

const R1 = access('DIRECT', true);
const R4 = access('VIA_REQUEST', false, ['G1']);

const dec = (value: string) => new Prisma.Decimal(value);

type Fn = ReturnType<typeof vi.fn>;

const source = (patch: Record<string, unknown> = {}) => ({
  id: 'i1',
  versionId: 'v1',
  trackId: null as string | null,
  courseId: 'c1',
  plannedSemester: 1,
  sortOrder: 1,
  blockSymbol: null,
  isElective: false,
  electiveGroupId: 'g1',
  htDa: false,
  tqDa: false,
  note: null,
  requisites: [] as unknown[],
  ploMappings: [] as unknown[],
  ...patch,
});

const existingRow = (
  id: string,
  trackId: string | null,
  courseId: string,
  plannedSemester = 1,
  sortOrder = 1,
) => ({ id, trackId, courseId, plannedSemester, sortOrder });

describe('ProgramTracksService.bulkAssign', () => {
  let tx: {
    programTrack: { findMany: Fn };
    curriculumItem: { findMany: Fn; update: Fn; create: Fn };
    curriculumRequisite: { createMany: Fn };
    coursePLOMapping: { createMany: Fn };
    cLOPLOMapping: { createMany: Fn };
  };
  let findVersion: Fn;
  let service: ProgramTracksService;

  const setup = (sources: unknown[], existing: unknown[], tracks: string[]) => {
    tx.programTrack.findMany.mockResolvedValue(tracks.map((id) => ({ id })));
    tx.curriculumItem.findMany
      .mockResolvedValueOnce(sources)
      .mockResolvedValueOnce(existing);
  };

  beforeEach(() => {
    tx = {
      programTrack: { findMany: vi.fn() },
      curriculumItem: {
        findMany: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({ id: 'new' }),
      },
      curriculumRequisite: { createMany: vi.fn().mockResolvedValue({}) },
      coursePLOMapping: { createMany: vi.fn().mockResolvedValue({}) },
      cLOPLOMapping: { createMany: vi.fn().mockResolvedValue({}) },
    };
    findVersion = vi.fn().mockResolvedValue(VERSION);
    const client: Record<string, unknown> = {
      programVersion: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    };
    service = new ProgramTracksService(client as unknown as PrismaService, {
      findVersion,
    } as unknown as CurriculumReadService);
  });

  it('rejects non-draft versions', async () => {
    findVersion.mockResolvedValue({
      ...VERSION,
      status: ProgramVersionStatus.ACTIVE,
    });
    await expect(
      service.bulkAssign(
        'v1',
        { itemIds: ['i1'], trackIds: [], mode: BulkAssignTrackMode.MOVE },
        R1,
      ),
    ).rejects.toThrow();
    expect(tx.curriculumItem.findMany).not.toHaveBeenCalled();
  });

  it('throws TRACK_NOT_FOUND when a track is missing from the version', async () => {
    tx.programTrack.findMany.mockResolvedValue([{ id: 't1' }]);
    await expect(
      service.bulkAssign(
        'v1',
        { itemIds: ['i1'], trackIds: ['t1', 't2'], mode: BulkAssignTrackMode.COPY },
        R1,
      ),
    ).rejects.toMatchObject({ response: expect.anything() as unknown });
    expect(tx.curriculumItem.create).not.toHaveBeenCalled();
  });

  it('MOVE relocates an item to a track and clears elective group', async () => {
    setup([source()], [existingRow('i1', null, 'c1')], ['t1']);
    const result = await service.bulkAssign(
      'v1',
      { itemIds: ['i1', 'i1'], trackIds: ['t1', 't1'], mode: BulkAssignTrackMode.MOVE },
      R1,
    );
    expect(result).toEqual({ updated: 1, created: 0, skipped: 0 });
    expect(tx.curriculumItem.update).toHaveBeenCalledWith({
      where: { id: 'i1' },
      data: { trackId: 't1', electiveGroupId: null },
    });
  });

  it('MOVE to Common Core with empty trackIds sets trackId null', async () => {
    setup(
      [source({ trackId: 't1' })],
      [existingRow('i1', 't1', 'c1')],
      [],
    );
    const result = await service.bulkAssign(
      'v1',
      { itemIds: ['i1'], trackIds: [], mode: BulkAssignTrackMode.MOVE, isElective: true },
      R1,
    );
    expect(result).toEqual({ updated: 1, created: 0, skipped: 0 });
    expect(tx.curriculumItem.update).toHaveBeenCalledWith({
      where: { id: 'i1' },
      data: { trackId: null, electiveGroupId: null, isElective: true },
    });
  });

  it('MOVE skips when the target already holds the course', async () => {
    setup(
      [source()],
      [existingRow('i1', null, 'c1'), existingRow('x', 't1', 'c1')],
      ['t1'],
    );
    const result = await service.bulkAssign(
      'v1',
      { itemIds: ['i1'], trackIds: ['t1'], mode: BulkAssignTrackMode.MOVE },
      R1,
    );
    expect(result).toEqual({ updated: 0, created: 0, skipped: 1 });
    expect(tx.curriculumItem.update).not.toHaveBeenCalled();
  });

  it('MOVE within same track skips or updates isElective', async () => {
    setup(
      [source({ trackId: 't1' }), source({ id: 'i2', trackId: 't1', courseId: 'c2' })],
      [existingRow('i1', 't1', 'c1'), existingRow('i2', 't1', 'c2')],
      ['t1'],
    );
    const same = await service.bulkAssign(
      'v1',
      { itemIds: ['i1', 'i2'], trackIds: ['t1'], mode: BulkAssignTrackMode.MOVE, isElective: true },
      R1,
    );
    expect(same).toEqual({ updated: 2, created: 0, skipped: 0 });
    expect(tx.curriculumItem.update).toHaveBeenCalledWith({
      where: { id: 'i1' },
      data: { isElective: true },
    });

    setup([source({ trackId: 't1' })], [existingRow('i1', 't1', 'c1')], ['t1']);
    const none = await service.bulkAssign(
      'v1',
      { itemIds: ['i1'], trackIds: ['t1'], mode: BulkAssignTrackMode.MOVE },
      R1,
    );
    expect(none).toEqual({ updated: 0, created: 0, skipped: 1 });
  });

  it('same-track MOVE to compulsory clears electiveGroupId', async () => {
    setup(
      [source({ trackId: 't1', isElective: true })],
      [existingRow('i1', 't1', 'c1')],
      ['t1'],
    );
    await service.bulkAssign(
      'v1',
      { itemIds: ['i1'], trackIds: ['t1'], mode: BulkAssignTrackMode.MOVE, isElective: false },
      R1,
    );
    expect(tx.curriculumItem.update).toHaveBeenCalledWith({
      where: { id: 'i1' },
      data: { isElective: false, electiveGroupId: null },
    });
  });

  it('MOVE to several tracks moves to first and clones to the rest', async () => {
    setup([source()], [existingRow('i1', null, 'c1', 1, 3)], ['t1', 't2']);
    const result = await service.bulkAssign(
      'v1',
      { itemIds: ['i1'], trackIds: ['t1', 't2'], mode: BulkAssignTrackMode.MOVE },
      R1,
    );
    expect(result).toEqual({ updated: 1, created: 1, skipped: 0 });
    expect(tx.curriculumItem.create).toHaveBeenCalledTimes(1);
    expect(tx.curriculumItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ trackId: 't2', sortOrder: 4 }) as unknown,
      }),
    );
  });

  it('COPY clones item with requisites and PLO/CLO mappings', async () => {
    const src = source({
      requisites: [
        { sourceCourseId: 'c9', relationType: 'PREREQUISITE', minScore: dec('5') },
      ],
      ploMappings: [
        {
          ploId: 'p1',
          weight: dec('0.5'),
          cloLinks: [{ ploId: 'p1', cloId: 'clo1' }],
        },
      ],
    });
    setup([src], [existingRow('i1', null, 'c1', 1, 2)], ['t1', 't2']);
    const result = await service.bulkAssign(
      'v1',
      { itemIds: ['i1'], trackIds: ['t1', 't2'], mode: BulkAssignTrackMode.COPY, isElective: true },
      R1,
    );
    expect(result).toEqual({ updated: 0, created: 2, skipped: 0 });
    expect(tx.curriculumItem.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          trackId: 't1',
          sortOrder: 3,
          isElective: true,
          electiveGroupId: null,
        }) as unknown,
      }),
    );
    expect(tx.curriculumItem.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ trackId: 't2', sortOrder: 4 }) as unknown,
      }),
    );
    expect(tx.curriculumRequisite.createMany).toHaveBeenCalledTimes(2);
    expect(tx.coursePLOMapping.createMany).toHaveBeenCalledTimes(2);
    expect(tx.cLOPLOMapping.createMany).toHaveBeenCalledWith({
      data: [{ curriculumItemId: 'new', ploId: 'p1', cloId: 'clo1' }],
    });
  });

  it('COPY skips existing pairs, including Common Core', async () => {
    setup(
      [source({ trackId: 't1' })],
      [existingRow('i1', 't1', 'c1'), existingRow('x', null, 'c1')],
      ['t1'],
    );
    const result = await service.bulkAssign(
      'v1',
      { itemIds: ['i1'], trackIds: [], mode: BulkAssignTrackMode.COPY },
      R1,
    );
    expect(result).toEqual({ updated: 0, created: 0, skipped: 1 });
    expect(tx.curriculumItem.create).not.toHaveBeenCalled();
    expect(tx.curriculumRequisite.createMany).not.toHaveBeenCalled();
  });

  it('ignores item ids that are not in the version', async () => {
    setup([], [], []);
    const result = await service.bulkAssign(
      'v1',
      { itemIds: ['ghost'], trackIds: [], mode: BulkAssignTrackMode.COPY },
      R1,
    );
    expect(result).toEqual({ updated: 0, created: 0, skipped: 0 });
  });
});