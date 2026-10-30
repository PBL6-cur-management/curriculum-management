import { describe, expect, it } from 'vitest';
import {
  AccessContext,
  type ActiveAssignment,
  type PermissionGrant,
} from '../authz/access-context.js';
import { PERMISSIONS, type PermissionCode } from '../authz/permission-codes.js';
import { AppException } from '../exception/app.exception.js';
import { COMMON_ERRORS } from '../exception/error-codes.js';
import { assertStudentProgramRead } from '../students/student-access.js';
import { STUDENT_ERRORS } from '../students/student.errors.js';
import {
  assertGraduationRead,
  assertGraduationWrite,
  graduationStaffScope,
} from './graduation-access.js';
import { GRADUATION_ERRORS } from './graduation.errors.js';

const target = { programIds: ['program-a'], studentIds: ['student-a'] };

function assignment(
  roleCode: string,
  permissions: PermissionCode[] = [
    PERMISSIONS.GRADUATION_VIEW,
    PERMISSIONS.GRADUATION_AUDIT,
  ],
  options: {
    programIds?: string[];
    studentIds?: string[];
    all?: boolean;
    mode?: PermissionGrant['mode'];
    grantScope?: PermissionGrant['scope'];
  } = {},
): ActiveAssignment {
  return {
    assignmentId: `${roleCode}-assignment`,
    roleId: roleCode,
    roleCode,
    roleName: roleCode,
    scopeSource: 'NONE',
    scopeType: 'SYSTEM',
    scopeUnit: null,
    scope: options.all
      ? { all: true }
      : {
          all: false,
          orgUnitIds: new Set(),
          subjectGroupIds: new Set(),
          programIds: new Set(options.programIds ?? ['program-a']),
          studentIds: new Set(options.studentIds ?? ['student-a']),
        },
    permissions: new Map(
      permissions.map((code) => [
        code,
        {
          mode: options.mode ?? 'DIRECT',
          scope: options.grantScope ?? 'SCOPED',
        },
      ]),
    ),
  };
}

function expectCode(run: () => unknown, code: string): void {
  expect(run).toThrow(AppException);
  try {
    run();
  } catch (error) {
    expect(error).toMatchObject({ code });
  }
}

