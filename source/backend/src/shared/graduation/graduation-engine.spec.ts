import { describe, expect, it } from 'vitest';
import type {
  GraduationFrameFact,
  GraduationInputSnapshot,
} from './graduation-input.types.js';
import { evaluateGraduation } from './graduation-engine.js';

const NOW = '2026-10-30T00:00:00.000Z';

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
    blocks: [{ blockCode: 'CORE', blockName: 'Cơ sở', requiredCredits: '100' }],
    courses: [],
    attempts: [],
  };
}

function addCourse(
  input: GraduationInputSnapshot,
  id: string,
  credits = '3',
  frame = true,
  group: string | null = null,
): GraduationFrameFact | null {
  const course = { id, courseCode: `SYN-${id}`, courseName: `Học phần ${id}` };
  input.courses.push({
    course,
    courseType: 'THEORY',
    credits,
    creditBasis: frame ? 'APPLIED_VERSION_SNAPSHOT' : 'CURRENT_CATALOG',
    equivalenceGroupId: group,
  });
  if (!frame) return null;
  const row: GraduationFrameFact = {
    id: `row-${id}`,
    course,
    credits,
    courseType: 'THEORY',
    isElective: false,
    electiveGroupId: null,
    blockSymbol: 'CORE',
    plannedSemester: 1,
    sortOrder: 0,
  };
  input.frame.push(row);
  return row;
}

function attempt(
  input: GraduationInputSnapshot,
  courseId: string,
  status: GraduationInputSnapshot['attempts'][number]['status'] = 'PASSED',
  id = courseId,
  score4 = '3',
): void {
  const scored = status === 'PASSED' || status === 'FAILED';
  input.attempts.push({
    id,
    revision: 1,
    courseId,
    semesterId: `semester-${id}`,
    semesterStartDate: '2026-01-01T00:00:00.000Z',
    dataSource: 'EXCEL',
    score10: scored ? '8' : null,
    score4: scored ? score4 : null,
    letterGrade: scored ? 'B' : null,
    status,
  });
}

