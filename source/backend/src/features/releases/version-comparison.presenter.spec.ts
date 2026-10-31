import { describe, expect, it } from 'vitest';
import { entry } from '../../shared/change-requests/diff/snapshot-scalar.js';
import type { SnapshotEntry } from '../../shared/change-requests/diff/snapshot-entry.js';
import type { ReleasedProgramSnapshot } from './released-version-snapshot.reader.js';
import { presentVersionComparison } from './version-comparison.presenter.js';

function snapshot(
  entries: SnapshotEntry[] = [],
  id = 'v1',
): ReleasedProgramSnapshot {
  return {
    version: {
      id,
      versionNumber: '1.0',
      status: 'HISTORICAL',
      decisionNumber: 'QD',
      effectiveSemester: {
        id: 's',
        semesterCode: 'S',
        academicYear: 'Y',
        termInYear: 1,
        startDate: '2026-01-01',
        startDateEstimated: false,
      },
    },
    entries,
    pinsByCourseCode: new Map(),
  };
}
describe('version comparison presentation', () => {
  it('retains exactly six empty sections for identical endpoints', () => {
    const before = snapshot([
      entry('VERSION_INFO', 'programName', 'Tên chương trình', 'v1', {
        value: 'Name',
      }),
    ]);
    const after = snapshot(
      [{ ...before.entries[0], recordId: 'copied-id' }],
      'v3',
    );
    const result = presentVersionComparison('p', before, after);
    expect(result.sections.map((section) => section.key)).toEqual([
      'INFO',
      'CURRICULUM',
      'ELECTIVE_GROUPS',
      'PLOS',
      'MATRICES',
      'SYLLABI',
    ]);
    expect(result.sections.every((section) => section.rows.length === 0)).toBe(
      true,
    );
  });
  it('compares direct non-adjacent endpoints and sorts grouped entities by natural key', () => {
    const before = snapshot([
      entry('CURRICULUM_ITEM', 'C1', 'C1 Old frozen', 'old', {
        courseName: 'Old frozen',
        credits: '3',
        plannedSemester: '1',
        note: null,
      }),
      entry('PLO', 'P1', 'P1', 'old-plo', { description: 'Removed' }),
      entry('ELECTIVE_GROUP', 'G1', 'G1', 'old-g', { groupName: 'Old group' }),
      entry('COURSE_PLO', '[C1,P1]', 'C1 — P1', 'old-m', { weight: '0.1234' }),
    ]);
    const after = snapshot(
      [
        entry('CLO_PLO', '[C1,CLO1,P1]', 'CLO1', 'new-link', {
          linked: 'true',
        }),
        entry(
          'CURRICULUM_REQUISITE',
          '[C1,C0,PREREQUISITE]',
          'C1 ← C0',
          'new-r',
          { minScore: '4.5' },
        ),
        entry('CURRICULUM_ITEM', 'C1', 'C1 New frozen', 'new', {
          courseName: 'New frozen',
          credits: '4',
          plannedSemester: '2',
          note: '',
        }),
        entry('ELECTIVE_GROUP', 'G1', 'G1', 'new-g', {
          groupName: 'New group',
        }),
        entry('COURSE_PLO', '[C1,P1]', 'C1 — P1', 'new-m', {
          weight: '0.1235',
        }),
      ],
      'v3',
    );
    const result = presentVersionComparison('p', before, after);
    const curriculum = result.sections[1].rows;
    expect(curriculum.map((row) => row.change)).toEqual(['CHANGED', 'ADDED']);
    expect(curriculum[0]).toMatchObject({
      label: 'C1 New frozen',
      fields: expect.arrayContaining([
        {
          name: 'courseName',
          label: 'Tên học phần',
          before: 'Old frozen',
          after: 'New frozen',
        },
        { name: 'note', label: 'Ghi chú', before: null, after: '' },
      ]),
    });
    expect(result.sections[3].rows[0].change).toBe('REMOVED');
    expect(result.sections[4].rows[0].fields[0]).toMatchObject({
      before: '0.1234',
      after: '0.1235',
    });
    expect(result.sections[4].rows[1].fields[0].after).toBe('Có');
  });
  it('links only pins changed between two existing course contexts', () => {
    const before = snapshot([
      entry('PINNED_SYLLABUS', 'C1', 'C1 Frozen', 'row1', {
        syllabusId: 'pin1',
        revisionNumber: '1',
      }),
    ]);
    const after = snapshot(
      [
        entry('PINNED_SYLLABUS', 'C1', 'C1 Frozen', 'row2', {
          syllabusId: 'pin2',
          revisionNumber: '2',
        }),
      ],
      'v3',
    );
    before.pinsByCourseCode = new Map([
      ['C1', { courseId: 'course', syllabusId: 'pin1', revisionNumber: 1 }],
    ]);
    after.pinsByCourseCode = new Map([
      ['C1', { courseId: 'course', syllabusId: 'pin2', revisionNumber: 2 }],
    ]);
    expect(
      presentVersionComparison('p', before, after).sections[5].rows[0],
    ).toMatchObject({
      change: 'CHANGED',
      syllabusComparison: {
        courseId: 'course',
        beforeSyllabusId: 'pin1',
        afterSyllabusId: 'pin2',
      },
    });
    expect(
      presentVersionComparison('p', snapshot(), after).sections[5].rows[0],
    ).toMatchObject({ change: 'ADDED', syllabusComparison: null });
    expect(
      presentVersionComparison('p', before, snapshot()).sections[5].rows[0],
    ).toMatchObject({
      change: 'REMOVED',
      label: 'C1 Frozen',
      syllabusComparison: null,
    });
    expect(
      presentVersionComparison('p', before, before).sections[5].rows,
    ).toEqual([]);
  });
});
