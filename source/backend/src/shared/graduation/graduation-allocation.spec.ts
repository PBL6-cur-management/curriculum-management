import { describe, expect, it } from 'vitest';
import { allocateGraduationCredits } from './graduation-allocation.js';
import type {
  GraduationFrameFact,
  GraduationInputSnapshot,
} from './graduation-input.types.js';

function fixture(): GraduationInputSnapshot {
  return {
    schemaVersion: 1,
    ruleVersion: 'graduation-v1',
    context: {
      studentId: 'student',
      programId: 'program',
      semesterId: 'semester',
      enrollmentId: 'enrollment',
      studentCode: 'SYN001',
      fullName: 'Sinh viên tổng hợp',
      programCode: 'SYN',
      programName: 'Chương trình tổng hợp',
      cohortId: 'cohort',
      cohortCode: 'SYN24',
      programVersionId: 'version',
      versionNumber: '1.0',
      semesterCode: '2026.1',
      semesterStartDate: '2026-09-01T00:00:00.000Z',
      versionSource: 'COHORT',
      cohortAssignmentId: 'assignment',
    },
    version: {
      totalCredits: '3',
      compulsoryCredits: '3',
      electiveCredits: '0',
    },
    frame: [],
    groups: [],
    blocks: [],
    courses: [],
    attempts: [],
  };
}

function course(
  input: GraduationInputSnapshot,
  id: string,
  credits = '3',
  inFrame = true,
  equivalenceGroupId: string | null = 'eq',
): GraduationFrameFact | null {
  const ref = { id, courseCode: id, courseName: `Học phần ${id}` };
  input.courses.push({
    course: ref,
    courseType: 'THEORY',
    credits,
    creditBasis: inFrame ? 'APPLIED_VERSION_SNAPSHOT' : 'CURRENT_CATALOG',
    equivalenceGroupId,
  });
  if (!inFrame) return null;
  const row: GraduationFrameFact = {
    id: `row-${id}`,
    course: ref,
    credits,
    courseType: 'THEORY',
    isElective: false,
    electiveGroupId: null,
    blockSymbol: null,
    plannedSemester: 1,
    sortOrder: 0,
  };
  input.frame.push(row);
  return row;
}

function pass(
  input: GraduationInputSnapshot,
  courseId: string,
  id = courseId,
  score4 = '3',
  start = '2026-01-01T00:00:00.000Z',
): void {
  input.attempts.push({
    id,
    revision: 2,
    courseId,
    semesterId: `semester-${id}`,
    semesterStartDate: start,
    dataSource: 'SCHOOL_DB',
    score10: '8',
    score4,
    letterGrade: 'B',
    status: 'PASSED',
  });
}

