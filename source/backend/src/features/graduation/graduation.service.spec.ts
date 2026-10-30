import { describe, expect, it, vi } from 'vitest';
import {
  AccessContext,
  type ActiveAssignment,
} from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { GraduationService } from './graduation.service.js';
import { GRADUATION_ERRORS } from '../../shared/graduation/graduation.errors.js';
import { GraduationAuditWriter } from '../../shared/graduation/graduation-audit.writer.js';
import {
  decodeGraduationResult,
  encodeGraduationResult,
} from '../../shared/graduation/graduation-result.codec.js';
import type { GraduationResult } from '../../shared/graduation/graduation.types.js';
import type { GraduationInputSnapshot } from '../../shared/graduation/graduation-input.types.js';

function access(roleCode = 'R1') {
  return new AccessContext('reviewer', [
    {
      assignmentId: null,
      roleId: roleCode,
      roleName: roleCode,
      scopeSource: 'NONE',
      scopeType: 'SYSTEM',
      scopeUnit: null,
      roleCode,
      scope: { all: true },
      permissions: new Map([
        [PERMISSIONS.GRADUATION_VIEW, { scope: 'ALL', mode: 'DIRECT' }],
        [PERMISSIONS.GRADUATION_AUDIT, { scope: 'ALL', mode: 'DIRECT' }],
      ]),
    } as ActiveAssignment,
  ]);
}
const lookup = {
  studentId: 'student',
  programId: 'program',
  semesterId: 'semester',
};
const result: GraduationResult = {
  schemaVersion: 1,
  ruleVersion: 'graduation-v1',
  evaluatedAt: '2026-10-30T00:00:00.000Z',
  context: {
    ...lookup,
    enrollmentId: 'enrollment',
    studentCode: 'SYN001',
    fullName: 'Sinh viên tổng hợp',
    programCode: 'SYN',
    programName: 'Chương trình tổng hợp',
    cohortId: 'cohort',
    cohortCode: 'SYN-C',
    programVersionId: 'version',
    versionNumber: '1.0',
    semesterCode: 'SYN-SEM',
    semesterStartDate: '2026-09-01',
    versionSource: 'COHORT',
    cohortAssignmentId: 'assignment',
  },
  conclusion: 'ELIGIBLE',
  shortfalls: [],
  warnings: [],
  credits: {
    requiredTotal: '3.125',
    recognizedTotal: '3.125',
    missingTotal: '0',
    compulsory: '3.125',
    elective: '0',
    free: '0',
  },
  electiveGroups: [],
  knowledgeBlocks: [],
  recognitions: [],
  freeCredits: [],
};
const input: GraduationInputSnapshot = {
  schemaVersion: 1,
  ruleVersion: 'graduation-v1',
  context: result.context,
  version: {
    totalCredits: '3.125',
    compulsoryCredits: '3.125',
    electiveCredits: '0',
  },
  frame: [
    {
      id: 'item',
      course: { id: 'course', courseCode: 'SYN101', courseName: 'Tổng hợp' },
      credits: '3.125',
      courseType: 'THEORY',
      isElective: false,
      electiveGroupId: null,
      blockSymbol: null,
      plannedSemester: 1,
      sortOrder: 1,
    },
  ],
  groups: [],
  blocks: [],
  courses: [
    {
      course: { id: 'course', courseCode: 'SYN101', courseName: 'Tổng hợp' },
      courseType: 'THEORY',
      credits: '3.125',
      creditBasis: 'APPLIED_VERSION_SNAPSHOT',
      equivalenceGroupId: null,
    },
  ],
  attempts: [],
};

function service() {
  const tx = {};
  const prisma = {
    $transaction: vi.fn(async (work: (db: unknown) => unknown) => work(tx)),
  };
  const evaluator = {
    evaluate: vi.fn().mockResolvedValue({ input, result, digest: 'digest' }),
  };
  const writer = {
    append: vi
      .fn<
        (tx: unknown, command: { operationKey: string }) => Promise<unknown>
      >()
      .mockResolvedValue({ id: 'audit', result }),
  };
  return {
    tx,
    prisma,
    evaluator,
    writer,
    service: new GraduationService(
      prisma as never,
      {} as never,
      {} as never,
      evaluator as never,
      writer as never,
    ),
  };
}

