import { describe, expect, it, vi } from 'vitest';
import { CourseRelationType, Prisma } from '../../generated/prisma/client.js';
import { VersionContentCopier } from './version-content.copier.js';

type Tx = Prisma.TransactionClient;

function txWith(source: {
  groups: object[];
  items: object[];
  requisites: object[];
  newGroups?: object[];
  newItems?: object[];
  plos?: object[];
  newPlos?: object[];
  cells?: object[];
  links?: object[];
}) {
  const groupFind = vi
    .fn()
    .mockResolvedValueOnce(source.groups)
    .mockResolvedValueOnce(source.newGroups ?? []);
  const itemFind = vi
    .fn()
    .mockResolvedValueOnce(source.items)
    .mockResolvedValueOnce(source.newItems ?? []);
  const requisiteFind = vi.fn().mockResolvedValue(source.requisites);
  const ploFind = vi
    .fn()
    .mockResolvedValueOnce(source.plos ?? [])
    .mockResolvedValueOnce(source.newPlos ?? []);
  const tx = {
    pLO: { findMany: ploFind, createMany: vi.fn() },
    coursePLOMapping: {
      findMany: vi.fn().mockResolvedValue(source.cells ?? []),
      createMany: vi.fn(),
    },
    cLOPLOMapping: {
      findMany: vi.fn().mockResolvedValue(source.links ?? []),
      createMany: vi.fn(),
    },
    electiveGroup: { findMany: groupFind, createMany: vi.fn() },
    curriculumItem: { findMany: itemFind, createMany: vi.fn() },
    curriculumRequisite: { findMany: requisiteFind, createMany: vi.fn() },
  };
  return {
    tx,
    copy: () =>
      new VersionContentCopier().copy(tx as unknown as Tx, 'from', 'to'),
  };
}

const dec = (value: string) => new Prisma.Decimal(value);

