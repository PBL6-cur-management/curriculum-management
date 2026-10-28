import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  assertNoSyllabusIssues,
  collectSyllabusIssues,
  syllabusPublishIssues,
} from './syllabus-release-issues.js';

function dbWith(
  items: { courseId: string; code: string; syllabusId?: string }[],
  revisions: Record<string, unknown>[],
) {
  return {
    curriculumItem: {
      findMany: vi.fn().mockResolvedValue(
        items.map((item) => ({
          courseId: item.courseId,
          syllabusId: item.syllabusId ?? null,
          course: { courseCode: item.code },
        })),
      ),
    },
    syllabus: { findMany: vi.fn().mockResolvedValue(revisions) },
  } as unknown as PrismaService;
}

const READY = {
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
const FULL = {
  courseDescription: '<p>a</p>',
  objectives: '<p>b</p>',
  ...READY,
};

describe('syllabusPublishIssues', () => {
  it('reads empty rich text as missing', () => {
    expect(syllabusPublishIssues(FULL)).toEqual([]);
    expect(
      syllabusPublishIssues({
        ...FULL,
        courseDescription: '<p></p>',
        objectives: null,
      }),
    ).toEqual(['COURSE_DESCRIPTION_EMPTY', 'OBJECTIVES_EMPTY']);
  });

  it('adds each assessment condition once', () => {
    expect(
      syllabusPublishIssues({
        ...FULL,
        clos: [
          ...READY.clos,
          { id: 'k2', cloCode: 'CLO2', sortOrder: 2 },
          { id: 'k3', cloCode: 'CLO3', sortOrder: 3 },
        ],
        assessmentComponents: [
          { ...READY.assessmentComponents[0]!, weight: '90' },
        ],
      }),
    ).toEqual(['ASSESSMENT_WEIGHT_TOTAL_INVALID', 'ASSESSMENT_CLO_UNCOVERED']);
    expect(
      syllabusPublishIssues({ ...FULL, assessmentComponents: [] }),
    ).toEqual(['ASSESSMENT_FORMULA_EMPTY', 'ASSESSMENT_CLO_UNCOVERED']);
  });
});

describe('collectSyllabusIssues', () => {
  it('judges the pin, else the Published revision, else the Draft, and names the rest per course', async () => {
    const db = dbWith(
      [
        { courseId: 'pub', code: 'PUB' },
        { courseId: 'ok', code: 'OK' },
        { courseId: 'half', code: 'HALF' },
        { courseId: 'none', code: 'NONE' },
        { courseId: 'pinned', code: 'PINNED', syllabusId: 'p1' },
        { courseId: 'legacy', code: 'LEGACY', syllabusId: 'l1' },
      ],
      [
        { id: 'x1', courseId: 'pub', status: 'PUBLISHED', ...FULL },
        { id: 'x2', courseId: 'ok', status: 'DRAFT', ...FULL },
        {
          id: 'x3',
          courseId: 'half',
          status: 'DRAFT',
          ...FULL,
          courseDescription: null,
        },
        { id: 'p1', courseId: 'pinned', status: 'HISTORICAL', ...FULL },
        {
          id: 'l1',
          courseId: 'legacy',
          status: 'PUBLISHED',
          ...FULL,
          assessmentComponents: [],
        },
      ],
    );

    expect(await collectSyllabusIssues(db, 'v1')).toEqual([
      {
        courseId: 'half',
        courseCode: 'HALF',
        code: 'SYLLABUS_INCOMPLETE',
        details: ['COURSE_DESCRIPTION_EMPTY'],
      },
      {
        courseId: 'none',
        courseCode: 'NONE',
        code: 'MISSING_SYLLABUS',
        details: [],
      },
      {
        courseId: 'legacy',
        courseCode: 'LEGACY',
        code: 'SYLLABUS_INCOMPLETE',
        details: ['ASSESSMENT_FORMULA_EMPTY', 'ASSESSMENT_CLO_UNCOVERED'],
      },
    ]);
    expect(
      (db.curriculumItem.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0]
        .where,
    ).toEqual({ versionId: 'v1' });
  });

  it('never leaks a request working copy into the candidates', async () => {
    const db = dbWith([{ courseId: 'c', code: 'C' }], []);

    await collectSyllabusIssues(db, 'v1');

    const where = (db.syllabus.findMany as ReturnType<typeof vi.fn>).mock
      .calls[0][0].where;
    expect(where.OR[1]).toMatchObject({ sourceRequestId: null });
  });

  it('does not query syllabi for a frame with no rows', async () => {
    const db = dbWith([], []);

    expect(await collectSyllabusIssues(db, 'v1')).toEqual([]);
    expect(
      (db.syllabus.findMany as ReturnType<typeof vi.fn>).mock.calls,
    ).toHaveLength(0);
  });

  it('raises one error that carries every course, by code', async () => {
    const db = dbWith([{ courseId: 'none', code: 'NONE' }], []);

    await expect(assertNoSyllabusIssues(db, 'v1')).rejects.toMatchObject({
      code: 'SYLLABUS_INCOMPLETE',
      details: [{ field: 'NONE', constraints: ['MISSING_SYLLABUS'] }],
    });
  });
});