describe('allocateGraduationCredits', () => {
  it('recognizes any current group member transitively and retains provenance', () => {
    const input = fixture();
    course(input, 'required');
    course(input, 'middle', '3', false);
    course(input, 'old', '2', false);
    pass(input, 'old');
    const allocation = allocateGraduationCredits(input);
    expect(allocation.recognitions).toEqual([
      expect.objectContaining({
        curriculumItemId: 'row-required',
        studiedCourse: expect.objectContaining({ id: 'old' }),
        attemptId: 'old',
        attemptRevision: 2,
        viaEquivalence: true,
        equivalenceGroupId: 'eq',
        recognizedCredits: '2',
        requiredCredits: '3',
        creditBasis: 'CURRENT_CATALOG',
      }),
    ]);
    expect(allocation.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'EQUIVALENT_CREDIT_GAP',
          creditGap: '1',
        }),
        expect.objectContaining({
          code: 'CURRENT_CATALOG_CREDIT_BASIS',
          courseId: 'old',
        }),
      ]),
    );
  });

  it('prefers a direct completion and awards distinct equivalent surplus only once', () => {
    const input = fixture();
    course(input, 'Z-required');
    course(input, 'A-old', '5', false);
    pass(input, 'Z-required');
    pass(input, 'A-old');
    const allocation = allocateGraduationCredits(input);
    expect(allocation.recognitions[0]).toMatchObject({
      studiedCourse: { id: 'Z-required' },
      viaEquivalence: false,
      recognizedCredits: '3',
    });
    expect(allocation.freeCredits).toEqual([
      expect.objectContaining({
        course: expect.objectContaining({ id: 'A-old' }),
        credits: '5',
        reason: 'SURPLUS_EQUIVALENT',
      }),
    ]);
  });

  it('keeps higher-credit substitutions whole instead of splitting a second free entry', () => {
    const input = fixture();
    course(input, 'required', '2');
    course(input, 'old', '3.5', false);
    pass(input, 'old');
    const allocation = allocateGraduationCredits(input);
    expect(allocation.recognitions[0]?.recognizedCredits).toBe('3.5');
    expect(allocation.freeCredits).toEqual([]);
    expect(
      allocation.warnings.some(
        (warning) => warning.code === 'EQUIVALENT_CREDIT_GAP',
      ),
    ).toBe(false);
  });

  it('uses the shared PASSED score/later-semester/ID tie policy, never counting retakes as free', () => {
    const input = fixture();
    course(input, 'required');
    pass(input, 'required', 'lower', '2');
    pass(input, 'required', 'earlier', '3');
    pass(input, 'required', 'z-later', '3', '2026-05-01T00:00:00.000Z');
    pass(input, 'required', 'a-later', '3', '2026-05-01T00:00:00.000Z');
    const allocation = allocateGraduationCredits(input);
    expect(allocation.recognitions).toHaveLength(1);
    expect(allocation.recognitions[0]?.attemptId).toBe('a-later');
    expect(allocation.freeCredits).toEqual([]);
  });

  it('chooses course-code order only when substitute effects are identical', () => {
    const input = fixture();
    course(input, 'required');
    course(input, 'Z-old', '3', false);
    course(input, 'A-old', '3', false);
    pass(input, 'Z-old');
    pass(input, 'A-old');
    const allocation = allocateGraduationCredits(input);
    expect(allocation.recognitions[0]?.studiedCourse.id).toBe('A-old');
    expect(allocation.freeCredits[0]?.course.id).toBe('Z-old');
    const expected = structuredClone(allocation);
    input.courses.reverse();
    input.attempts.reverse();
    input.frame.reverse();
    expect(allocateGraduationCredits(input)).toEqual(expected);
  });

  it('rejects substitute choices that change category credit totals', () => {
    const input = fixture();
    course(input, 'required');
    course(input, 'old-a', '2', false);
    course(input, 'old-b', '3', false);
    pass(input, 'old-a');
    pass(input, 'old-b');
    expect(() => allocateGraduationCredits(input)).toThrow(
      expect.objectContaining({ code: 'EQUIVALENCE_ALLOCATION_AMBIGUOUS' }),
    );
  });

  it.each(['mandatory', 'different-groups', 'mandatory-group', 'conditional'])(
    'rejects competing independent requirements: %s',
    (kind) => {
      const input = fixture();
      const first = course(input, 'first')!;
      const second = course(input, 'second')!;
      if (kind === 'different-groups' || kind === 'mandatory-group') {
        input.groups.push(
          {
            id: 'g1',
            groupCode: 'G1',
            groupName: 'Nhóm 1',
            minCredits: '3',
            minCourses: null,
          },
          {
            id: 'g2',
            groupCode: 'G2',
            groupName: 'Nhóm 2',
            minCredits: '3',
            minCourses: null,
          },
        );
        if (kind === 'different-groups')
          Object.assign(first, { isElective: true, electiveGroupId: 'g1' });
        Object.assign(second, { isElective: true, electiveGroupId: 'g2' });
      }
      if (kind === 'conditional') {
        second.courseType = 'CONDITIONAL';
        input.courses[1]!.courseType = 'CONDITIONAL';
      }
      pass(input, 'first');
      expect(() => allocateGraduationCredits(input)).toThrow(
        expect.objectContaining({ code: 'EQUIVALENCE_ALLOCATION_AMBIGUOUS' }),
      );
    },
  );

  it('does not invent ambiguity when no class completion can be allocated', () => {
    const input = fixture();
    course(input, 'first');
    course(input, 'second');
    expect(allocateGraduationCredits(input).recognitions).toEqual([]);
  });

  it('allocates equivalent rows within one group to one count slot, with surplus separate', () => {
    const input = fixture();
    input.groups.push({
      id: 'group',
      groupCode: 'G',
      groupName: 'Nhóm',
      minCredits: '3',
      minCourses: 1,
    });
    for (const id of ['b', 'a']) {
      Object.assign(course(input, id)!, {
        isElective: true,
        electiveGroupId: 'group',
      });
      pass(input, id);
    }
    const allocation = allocateGraduationCredits(input);
    expect(allocation.recognitions).toHaveLength(1);
    expect(allocation.recognitions[0]).toMatchObject({
      curriculumItemId: 'row-a',
      category: 'ELECTIVE_GROUP',
      electiveGroupId: 'group',
    });
    expect(allocation.freeCredits).toHaveLength(1);
    const attemptIds = [
      ...allocation.recognitions.map((entry) => entry.attemptId),
      ...allocation.freeCredits.map((entry) => entry.attemptId),
    ];
    expect(new Set(attemptIds).size).toBe(attemptIds.length);
  });

  it('awards outside-frame courses once, including unrelated members of an outside equivalence class', () => {
    const input = fixture();
    course(input, 'required', '0', true, null);
    course(input, 'outside-a', '1.25', false, 'outside-eq');
    course(input, 'outside-b', '2.5', false, 'outside-eq');
    pass(input, 'outside-a', 'old-attempt');
    pass(input, 'outside-a', 'better-attempt', '4');
    pass(input, 'outside-b');
    const allocation = allocateGraduationCredits(input);
    expect(allocation.recognitions).toEqual([]);
    expect(allocation.freeCredits).toEqual([
      expect.objectContaining({
        course: expect.objectContaining({ id: 'outside-a' }),
        attemptId: 'better-attempt',
        credits: '1.25',
        reason: 'OUTSIDE_FRAME',
      }),
      expect.objectContaining({
        course: expect.objectContaining({ id: 'outside-b' }),
        credits: '2.5',
        reason: 'OUTSIDE_FRAME',
      }),
    ]);
  });

  it('does not mutate its input', () => {
    const input = fixture();
    course(input, 'required');
    pass(input, 'required');
    const before = structuredClone(input);
    allocateGraduationCredits(input);
    expect(input).toEqual(before);
  });
});
