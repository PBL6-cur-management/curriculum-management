import { describe, expect, it } from 'vitest';
import type { Syllabus } from '../api/syllabi';
import { changedSections } from './syllabusSectionChanges';

const initial: Syllabus = {
  id: 's1',
  revisionNumber: 1,
  status: 'DRAFT',
  sourceRequest: null,
  courseDescription: '<p>Mô tả</p>',
  englishDescription: null,
  objectives: '<p>Mục tiêu</p>',
  teachingMethods: null,
  assessmentMethods: null,
  references: null,
  publishedAt: null,
  updatedAt: '2026-10-19T00:00:00.000Z',
  weeklyContents: [],
  attachments: [],
  clos: [],
  gradingFormula: {
    failingScore: null,
    totalWeight: '0',
    components: [],
    warnings: [],
  },
};

describe('changedSections', () => {
  it('is empty when nothing changed', () => {
    expect(
      changedSections(initial, {
        courseDescription: '<p>Mô tả</p>',
        englishDescription: undefined,
        objectives: '<p>Mục tiêu</p>',
      }),
    ).toEqual({});
  });

  it('keeps only the field that changed', () => {
    expect(
      changedSections(initial, {
        courseDescription: '<p>Mô tả mới</p>',
        objectives: '<p>Mục tiêu</p>',
      }),
    ).toEqual({ courseDescription: '<p>Mô tả mới</p>' });
  });

  it('sends null for a cleared section', () => {
    expect(changedSections(initial, { objectives: null })).toEqual({
      objectives: null,
    });
  });

  it('treats an untouched empty section as unchanged', () => {
    expect(changedSections(initial, { teachingMethods: null })).toEqual({});
  });
});