describe('graduation assignment-bound authorization', () => {
  it('allows an R1 direct all-scope grant for read, write and staff population', () => {
    const access = new AccessContext('office', [
      assignment('R1', undefined, { grantScope: 'ALL', programIds: [] }),
    ]);
    expect(() => assertGraduationRead(access, target)).not.toThrow();
    expect(() => assertGraduationWrite(access, target)).not.toThrow();
    expect(graduationStaffScope(access)).toEqual({ all: true });
    expect(graduationStaffScope(access, true)).toEqual({ all: true });
  });

  it('does not combine an unprivileged office role with another role grant', () => {
    const access = new AccessContext('mixed', [
      assignment('R1', []),
      assignment('R5', undefined, { all: true, grantScope: 'ALL' }),
    ]);
    expectCode(
      () => assertGraduationRead(access, target),
      GRADUATION_ERRORS.ACCESS_REVOKED.code,
    );
    expectCode(
      () => assertGraduationWrite(access, target),
      GRADUATION_ERRORS.ACCESS_REVOKED.code,
    );
    expectCode(
      () => graduationStaffScope(access),
      COMMON_ERRORS.PERMISSION_DENIED.code,
    );
  });

  it('does not borrow a program scope from another assignment', () => {
    const access = new AccessContext('director', [
      assignment('R3', undefined, { programIds: ['program-b'] }),
      assignment('R3', [], { programIds: ['program-a'] }),
    ]);
    expectCode(
      () => assertGraduationRead(access, target),
      GRADUATION_ERRORS.ACCESS_REVOKED.code,
    );
    expectCode(
      () => assertGraduationWrite(access, target),
      GRADUATION_ERRORS.ACCESS_REVOKED.code,
    );
    expect(graduationStaffScope(access)).toEqual({
      all: false,
      programIds: ['program-b'],
    });
  });

  it('allows a director only inside a granted program', () => {
    const access = new AccessContext('director', [assignment('R3')]);
    expect(() => assertGraduationRead(access, target)).not.toThrow();
    expect(() => assertGraduationWrite(access, target)).not.toThrow();
    const foreign = { programIds: ['program-b'], studentIds: ['student-a'] };
    expectCode(
      () => assertGraduationRead(access, foreign),
      GRADUATION_ERRORS.ACCESS_REVOKED.code,
    );
    expectCode(
      () => assertGraduationWrite(access, foreign),
      GRADUATION_ERRORS.ACCESS_REVOKED.code,
    );
  });

  it('collects only eligible staff assignments in sorted deduplicated scope', () => {
    const access = new AccessContext('director', [
      assignment('R3', undefined, { programIds: ['program-c', 'program-a'] }),
      assignment('R3', undefined, { programIds: ['program-b', 'program-a'] }),
      assignment('R5', undefined, { programIds: ['forbidden'] }),
      assignment('R3', [], { programIds: ['ungranted'] }),
    ]);
    expect(graduationStaffScope(access)).toEqual({
      all: false,
      programIds: ['program-a', 'program-b', 'program-c'],
    });
    expect(graduationStaffScope(access, true)).toEqual({
      all: false,
      programIds: ['program-a', 'program-b', 'program-c'],
    });
  });

  it('requires DIRECT for writes and the writable staff population', () => {
    const access = new AccessContext('director', [
      assignment('R3', undefined, { mode: 'VIA_REQUEST' }),
    ]);
    expect(() => assertGraduationRead(access, target)).not.toThrow();
    expectCode(
      () => assertGraduationWrite(access, target),
      GRADUATION_ERRORS.ACCESS_REVOKED.code,
    );
    expectCode(
      () => graduationStaffScope(access, true),
      COMMON_ERRORS.PERMISSION_DENIED.code,
    );
  });

  it('does not treat audit permission as the view permission or vice versa', () => {
    const auditor = new AccessContext('office', [
      assignment('R1', [PERMISSIONS.GRADUATION_AUDIT], { all: true }),
    ]);
    const viewer = new AccessContext('office', [
      assignment('R1', [PERMISSIONS.GRADUATION_VIEW], { all: true }),
    ]);
    expectCode(
      () => assertGraduationRead(auditor, target),
      COMMON_ERRORS.PERMISSION_DENIED.code,
    );
    expectCode(
      () => assertGraduationWrite(viewer, target),
      COMMON_ERRORS.PERMISSION_DENIED.code,
    );
  });

  it.each(['R2', 'R4', 'R5'])(
    'rejects unsupported role %s even with an all-scope grant',
    (roleCode) => {
      const access = new AccessContext('unsupported', [
        assignment(roleCode, undefined, { all: true, grantScope: 'ALL' }),
      ]);
      expectCode(
        () => assertGraduationRead(access, target),
        GRADUATION_ERRORS.ACCESS_REVOKED.code,
      );
      expectCode(
        () => assertGraduationWrite(access, target),
        GRADUATION_ERRORS.ACCESS_REVOKED.code,
      );
      expectCode(
        () => graduationStaffScope(access),
        COMMON_ERRORS.PERMISSION_DENIED.code,
      );
    },
  );

  it('rejects callers with no graduation grant', () => {
    const access = new AccessContext('ungranted', [
      assignment('R1', [], { all: true }),
    ]);
    expectCode(
      () => assertGraduationRead(access, target),
      COMMON_ERRORS.PERMISSION_DENIED.code,
    );
    expectCode(
      () => assertGraduationWrite(access, target),
      COMMON_ERRORS.PERMISSION_DENIED.code,
    );
  });

  it('allows the scoped owning R6 read, but neither writes nor staff selectors', () => {
    const access = new AccessContext('student-user', [assignment('R6')]);
    expect(() => assertGraduationRead(access, target)).not.toThrow();
    expect(() =>
      assertStudentProgramRead(
        access,
        'GRADUATION',
        { id: 'student-a', userId: 'student-user' },
        'program-a',
      ),
    ).not.toThrow();
    expectCode(
      () => assertGraduationWrite(access, target),
      GRADUATION_ERRORS.ACCESS_REVOKED.code,
    );
    expectCode(
      () => graduationStaffScope(access),
      COMMON_ERRORS.PERMISSION_DENIED.code,
    );
  });

  it('rejects a foreign R6 target and an impersonated owner despite matching scoped IDs', () => {
    const access = new AccessContext('student-user', [assignment('R6')]);
    expectCode(
      () =>
        assertGraduationRead(access, {
          programIds: ['program-a'],
          studentIds: ['student-b'],
        }),
      GRADUATION_ERRORS.ACCESS_REVOKED.code,
    );
    expectCode(
      () =>
        assertStudentProgramRead(
          access,
          'GRADUATION',
          { id: 'student-a', userId: 'another-user' },
          'program-a',
        ),
      STUDENT_ERRORS.STUDENT_NOT_FOUND.code,
    );
    expectCode(
      () =>
        assertStudentProgramRead(
          access,
          'GRADUATION',
          { id: 'student-a', userId: null },
          'program-a',
        ),
      STUDENT_ERRORS.STUDENT_NOT_FOUND.code,
    );
  });

  it('does not combine self ownership with a grant held by a different assignment', () => {
    const access = new AccessContext('student-user', [
      assignment('R6', []),
      assignment('R5'),
    ]);
    expectCode(
      () =>
        assertStudentProgramRead(
          access,
          'GRADUATION',
          { id: 'student-a', userId: 'student-user' },
          'program-a',
        ),
      STUDENT_ERRORS.STUDENT_NOT_FOUND.code,
    );
  });
});