describe('evaluateGraduation', () => {
  it('orders the four checks and course shortfalls by frame chronology rather than IDs', () => {
    const input = fixture();
    addCourse(input, 'a')!.plannedSemester = 2;
    addCourse(input, 'z')!.plannedSemester = 1;
    const condition = addCourse(input, 'condition', '0')!;
    condition.courseType = 'CONDITIONAL';
    input.courses.find(
      (course) => course.course.id === 'condition',
    )!.courseType = 'CONDITIONAL';
    input.groups.push({
      id: 'group',
      groupCode: 'G',
      groupName: 'Nhóm',
      minCredits: '3',
      minCourses: 1,
    });
    const result = evaluateGraduation(input, NOW);
    expect(result.shortfalls.map((shortfall) => shortfall.code)).toEqual([
      'MANDATORY_COURSE_MISSING',
      'MANDATORY_COURSE_MISSING',
      'ELECTIVE_COURSES_MISSING',
      'ELECTIVE_CREDITS_MISSING',
      'TOTAL_CREDITS_MISSING',
      'CONDITIONAL_COURSE_MISSING',
    ]);
    expect(result.shortfalls.slice(0, 2)).toEqual([
      expect.objectContaining({ curriculumItemId: 'row-z' }),
      expect.objectContaining({ curriculumItemId: 'row-a' }),
    ]);
  });

  it('is eligible iff shortfalls are empty; catalog block gaps remain advisory', () => {
    const input = fixture();
    addCourse(input, 'a');
    attempt(input, 'a');
    const before = structuredClone(input);
    const result = evaluateGraduation(input, NOW);
    expect(result.conclusion).toBe('ELIGIBLE');
    expect(result.shortfalls).toEqual([]);
    expect(result.credits).toEqual({
      requiredTotal: '3',
      recognizedTotal: '3',
      missingTotal: '0',
      compulsory: '3',
      elective: '0',
      free: '0',
    });
    expect(result.knowledgeBlocks[0]).toMatchObject({ advisoryGap: '97' });
    expect(result.evaluatedAt).toBe(NOW);
    expect(input).toEqual(before);
  });

  it.each(['NOT_TAKEN', 'FAILED', 'IN_PROGRESS'] as const)(
    'explains missing mandatory completion: %s',
    (reason) => {
      const input = fixture();
      addCourse(input, 'a');
      if (reason !== 'NOT_TAKEN') attempt(input, 'a', reason);
      const result = evaluateGraduation(input, NOW);
      expect(result.conclusion).toBe('NOT_ELIGIBLE');
      expect(result.shortfalls).toContainEqual(
        expect.objectContaining({ code: 'MANDATORY_COURSE_MISSING', reason }),
      );
      expect(result.credits.recognizedTotal).toBe('0');
    },
  );

  it('retains a lower-scored PASSED despite a higher-scored FAILED retake', () => {
    const input = fixture();
    addCourse(input, 'a');
    attempt(input, 'a', 'PASSED', 'pass', '1');
    attempt(input, 'a', 'FAILED', 'fail', '4');
    const result = evaluateGraduation(input, NOW);
    expect(result.conclusion).toBe('ELIGIBLE');
    expect(result.recognitions[0]?.attemptId).toBe('pass');
    expect(result.freeCredits).toEqual([]);
  });

  it.each([false, true])(
    'requires zero-credit rows without double-reporting conditional=%s',
    (conditional) => {
      const input = fixture();
      input.version.totalCredits = '0';
      const row = addCourse(input, 'condition', '0')!;
      if (conditional) {
        row.courseType = 'CONDITIONAL';
        input.courses[0]!.courseType = 'CONDITIONAL';
      }
      const result = evaluateGraduation(input, NOW);
      expect(result.shortfalls).toHaveLength(1);
      expect(result.shortfalls[0]?.code).toBe(
        conditional ? 'CONDITIONAL_COURSE_MISSING' : 'MANDATORY_COURSE_MISSING',
      );
      attempt(input, 'condition');
      expect(evaluateGraduation(input, NOW).conclusion).toBe('ELIGIBLE');
    },
  );

  it.each(['118', '117'])(
    'separates equivalent completion from global credit arithmetic with other=%s',
    (otherCredits) => {
      const input = fixture();
      input.version.totalCredits = '120';
      addCourse(input, 'required', '3', true, 'eq');
      addCourse(input, 'old', '2', false, 'eq');
      addCourse(input, 'other', otherCredits);
      attempt(input, 'old');
      attempt(input, 'other');
      const result = evaluateGraduation(input, NOW);
      expect(result.recognitions).toContainEqual(
        expect.objectContaining({
          requiredCourse: expect.objectContaining({ id: 'required' }),
          recognizedCredits: '2',
        }),
      );
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'EQUIVALENT_CREDIT_GAP',
          creditGap: '1',
        }),
      );
      expect(
        result.shortfalls.some(
          (row) => row.code === 'MANDATORY_COURSE_MISSING',
        ),
      ).toBe(false);
      expect(result.credits.recognizedTotal).toBe(
        otherCredits === '118' ? '120' : '119',
      );
      expect(result.credits.missingTotal).toBe(
        otherCredits === '118' ? '0' : '1',
      );
      expect(result.conclusion).toBe(
        otherCredits === '118' ? 'ELIGIBLE' : 'NOT_ELIGIBLE',
      );
    },
  );

  it('enforces group credit and class-count minima independently; free credits do not fill either', () => {
    const input = fixture();
    input.version.totalCredits = '0';
    input.groups.push({
      id: 'group',
      groupCode: 'G',
      groupName: 'Nhóm',
      minCredits: '3',
      minCourses: 2,
    });
    for (const id of ['a', 'b'])
      Object.assign(addCourse(input, id, '2.5')!, {
        isElective: true,
        electiveGroupId: 'group',
      });
    addCourse(input, 'outside', '100', false);
    attempt(input, 'a');
    attempt(input, 'outside');
    const result = evaluateGraduation(input, NOW);
    expect(result.shortfalls).toHaveLength(2);
    expect(result.shortfalls).toContainEqual(
      expect.objectContaining({
        code: 'ELECTIVE_CREDITS_MISSING',
        missingCredits: '0.5',
      }),
    );
    expect(result.shortfalls).toContainEqual(
      expect.objectContaining({
        code: 'ELECTIVE_COURSES_MISSING',
        missingCourses: 1,
      }),
    );
    expect(result.electiveGroups[0]).toMatchObject({
      earnedCredits: '2.5',
      earnedCourses: 1,
    });
    expect(result.credits).toMatchObject({
      recognizedTotal: '102.5',
      elective: '2.5',
      free: '100',
    });
  });

  it('supports count-only groups, empty positive groups and ungrouped electives', () => {
    const input = fixture();
    input.version.totalCredits = '0';
    Object.assign(addCourse(input, 'a', '0')!, {
      isElective: true,
      electiveGroupId: 'count',
    });
    Object.assign(addCourse(input, 'b', '0')!, { isElective: true });
    input.groups.push(
      {
        id: 'count',
        groupCode: 'C',
        groupName: 'Số môn',
        minCredits: null,
        minCourses: 1,
      },
      {
        id: 'empty',
        groupCode: 'E',
        groupName: 'Nhóm rỗng',
        minCredits: '1',
        minCourses: null,
      },
    );
    attempt(input, 'a');
    const result = evaluateGraduation(input, NOW);
    expect(
      result.electiveGroups.find((group) => group.groupId === 'count'),
    ).toMatchObject({ missingCredits: null, missingCourses: 0 });
    expect(result.shortfalls).toHaveLength(1);
    expect(result.shortfalls[0]).toMatchObject({
      code: 'ELECTIVE_CREDITS_MISSING',
      groupId: 'empty',
      missingCredits: '1',
    });
  });

  it('does not count equivalent elective members as independent classes', () => {
    const input = fixture();
    input.version.totalCredits = '0';
    input.groups.push({
      id: 'group',
      groupCode: 'G',
      groupName: 'Nhóm',
      minCredits: null,
      minCourses: 2,
    });
    for (const id of ['a', 'b']) {
      Object.assign(addCourse(input, id, '3', true, 'eq')!, {
        isElective: true,
        electiveGroupId: 'group',
      });
      attempt(input, id);
    }
    const result = evaluateGraduation(input, NOW);
    expect(result.electiveGroups[0]?.earnedCourses).toBe(1);
    expect(result.freeCredits).toHaveLength(1);
    expect(result.shortfalls[0]).toMatchObject({
      code: 'ELECTIVE_COURSES_MISSING',
      missingCourses: 1,
    });
  });

  it('adds decimal fractions exactly and keeps unknown/null block attribution', () => {
    const input = fixture();
    input.version.totalCredits = '0.3';
    addCourse(input, 'a', '0.1')!.blockSymbol = 'UNKNOWN';
    addCourse(input, 'b', '0.2')!.blockSymbol = null;
    attempt(input, 'a');
    attempt(input, 'b');
    const result = evaluateGraduation(input, NOW);
    expect(result.credits.recognizedTotal).toBe('0.3');
    expect(result.knowledgeBlocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blockSymbol: 'UNKNOWN',
          earnedCredits: '0.1',
        }),
        expect.objectContaining({ blockSymbol: null, earnedCredits: '0.2' }),
      ]),
    );
    expect(
      result.warnings.filter(
        (warning) => warning.code === 'UNKNOWN_KNOWLEDGE_BLOCK',
      ),
    ).toHaveLength(2);
    expect(result.conclusion).toBe('ELIGIBLE');
  });

  it.each([
    'mandatory',
    'group',
    'total',
    'same-class-total',
    'same-class-group',
  ])('diagnoses a necessary exemption: %s', (kind) => {
    const input = fixture();
    addCourse(input, 'a', '3', true, 'eq');
    if (kind === 'mandatory') attempt(input, 'a', 'EXEMPT');
    else {
      attempt(input, 'a');
      addCourse(
        input,
        'exempt',
        '3',
        false,
        kind.startsWith('same-class') ? 'eq' : null,
      );
      attempt(input, 'exempt', 'EXEMPT');
      if (kind.endsWith('group') || kind === 'group') {
        input.groups.push({
          id: 'group',
          groupCode: 'G',
          groupName: 'Nhóm',
          minCredits: '6',
          minCourses: null,
        });
        Object.assign(input.frame[0]!, {
          isElective: true,
          electiveGroupId: 'group',
        });
        if (kind === 'group') {
          const row = addCourse(input, 'required-exempt', '3', true, 'extra')!;
          Object.assign(row, { isElective: true, electiveGroupId: 'group' });
          input.courses.find(
            (course) => course.course.id === 'exempt',
          )!.equivalenceGroupId = 'extra';
        }
      } else input.version.totalCredits = '6';
    }
    expect(() => evaluateGraduation(input, NOW)).toThrow(
      expect.objectContaining({ code: 'EXEMPTION_POLICY_UNCONFIRMED' }),
    );
  });

  it('ignores unused exemptions when PASSED independently establishes that course', () => {
    const input = fixture();
    addCourse(input, 'a');
    attempt(input, 'a');
    attempt(input, 'a', 'EXEMPT', 'unused');
    input.version.totalCredits = '4';
    expect(evaluateGraduation(input, NOW).shortfalls).toEqual([
      expect.objectContaining({
        code: 'TOTAL_CREDITS_MISSING',
        missingCredits: '1',
      }),
    ]);
  });

  it('does not block on an irrelevant outside-frame exemption when all checks pass', () => {
    const input = fixture();
    addCourse(input, 'a');
    attempt(input, 'a');
    addCourse(input, 'exempt', '3', false);
    attempt(input, 'exempt', 'EXEMPT');
    expect(evaluateGraduation(input, NOW).conclusion).toBe('ELIGIBLE');
  });

  it('does not use an exempt equivalent course as a second group-count slot', () => {
    const input = fixture();
    addCourse(input, 'a', '3', true, 'eq');
    attempt(input, 'a');
    addCourse(input, 'exempt', '3', false, 'eq');
    attempt(input, 'exempt', 'EXEMPT');
    input.groups.push({
      id: 'group',
      groupCode: 'G',
      groupName: 'Nhóm',
      minCredits: null,
      minCourses: 2,
    });
    Object.assign(input.frame[0]!, {
      isElective: true,
      electiveGroupId: 'group',
    });
    expect(evaluateGraduation(input, NOW).shortfalls).toEqual([
      expect.objectContaining({
        code: 'ELECTIVE_COURSES_MISSING',
        missingCourses: 1,
      }),
    ]);
  });

  it('rejects conditional group membership instead of inventing institutional policy', () => {
    const input = fixture();
    addCourse(input, 'condition', '0');
    input.courses[0]!.courseType = 'CONDITIONAL';
    Object.assign(input.frame[0]!, {
      courseType: 'CONDITIONAL',
      isElective: true,
      electiveGroupId: 'group',
    });
    input.groups.push({
      id: 'group',
      groupCode: 'G',
      groupName: 'Nhóm',
      minCredits: null,
      minCourses: 1,
    });
    expect(() => evaluateGraduation(input, NOW)).toThrow(
      expect.objectContaining({ code: 'GRADUATION_POLICY_UNCONFIRMED' }),
    );
  });

  it('rejects scored results without authoritative scales and invalid evaluation timestamps', () => {
    const input = fixture();
    addCourse(input, 'a');
    attempt(input, 'a');
    input.attempts[0]!.score4 = null;
    expect(() => evaluateGraduation(input, NOW)).toThrow(
      expect.objectContaining({ code: 'GRADUATION_INPUT_INVALID' }),
    );
    input.attempts[0]!.score4 = '3';
    expect(() => evaluateGraduation(input, 'invalid')).toThrow(
      expect.objectContaining({ code: 'GRADUATION_INPUT_INVALID' }),
    );
  });

  it('is independent of input ordering with a fixed evaluation timestamp', () => {
    const input = fixture();
    addCourse(input, 'a', '1');
    addCourse(input, 'b', '2');
    attempt(input, 'a');
    attempt(input, 'b');
    const expected = evaluateGraduation(input, NOW);
    input.frame.reverse();
    input.courses.reverse();
    input.attempts.reverse();
    input.blocks.reverse();
    expect(evaluateGraduation(input, NOW)).toEqual(expected);
  });
});
