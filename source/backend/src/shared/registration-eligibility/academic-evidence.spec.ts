import { Prisma } from '../../generated/prisma/client.js';
import {
  completionEvidence,
  prerequisiteCandidates,
  prerequisiteThreshold,
  priorEvidence,
} from './academic-evidence.js';
import {
  attempt,
  eligibilityFixture,
  withAttempts,
  withRequisites,
} from './eligibility.test-fixtures.js';

describe('academic evidence', () => {
  it.each(['PASSED', 'FAILED', 'EXEMPT', 'IN_PROGRESS'] as const)(
    'keeps independent status semantics for %s',
    (status) => {
      const context = withAttempts(eligibilityFixture(), [
        attempt('A', status, '4'),
      ]);
      expect(Boolean(completionEvidence(context, 'A'))).toBe(
        status === 'PASSED' || status === 'EXEMPT',
      );
      expect(Boolean(priorEvidence(context, 'A'))).toBe(
        status !== 'IN_PROGRESS',
      );
      expect(prerequisiteCandidates(context, 'A')).toHaveLength(
        status === 'PASSED' || status === 'EXEMPT' ? 1 : 0,
      );
    },
  );
  it('uses the source row minimum and preserves explicit zero', () => {
    const context = withRequisites(eligibilityFixture(), [
      ['A', 'B', 'PREREQUISITE', '0'],
    ]);
    const rows = new Map(
      context.rows.map((row) => [
        row.course.id,
        {
          ...row,
          minStudiedScore: new Prisma.Decimal(
            row.course.id === 'B' ? '2.5' : '4',
          ),
        },
      ]),
    );
    const edge = context.rows[0].requisites[0];
    expect(prerequisiteThreshold(edge, rows)?.toString()).toBe('0');
    expect(
      prerequisiteThreshold({ ...edge, minScore: null }, rows)?.toString(),
    ).toBe('2.5');
  });
  it('recognizes outside equivalents, prefers exact completion and ignores higher failed retakes', () => {
    const base = withAttempts(eligibilityFixture(), [
      attempt('A', 'PASSED', '2.5'),
      attempt('B', 'PASSED', '4'),
      attempt('A', 'FAILED', '4', 'failed'),
    ]);
    const context = {
      ...base,
      equivalents: new Map([['A', new Set(['A', 'B'])]]),
    };
    expect(completionEvidence(context, 'A')?.attempt.id).toBe('result-A');
    expect(
      prerequisiteCandidates(context, 'A').map((row) => row.attempt.id),
    ).toEqual(['result-B', 'result-A']);
  });
  it('uses only one-hop active replacement facts for discontinued prerequisites', () => {
    const base = withAttempts(eligibilityFixture(), [
      attempt('C', 'PASSED', '4'),
    ]);
    const courses = new Map(base.courses);
    courses.set('A', {
      ...courses.get('A')!,
      status: 'DISCONTINUED',
      activeReplacementIds: ['B'],
    });
    courses.set('B', {
      ...courses.get('B')!,
      status: 'DISCONTINUED',
      activeReplacementIds: ['C'],
    });
    expect(prerequisiteCandidates({ ...base, courses }, 'A')).toHaveLength(0);
  });
  it('admits every direct replacement and its equivalents only for a discontinued original', () => {
    const base = withAttempts(eligibilityFixture(['A', 'B', 'C', 'E']), [
      attempt('B', 'PASSED', '2.49'),
      attempt('E', 'PASSED', '2.5'),
    ]);
    const courses = new Map(base.courses);
    courses.set('A', {
      ...courses.get('A')!,
      status: 'DISCONTINUED',
      activeReplacementIds: ['B', 'C'],
    });
    const context = {
      ...base,
      courses,
      equivalents: new Map([...base.equivalents, ['C', new Set(['C', 'E'])]]),
    };
    expect(
      prerequisiteCandidates(context, 'A').map((row) => row.attempt.id),
    ).toEqual(['result-E', 'result-B']);
    courses.set('A', { ...courses.get('A')!, status: 'ACTIVE' });
    expect(prerequisiteCandidates(context, 'A')).toEqual([]);
  });
  it('keeps original evidence when no replacement exists and resolves score ties by date/code/id', () => {
    const first = attempt('A', 'PASSED', '2.5', 'result-a');
    const later = {
      ...attempt('A', 'PASSED', '2.5', 'result-b'),
      semesterStart: new Date('2026-02-01'),
    };
    const base = withAttempts(eligibilityFixture(), [
      first,
      later,
      { ...later, id: 'result-c' },
    ]);
    const courses = new Map(base.courses);
    courses.set('A', { ...courses.get('A')!, status: 'DISCONTINUED' });
    expect(
      prerequisiteCandidates({ ...base, courses }, 'A').map(
        (row) => row.attempt.id,
      ),
    ).toEqual(['result-b', 'result-c', 'result-a']);
  });
});