describe('VersionContentCopier.copy', () => {
  it('copies nothing and issues no createMany for an empty version', async () => {
    const { tx, copy } = txWith({ groups: [], items: [], requisites: [] });

    await copy();

    expect(tx.electiveGroup.createMany).not.toHaveBeenCalled();
    expect(tx.curriculumItem.createMany).not.toHaveBeenCalled();
    expect(tx.curriculumRequisite.createMany).not.toHaveBeenCalled();
    expect(tx.curriculumRequisite.findMany).not.toHaveBeenCalled();
  });

  it('points copied rows at the new group and item ids', async () => {
    const { tx, copy } = txWith({
      groups: [
        {
          id: 'g1',
          groupCode: 'TC1',
          groupName: 'Nhóm 1',
          minCredits: dec('6'),
          minCourses: null,
        },
        {
          id: 'g2',
          groupCode: 'TC2',
          groupName: 'Nhóm 2',
          minCredits: null,
          minCourses: 2,
        },
      ],
      newGroups: [
        { id: 'ng2', groupCode: 'TC2' },
        { id: 'ng1', groupCode: 'TC1' },
      ],
      items: [
        {
          id: 'i1',
          courseId: 'c1',
          plannedSemester: 1,
          sortOrder: 1,
          blockSymbol: 'A',
          isElective: false,
          electiveGroupId: null,
          htDa: true,
          tqDa: false,
          minStudiedScore: dec('2'),
          minTransferScore: null,
          note: 'x',
        },
        {
          id: 'i2',
          courseId: 'c2',
          plannedSemester: 2,
          sortOrder: 1,
          blockSymbol: null,
          isElective: true,
          electiveGroupId: 'g1',
          htDa: false,
          tqDa: false,
          minStudiedScore: null,
          minTransferScore: null,
          note: null,
        },
        {
          id: 'i3',
          courseId: 'c3',
          plannedSemester: 2,
          sortOrder: 2,
          blockSymbol: null,
          isElective: true,
          electiveGroupId: null,
          htDa: false,
          tqDa: false,
          minStudiedScore: null,
          minTransferScore: null,
          note: null,
        },
      ],
      newItems: [
        { id: 'ni3', courseId: 'c3' },
        { id: 'ni1', courseId: 'c1' },
        { id: 'ni2', courseId: 'c2' },
      ],
      requisites: [
        {
          id: 'r1',
          itemId: 'i2',
          sourceCourseId: 'c1',
          relationType: CourseRelationType.PREREQUISITE,
          minScore: dec('2'),
        },
        {
          id: 'r2',
          itemId: 'i3',
          sourceCourseId: 'c1',
          relationType: CourseRelationType.COREQUISITE,
          minScore: null,
        },
      ],
    });

    await copy();

    expect(tx.electiveGroup.createMany).toHaveBeenCalledWith({
      data: [
        {
          versionId: 'to',
          trackId: null,
          groupCode: 'TC1',
          groupName: 'Nhóm 1',
          minCredits: dec('6'),
          minCourses: null,
        },
        {
          versionId: 'to',
          trackId: null,
          groupCode: 'TC2',
          groupName: 'Nhóm 2',
          minCredits: null,
          minCourses: 2,
        },
      ],
    });
    const items = tx.curriculumItem.createMany.mock.calls[0][0].data;
    expect(items).toHaveLength(3);
    expect(
      items.every((row: { versionId: string }) => row.versionId === 'to'),
    ).toBe(true);
    expect(items[1].electiveGroupId).toBe('ng1');
    expect(items[0].electiveGroupId).toBeNull();
    expect(items[0]).toMatchObject({
      courseId: 'c1',
      htDa: true,
      note: 'x',
      blockSymbol: 'A',
    });
    expect(tx.curriculumRequisite.findMany).toHaveBeenCalledWith({
      where: { itemId: { in: ['i1', 'i2', 'i3'] } },
    });
    expect(tx.curriculumRequisite.createMany).toHaveBeenCalledWith({
      data: [
        {
          itemId: 'ni2',
          sourceCourseId: 'c1',
          relationType: CourseRelationType.PREREQUISITE,
          minScore: dec('2'),
        },
        {
          itemId: 'ni3',
          sourceCourseId: 'c1',
          relationType: CourseRelationType.COREQUISITE,
          minScore: null,
        },
      ],
    });
  });

  it('never writes to the source version', async () => {
    const { tx, copy } = txWith({
      groups: [],
      items: [
        {
          id: 'i1',
          courseId: 'c1',
          plannedSemester: 1,
          sortOrder: 1,
          blockSymbol: null,
          isElective: false,
          electiveGroupId: null,
          htDa: false,
          tqDa: false,
          minStudiedScore: null,
          minTransferScore: null,
          note: null,
        },
      ],
      newItems: [{ id: 'ni1', courseId: 'c1' }],
      requisites: [],
    });

    await copy();

    const created = tx.curriculumItem.createMany.mock.calls[0][0].data;
    expect(
      created.every((row: { versionId: string }) => row.versionId === 'to'),
    ).toBe(true);
    expect(tx.curriculumRequisite.createMany).not.toHaveBeenCalled();
  });

  it('remaps PLO ids by code, cells on both ids with the weight kept, and links with the CLO id unchanged', async () => {
    const item = (id: string, courseId: string) => ({
      id,
      courseId,
      plannedSemester: 1,
      sortOrder: 1,
      blockSymbol: null,
      isElective: false,
      electiveGroupId: null,
      htDa: false,
      tqDa: false,
      minStudiedScore: null,
      minTransferScore: null,
      note: null,
    });
    const { tx, copy } = txWith({
      groups: [],
      items: [item('i1', 'c1')],
      newItems: [{ id: 'ni1', courseId: 'c1' }],
      requisites: [],
      plos: [
        {
          id: 'p1',
          ploCode: 'PLO1',
          description: 'Mô tả',
          englishDescription: null,
          competencyGroup: 'Kiến thức',
          sortOrder: 1,
        },
        {
          id: 'p2',
          ploCode: 'PLO2',
          description: 'Mô tả 2',
          englishDescription: 'Desc 2',
          competencyGroup: null,
          sortOrder: 2,
        },
      ],
      newPlos: [
        { id: 'np2', ploCode: 'PLO2' },
        { id: 'np1', ploCode: 'PLO1' },
      ],
      cells: [{ curriculumItemId: 'i1', ploId: 'p2', weight: dec('0.5') }],
      links: [{ curriculumItemId: 'i1', ploId: 'p2', cloId: 'clo-shared' }],
    });

    await copy();

    expect(tx.pLO.createMany.mock.calls[0][0].data[1]).toEqual({
      versionId: 'to',
      ploCode: 'PLO2',
      description: 'Mô tả 2',
      englishDescription: 'Desc 2',
      competencyGroup: null,
      sortOrder: 2,
    });
    expect(tx.coursePLOMapping.createMany).toHaveBeenCalledWith({
      data: [{ curriculumItemId: 'ni1', ploId: 'np2', weight: dec('0.5') }],
    });
    expect(tx.cLOPLOMapping.createMany).toHaveBeenCalledWith({
      data: [{ curriculumItemId: 'ni1', ploId: 'np2', cloId: 'clo-shared' }],
    });
    const order = [
      tx.pLO.createMany,
      tx.coursePLOMapping.createMany,
      tx.cLOPLOMapping.createMany,
    ].map((fn) => fn.mock.invocationCallOrder[0]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});