describe('graduation live and saves', () => {
  it('evaluates live without creating an audit', async () => {
    const fixture = service();
    expect(await fixture.service.live(access(), lookup)).toEqual({
      status: 'REVIEWED',
      result,
      error: null,
    });
    expect(fixture.writer.append).not.toHaveBeenCalled();
    expect(fixture.evaluator.evaluate).toHaveBeenCalledTimes(1);
  });
  it('returns a diagnostic, not NOT_ELIGIBLE, for unevaluable input', async () => {
    const fixture = service();
    fixture.evaluator.evaluate.mockRejectedValue(
      new AppException(GRADUATION_ERRORS.SNAPSHOT_INCOMPLETE),
    );
    expect(await fixture.service.live(access(), lookup)).toEqual({
      status: 'CANNOT_AUDIT',
      result: null,
      error: {
        code: GRADUATION_ERRORS.SNAPSHOT_INCOMPLETE.code,
        message: GRADUATION_ERRORS.SNAPSHOT_INCOMPLETE.message,
        enrollmentId: null,
      },
    });
    expect(fixture.writer.append).not.toHaveBeenCalled();
  });
  it('does not convert authorization errors to successful diagnostics', async () => {
    const fixture = service();
    fixture.evaluator.evaluate.mockRejectedValue(
      new AppException(GRADUATION_ERRORS.ACCESS_REVOKED),
    );
    await expect(fixture.service.live(access(), lookup)).rejects.toMatchObject({
      code: GRADUATION_ERRORS.ACCESS_REVOKED.code,
    });
  });
  it('uses stable actor/request idempotency keys and preserves distinct clicks', async () => {
    const fixture = service();
    await fixture.service.save(access(), lookup, 'click-one');
    await fixture.service.save(access(), lookup, 'click-one');
    await fixture.service.save(access(), lookup, 'click-two');
    const commands = fixture.writer.append.mock.calls.map((call) => call[1]);
    expect(commands[0].operationKey).toBe(commands[1].operationKey);
    expect(commands[0].operationKey).not.toBe(commands[2].operationKey);
    expect(commands[0]).toMatchObject({
      lookup,
      actorId: 'reviewer',
      trigger: 'STAFF',
    });
  });
  it('refuses R6 persistence before starting a transaction', async () => {
    const fixture = service();
    await expect(
      fixture.service.save(access('R6'), lookup, 'click'),
    ).rejects.toBeInstanceOf(AppException);
    expect(fixture.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('graduation result codec', () => {
  it('rejects repeated equivalence classes and retakes disguised as free credits', () => {
    const course = {
      id: 'course',
      courseCode: 'SYN101',
      courseName: 'Tổng hợp',
    };
    const recognition: GraduationResult['recognitions'][number] = {
      curriculumItemId: 'item',
      requiredCourse: course,
      studiedCourse: course,
      attemptId: 'attempt',
      attemptRevision: 1,
      completionStatus: 'PASSED',
      viaEquivalence: false,
      equivalenceGroupId: 'equivalence',
      requiredCredits: '3.125',
      recognizedCredits: '3.125',
      creditBasis: 'APPLIED_VERSION_SNAPSHOT',
      category: 'MANDATORY_COURSE',
      electiveGroupId: null,
      blockSymbol: null,
    };
    expect(() =>
      encodeGraduationResult({ ...result, recognitions: [recognition] }),
    ).not.toThrow();
    const otherCourse = { ...course, id: 'other' };
    expect(() =>
      encodeGraduationResult({
        ...result,
        recognitions: [
          recognition,
          {
            ...recognition,
            curriculumItemId: 'item-other',
            attemptId: 'attempt-other',
            requiredCourse: otherCourse,
            studiedCourse: otherCourse,
          },
        ],
      }),
    ).toThrow(GRADUATION_ERRORS.INPUT_INVALID.message);
    expect(() =>
      encodeGraduationResult({
        ...result,
        recognitions: [recognition],
        freeCredits: [
          {
            course,
            attemptId: 'retake',
            credits: '3.125',
            creditBasis: 'APPLIED_VERSION_SNAPSHOT',
            reason: 'SURPLUS_EQUIVALENT',
          },
        ],
      }),
    ).toThrow(GRADUATION_ERRORS.INPUT_INVALID.message);
  });

  it('round trips exact decimal strings and nulls', () => {
    expect(
      decodeGraduationResult(encodeGraduationResult(result) as never),
    ).toEqual(result);
  });
  it.each([
    { ...result, schemaVersion: 2 },
    { ...result, ruleVersion: 'future' },
  ])(
    'rejects unknown stored schema/rules rather than reevaluating history',
    (value) => {
      expect(() => decodeGraduationResult(value as never)).toThrow(
        GRADUATION_ERRORS.UNSUPPORTED_SCHEMA_VERSION.message,
      );
    },
  );
  it.each([
    { ...result, shortfalls: null },
    { ...result, conclusion: 'NOT_ELIGIBLE' },
    { ...result, credits: { ...result.credits, recognizedTotal: 3.125 } },
    { ...result, credits: { ...result.credits, missingTotal: '-1' } },
    {
      ...result,
      shortfalls: [
        { code: 'MANDATORY_COURSE_MISSING', category: 'CONDITIONAL_COURSE' },
      ],
    },
  ])('rejects malformed stored academic results', (value) => {
    expect(() => decodeGraduationResult(value as never)).toThrow(
      GRADUATION_ERRORS.INPUT_INVALID.message,
    );
  });
});

describe('graduation audit writer', () => {
  it('does not append or advance a head when evaluation fails', async () => {
    const evaluator = {
      evaluate: vi
        .fn()
        .mockRejectedValue(new AppException(GRADUATION_ERRORS.INPUT_INVALID)),
    };
    const tx = {
      $queryRaw: vi.fn(),
      graduationAudit: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      graduationAuditContext: { upsert: vi.fn(), update: vi.fn() },
    };
    const writer = new GraduationAuditWriter(evaluator as never);
    await expect(
      writer.append(tx as never, {
        lookup,
        capability: {} as never,
        trigger: 'STAFF',
        actorId: 'reviewer',
        operationKey: 'key',
      }),
    ).rejects.toBeInstanceOf(AppException);
    expect(tx.graduationAudit.create).not.toHaveBeenCalled();
    expect(tx.graduationAuditContext.update).not.toHaveBeenCalled();
  });
  it('refuses same-key reuse for a different context before evaluating', async () => {
    const evaluator = { evaluate: vi.fn() };
    const tx = {
      graduationAudit: {
        findUnique: vi.fn().mockResolvedValue({
          trigger: 'STAFF',
          auditedById: 'reviewer',
          context: { ...lookup, programId: 'other' },
        }),
      },
    };
    await expect(
      new GraduationAuditWriter(evaluator as never).append(tx as never, {
        lookup,
        capability: {} as never,
        trigger: 'STAFF',
        actorId: 'reviewer',
        operationKey: 'key',
      }),
    ).rejects.toMatchObject({ code: GRADUATION_ERRORS.STATE_CHANGED.code });
    expect(evaluator.evaluate).not.toHaveBeenCalled();
  });
});
