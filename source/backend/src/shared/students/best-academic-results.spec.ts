import {
  bestAcademicResults,
  type AcademicAttemptFact,
} from './best-academic-results.js';

function attempt(over: Partial<AcademicAttemptFact>): AcademicAttemptFact {
  return {
    id: 'a1',
    studentId: 's',
    courseId: 'c1',
    semesterId: 'sem1',
    semesterStart: new Date('2025-09-01'),
    score10: '8',
    score4: '3.5',
    letterGrade: 'B+',
    status: 'PASSED',
    dataSource: 'EXCEL',
    revision: 1,
    ...over,
  };
}

const UNSCORED = { score4: null, score10: null, letterGrade: null } as const;

describe('bestAcademicResults', () => {
  it('compares score4 as a number, not as text', () => {
    const [course] = bestAcademicResults([
      attempt({ id: 'a1', score4: '3.5' }),
      attempt({ id: 'a2', score4: '4', semesterStart: new Date('2026-02-01') }),
      attempt({
        id: 'a3',
        score4: '3.75',
        semesterStart: new Date('2026-09-01'),
      }),
    ]);
    expect(course!.bestScoredAttempt!.id).toBe('a2');
  });

  it('breaks a tie by the later semester, then the smaller id', () => {
    const later = bestAcademicResults([
      attempt({ id: 'a1' }),
      attempt({ id: 'a2', semesterStart: new Date('2026-02-01') }),
    ]);
    expect(later[0]!.bestScoredAttempt!.id).toBe('a2');
    const sameSemester = bestAcademicResults([
      attempt({ id: 'b' }),
      attempt({ id: 'a' }),
    ]);
    expect(sameSemester[0]!.bestScoredAttempt!.id).toBe('a');
  });

  it('keeps every attempt and reports exempt and in-progress independently', () => {
    const [course] = bestAcademicResults([
      attempt({ id: 'a1', status: 'FAILED', score4: '0.5' }),
      attempt({
        id: 'a2',
        status: 'EXEMPT',
        ...UNSCORED,
        semesterStart: new Date('2026-02-01'),
      }),
      attempt({
        id: 'a3',
        status: 'IN_PROGRESS',
        ...UNSCORED,
        semesterStart: new Date('2026-09-01'),
      }),
    ]);
    expect(course!.attempts.map((row) => row.id)).toEqual(['a1', 'a2', 'a3']);
    expect(course!.bestScoredAttempt!.id).toBe('a1');
    expect(course).toMatchObject({
      hasPassedAttempt: false,
      isExempt: true,
      hasInProgressAttempt: true,
    });
  });

  it('has no best attempt when nothing is scored, and orders courses by id', () => {
    const result = bestAcademicResults([
      attempt({ courseId: 'c2', status: 'EXEMPT', ...UNSCORED }),
      attempt({ id: 'a2', courseId: 'c1', status: 'IN_PROGRESS', ...UNSCORED }),
    ]);
    expect(result.map((row) => row.courseId)).toEqual(['c1', 'c2']);
    expect(result.every((row) => row.bestScoredAttempt === null)).toBe(true);
  });
});
