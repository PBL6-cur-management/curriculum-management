import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../../generated/prisma/client.js';
import { SyllabusPublisher } from './syllabus.publisher.js';

const NOW = new Date('2026-10-19T03:00:00.000Z');
const COMPLETE = {
  courseDescription: '<p>Mô tả</p>',
  objectives: '<p>Mục tiêu</p>',
  failingScore: null,
  clos: [{ id: 'k1', cloCode: 'CLO1', sortOrder: 1 }],
  assessmentComponents: [
    {
      id: 'a1',
      componentCode: 'GK',
      weight: '100',
      isConditional: false,
      conditionThreshold: null,
      failingScore: null,
      mappings: [{ cloId: 'k1', cloWeight: null }],
    },
  ],
};

describe('SyllabusPublisher', () => {
  let calls: string[];
  let locked: string[];
  let rows: Record<string, Record<string, unknown>>;
  let syllabus: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    aggregate: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let tx: Prisma.TransactionClient;
  const publisher = new SyllabusPublisher();

  beforeEach(() => {
    calls = [];
    locked = [];
    rows = {};
    syllabus = {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue({ sourceRequestId: null }),
      findUniqueOrThrow: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(rows[where.id]),
      ),
      aggregate: vi.fn().mockResolvedValue({ _max: { revisionNumber: 2 } }),
      update: vi.fn(
        (args: { where: { id: string }; data: { status?: string } }) => {
          calls.push(`${args.where.id}:${args.data.status}`);
          return Promise.resolve({ id: args.where.id, ...args.data });
        },
      ),
    };
    const $queryRaw = vi.fn((strings: TemplateStringsArray) => {
      locked.push(/FROM "(\w+)"/.exec(strings.join(''))![1]!);
      return Promise.resolve([]);
    });
    tx = { syllabus, $queryRaw } as unknown as Prisma.TransactionClient;
  });

  describe('publishDraftForFirstPin', () => {
    it('reuses a complete published revision and writes nothing', async () => {
      rows['pub'] = { id: 'pub', courseId: 'c1', ...COMPLETE };
      syllabus.findFirst.mockResolvedValueOnce({ id: 'pub' });

      expect(await publisher.publishDraftForFirstPin(tx, 'c1', NOW)).toBe(
        'pub',
      );
      expect(syllabus.update).not.toHaveBeenCalled();
      expect(locked).toEqual(['Syllabus']);
    });

    it('refuses to pin a published revision that has no grade formula', async () => {
      rows['pub'] = {
        id: 'pub',
        courseId: 'c1',
        ...COMPLETE,
        assessmentComponents: [],
      };
      syllabus.findFirst.mockResolvedValueOnce({ id: 'pub' });

      await expect(
        publisher.publishDraftForFirstPin(tx, 'c1', NOW),
      ).rejects.toMatchObject({
        code: 'SYLLABUS_INCOMPLETE',
        details: [
          { constraints: ['ASSESSMENT_FORMULA_EMPTY'] },
          { constraints: ['ASSESSMENT_CLO_UNCOVERED'] },
        ],
      });
    });

    it('locks the Draft and publishes it with the publication time', async () => {
      rows['draft'] = { id: 'draft', courseId: 'c1', ...COMPLETE };
      syllabus.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'draft', courseId: 'c1' });

      expect(await publisher.publishDraftForFirstPin(tx, 'c1', NOW)).toBe(
        'draft',
      );
      expect(locked).toEqual(['Syllabus']);
      expect(syllabus.update).toHaveBeenCalledWith({
        where: { id: 'draft' },
        data: { status: 'PUBLISHED', publishedAt: NOW },
      });
    });

    it('names a course with no revision at all', async () => {
      await expect(
        publisher.publishDraftForFirstPin(tx, 'c1', NOW),
      ).rejects.toMatchObject({
        code: 'MISSING_SYLLABUS',
        details: [{ field: 'c1' }],
      });
    });

    it.each([
      [
        { courseDescription: null, objectives: '<p>x</p>' },
        ['COURSE_DESCRIPTION_EMPTY'],
      ],
      [
        { courseDescription: '<p> </p>', objectives: null },
        ['COURSE_DESCRIPTION_EMPTY', 'OBJECTIVES_EMPTY'],
      ],
      [
        { assessmentComponents: [] },
        ['ASSESSMENT_FORMULA_EMPTY', 'ASSESSMENT_CLO_UNCOVERED'],
      ],
      [
        {
          clos: [...COMPLETE.clos, { id: 'k2', cloCode: 'CLO2', sortOrder: 2 }],
        },
        ['ASSESSMENT_CLO_UNCOVERED'],
      ],
    ])(
      'refuses an incomplete Draft and lists every missing condition',
      async (content, missing) => {
        rows['draft'] = {
          id: 'draft',
          courseId: 'c1',
          ...COMPLETE,
          ...content,
        };
        syllabus.findFirst
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'draft', courseId: 'c1' });

        const error = await publisher
          .publishDraftForFirstPin(tx, 'c1', NOW)
          .catch((e: unknown) => e);

        expect(error).toMatchObject({ code: 'SYLLABUS_INCOMPLETE' });
        expect(
          (error as { details: { constraints: string[] }[] }).details.map(
            (detail) => detail.constraints[0],
          ),
        ).toEqual(missing);
        expect(syllabus.update).not.toHaveBeenCalled();
      },
    );
  });

  describe('publishFromRequest', () => {
    const copy = {
      id: 'copy',
      courseId: 'c1',
      sourceRequestId: 'r1',
      baseRevisionId: 'base',
      ...COMPLETE,
    };

    beforeEach(() => {
      rows['copy'] = copy;
      rows['base'] = { id: 'base', status: 'PUBLISHED' };
      syllabus.findUnique.mockResolvedValue({ sourceRequestId: 'r1' });
    });

    it('locks the request before the copy, then moves the published revision to Historical before the copy becomes Published', async () => {
      const result = await publisher.publishFromRequest(tx, 'copy', 'r1', NOW);

      expect(locked).toEqual(['ChangeRequest', 'Syllabus']);
      expect(calls).toEqual(['base:HISTORICAL', 'copy:PUBLISHED']);
      expect(syllabus.update).toHaveBeenLastCalledWith({
        where: { id: 'copy' },
        data: expect.objectContaining({
          sourceRequestId: null,
          originRequestId: 'r1',
          baseRevisionId: null,
          revisionNumber: 3,
          previousVersionId: 'base',
          publishedAt: NOW,
        }),
      });
      expect(result.previous).toMatchObject({ id: 'base' });
    });

    it('refuses a copy of another request, and a base that is no longer the published revision', async () => {
      await expect(
        publisher.publishFromRequest(tx, 'copy', 'other', NOW),
      ).rejects.toMatchObject({
        code: 'ITEM_APPLY_FAILED',
      });
      rows['base'] = { id: 'base', status: 'HISTORICAL' };
      await expect(
        publisher.publishFromRequest(tx, 'copy', 'r1', NOW),
      ).rejects.toMatchObject({
        code: 'ITEM_APPLY_FAILED',
      });
      expect(syllabus.update).not.toHaveBeenCalled();
    });

    it('refuses an incomplete copy before touching any row', async () => {
      rows['copy'] = { ...copy, objectives: null };

      await expect(
        publisher.publishFromRequest(tx, 'copy', 'r1', NOW),
      ).rejects.toMatchObject({
        code: 'SYLLABUS_INCOMPLETE',
      });
      expect(syllabus.update).not.toHaveBeenCalled();
    });

    it('refuses a copy whose grade formula does not total 100', async () => {
      rows['copy'] = {
        ...copy,
        assessmentComponents: [
          { ...COMPLETE.assessmentComponents[0], weight: '90' },
        ],
      };

      await expect(
        publisher.publishFromRequest(tx, 'copy', 'r1', NOW),
      ).rejects.toMatchObject({
        code: 'SYLLABUS_INCOMPLETE',
        details: [{ constraints: ['ASSESSMENT_WEIGHT_TOTAL_INVALID'] }],
      });
      expect(syllabus.update).not.toHaveBeenCalled();
    });
  });
});
