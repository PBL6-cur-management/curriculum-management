import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../../generated/prisma/client.js';
import { copySyllabusRevision } from './syllabus-revision.copier.js';

function setup() {
  const syllabus = {
    findUniqueOrThrow: vi.fn().mockResolvedValue({
      id: 'base',
      courseId: 'c1',
      courseDescription: '<p>Mô tả</p><script>alert(1)</script>',
      englishDescription: null,
      objectives: '<p>Mục tiêu</p>',
      teachingMethods: null,
      assessmentMethods: null,
      references: null,
      failingScore: '4',
      assessmentComponents: [
        {
          id: 'old-a1',
          componentCode: 'GK',
          componentName: 'Giữa kỳ',
          weight: '100',
          assessmentForm: null,
          isConditional: true,
          conditionThreshold: '0',
          failingScore: null,
          mappings: [
            { cloId: 'old-clo1', cloWeight: null },
            { cloId: 'old-clo2', cloWeight: '50' },
            { cloId: 'foreign', cloWeight: '10' },
          ],
        },
      ],
      clos: [
        {
          id: 'old-clo1',
          cloCode: 'CLO1',
          description: 'a',
          englishDescription: null,
          cognitiveLevel: 'Nhớ',
          sortOrder: 1,
        },
        {
          id: 'old-clo2',
          cloCode: 'CLO2',
          description: 'b',
          englishDescription: 'B',
          cognitiveLevel: null,
          sortOrder: 2,
        },
      ],
      weeklyContents: [
        {
          id: 'w1',
          weekLabel: 'Tuần 1',
          sortOrder: 1,
          content: '<p>Nội dung</p>',
          teachingActivities: null,
          cloLinks: [{ cloId: 'old-clo2' }],
        },
        {
          id: 'w2',
          weekLabel: 'Tuần 2',
          sortOrder: 2,
          content: '<p>Tiếp</p>',
          teachingActivities: '<p>Thực hành</p>',
          cloLinks: [],
        },
      ],
    }),
    create: vi.fn().mockResolvedValue({ id: 'copy' }),
  };
  const cLO = {
    createManyAndReturn: vi.fn().mockResolvedValue([
      { id: 'new-clo2', cloCode: 'CLO2' },
      { id: 'new-clo1', cloCode: 'CLO1' },
    ]),
  };
  const weeklyContent = {
    create: vi
      .fn()
      .mockResolvedValueOnce({ id: 'nw1' })
      .mockResolvedValueOnce({ id: 'nw2' }),
  };
  const weeklyContentCLO = {
    createMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const assessmentComponent = {
    create: vi.fn().mockResolvedValue({ id: 'na1' }),
  };
  const assessmentCLOMapping = {
    createMany: vi.fn().mockResolvedValue({ count: 2 }),
  };
  const tx = {
    syllabus,
    cLO,
    weeklyContent,
    weeklyContentCLO,
    assessmentComponent,
    assessmentCLOMapping,
  } as unknown as Prisma.TransactionClient;
  return {
    tx,
    syllabus,
    cLO,
    weeklyContent,
    weeklyContentCLO,
    assessmentComponent,
    assessmentCLOMapping,
  };
}

describe('copySyllabusRevision', () => {
  it('creates an unnumbered Draft that points at its request and base, with sanitized text', async () => {
    const { tx, syllabus } = setup();
    await expect(
      copySyllabusRevision(tx, 'base', { sourceRequestId: 'cr1' }),
    ).resolves.toBe('copy');
    const data = syllabus.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      courseId: 'c1',
      status: 'DRAFT',
      revisionNumber: null,
      sourceRequestId: 'cr1',
      baseRevisionId: 'base',
      objectives: '<p>Mục tiêu</p>',
      englishDescription: null,
    });
    expect(data.courseDescription).toBe('<p>Mô tả</p>');
    expect(data).not.toHaveProperty('previousVersionId');
  });

  it('re-points each week CLO link at the copy CLO with the same code and leaves attachments behind', async () => {
    const { tx, cLO, weeklyContent, weeklyContentCLO, syllabus } = setup();
    await copySyllabusRevision(tx, 'base', { sourceRequestId: 'cr1' });
    expect(cLO.createManyAndReturn.mock.calls[0][0].data).toEqual([
      expect.objectContaining({
        syllabusId: 'copy',
        cloCode: 'CLO1',
        cognitiveLevel: 'Nhớ',
      }),
      expect.objectContaining({
        syllabusId: 'copy',
        cloCode: 'CLO2',
        englishDescription: 'B',
      }),
    ]);
    expect(weeklyContent.create).toHaveBeenCalledTimes(2);
    expect(weeklyContentCLO.createMany).toHaveBeenCalledOnce();
    expect(weeklyContentCLO.createMany).toHaveBeenCalledWith({
      data: [{ weeklyContentId: 'nw1', cloId: 'new-clo2' }],
    });
    expect(
      JSON.stringify(syllabus.findUniqueOrThrow.mock.calls[0][0]),
    ).not.toContain('attachments');
  });

  it('copies the grade formula and re-points each assessment link at the copy CLO', async () => {
    const { tx, syllabus, assessmentComponent, assessmentCLOMapping } = setup();
    await copySyllabusRevision(tx, 'base', { sourceRequestId: 'cr1' });

    expect(syllabus.create.mock.calls[0][0].data.failingScore).toBe('4');
    expect(assessmentComponent.create.mock.calls[0][0].data).toMatchObject({
      syllabusId: 'copy',
      componentCode: 'GK',
      weight: '100',
      isConditional: true,
      conditionThreshold: '0',
    });
    expect(assessmentCLOMapping.createMany).toHaveBeenCalledWith({
      data: [
        { assessmentComponentId: 'na1', cloId: 'new-clo1', cloWeight: null },
        { assessmentComponentId: 'na1', cloId: 'new-clo2', cloWeight: '50' },
      ],
    });
  });
});
