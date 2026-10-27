import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { readReleasedVersionSnapshot } from './released-version-snapshot.reader.js';

function setup() {
  const syllabus = {
    id: 'pin',
    courseId: 'course',
    revisionNumber: 1,
    status: 'HISTORICAL',
    sourceRequestId: null,
  };
  const item = {
    id: 'item',
    courseId: 'course',
    course: { courseCode: 'C1', courseName: 'Live name' },
    courseNameSnapshot: 'Frozen name',
    creditsSnapshot: new Prisma.Decimal('3.00'),
    plannedSemester: 1,
    sortOrder: 0,
    blockSymbol: null,
    isElective: false,
    electiveGroup: { groupCode: 'G' },
    htDa: false,
    tqDa: false,
    minStudiedScore: null,
    minTransferScore: null,
    note: '',
    syllabus,
    requisites: [
      {
        id: 'req',
        sourceCourse: { courseCode: 'C0' },
        relationType: 'PREREQUISITE',
        minScore: new Prisma.Decimal('4.50'),
      },
    ],
    ploMappings: [
      {
        id: 'map',
        plo: { ploCode: 'P1' },
        weight: new Prisma.Decimal('0.1234'),
        cloLinks: [{ id: 'link', clo: { cloCode: 'CLO1' } }],
      },
    ],
  };
  const version = {
    id: 'v',
    programId: 'p',
    status: 'ACTIVE',
    sourceRequestId: null,
    versionNumber: '1.0',
    decisionNumber: 'QD',
    publishedAt: new Date(),
    effectiveSemester: {
      id: 's',
      semesterCode: 'S',
      academicYear: 'Y',
      termInYear: 1,
      startDate: new Date('2026-01-01'),
    },
    programName: 'Program',
    majorCode: 'M',
    majorName: 'Major',
    semesterCount: 8,
    totalCredits: new Prisma.Decimal('120'),
    compulsoryCredits: new Prisma.Decimal('110'),
    electiveCredits: new Prisma.Decimal('10'),
    creditMismatchReason: null,
    curriculumItems: [item],
    electiveGroups: [
      {
        id: 'group',
        groupCode: 'G',
        groupName: 'Group',
        minCredits: new Prisma.Decimal('3'),
        minCourses: null,
      },
    ],
    plos: [
      {
        id: 'plo',
        ploCode: 'P1',
        description: 'Outcome',
        englishDescription: null,
        competencyGroup: null,
        sortOrder: 0,
      },
    ],
  };
  const db = {
    programVersion: { findFirst: vi.fn().mockResolvedValue(version) },
  };
  return {
    version,
    item,
    syllabus,
    db,
    tx: db as unknown as Prisma.TransactionClient,
  };
}

describe('released version snapshot reader', () => {
  it('reads all eight natural-key entry types with frozen values, exact decimals and no writes', async () => {
    const { tx, db } = setup();
    const snapshot = await readReleasedVersionSnapshot(tx, 'p', 'v');
    expect(new Set(snapshot.entries.map((row) => row.entityType)).size).toBe(8);
    expect(
      snapshot.entries.find((row) => row.entityType === 'CURRICULUM_ITEM'),
    ).toMatchObject({
      label: 'C1 Frozen name',
      value: { courseName: 'Frozen name', credits: '3', note: '' },
    });
    expect(
      snapshot.entries.find((row) => row.entityType === 'COURSE_PLO'),
    ).toMatchObject({
      itemKey: JSON.stringify(['C1', 'P1']),
      value: { weight: '0.1234' },
    });
    expect(
      snapshot.entries.find((row) => row.entityType === 'CURRICULUM_REQUISITE')
        ?.itemKey,
    ).toBe(JSON.stringify(['C1', 'C0', 'PREREQUISITE']));
    expect(snapshot.pinsByCourseCode.get('C1')).toEqual({
      courseId: 'course',
      syllabusId: 'pin',
      revisionNumber: 1,
    });
    expect(db.programVersion.findFirst).toHaveBeenCalledOnce();
    expect(db.programVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'v', programId: 'p' } }),
    );
  });
  it.each(['DRAFT', 'PENDING', 'HISTORICAL'])(
    'handles lifecycle %s without treating it as content',
    async (status) => {
      const { tx, version } = setup();
      version.status = status;
      if (status === 'DRAFT')
        await expect(
          readReleasedVersionSnapshot(tx, 'p', 'v'),
        ).rejects.toMatchObject({ code: 'VERSION_NOT_ISSUED' });
      else
        expect(
          (await readReleasedVersionSnapshot(tx, 'p', 'v')).version.status,
        ).toBe(status);
    },
  );
  it('hides absent and wrong-program versions', async () => {
    const { tx, db } = setup();
    db.programVersion.findFirst.mockResolvedValue(null);
    await expect(
      readReleasedVersionSnapshot(tx, 'other', 'v'),
    ).rejects.toMatchObject({ code: 'PROGRAM_VERSION_NOT_FOUND' });
  });
  it.each([
    'versionNumber',
    'decisionNumber',
    'publishedAt',
    'effectiveSemester',
  ])('refuses missing release fact %s', async (field) => {
    const { tx, version } = setup();
    Object.assign(version, { [field]: null });
    await expect(
      readReleasedVersionSnapshot(tx, 'p', 'v'),
    ).rejects.toMatchObject({ code: 'VERSION_NOT_ISSUED' });
  });
  it('refuses a request copy even with forged publication facts', async () => {
    const { tx, version } = setup();
    Object.assign(version, { sourceRequestId: 'request' });
    await expect(
      readReleasedVersionSnapshot(tx, 'p', 'v'),
    ).rejects.toMatchObject({ code: 'VERSION_NOT_ISSUED' });
  });
  it.each([
    { courseNameSnapshot: null },
    { creditsSnapshot: null },
    { syllabus: null },
  ])('rejects incomplete frozen row %j', async (patch) => {
    const { tx, item } = setup();
    Object.assign(item, patch);
    await expect(
      readReleasedVersionSnapshot(tx, 'p', 'v'),
    ).rejects.toMatchObject({ code: 'VERSION_SNAPSHOT_INCOMPLETE' });
  });
  it.each([
    { courseId: 'other' },
    { status: 'DRAFT' },
    { revisionNumber: null },
    { sourceRequestId: 'request' },
  ])('rejects invalid pin %j', async (patch) => {
    const { tx, syllabus } = setup();
    Object.assign(syllabus, patch);
    await expect(
      readReleasedVersionSnapshot(tx, 'p', 'v'),
    ).rejects.toMatchObject({ code: 'VERSION_SNAPSHOT_INCOMPLETE' });
  });
});
