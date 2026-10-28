import { describe, expect, it } from 'vitest';
import {
  AccessContext,
  type ActiveAssignment,
} from '../authz/access-context.js';
import { PERMISSIONS } from '../authz/permission-codes.js';
import { STUDENT_ERRORS } from './student.errors.js';
import {
  assertStudentEnrollmentWrite,
  assertStudentImport,
  assertStudentProgramRead,
  holdsStudentEnrollmentWrite,
  staffStudentScope,
  studentReadWhere,
} from './student-access.js';

function assignment(
  roleCode: string,
  grants: [string, 'DIRECT' | 'VIA_REQUEST', 'ALL' | 'IN_SCOPE'][],
  scope: { programIds?: string[]; studentIds?: string[]; all?: boolean } = {},
): ActiveAssignment {
  return {
    assignmentId: null,
    roleId: roleCode,
    roleCode,
    roleName: roleCode,
    scopeSource: 'NONE',
    scopeType: 'SYSTEM',
    scopeUnit: null,
    scope: scope.all
      ? { all: true }
      : {
          all: false,
          orgUnitIds: new Set(),
          subjectGroupIds: new Set(),
          programIds: new Set(scope.programIds ?? []),
          studentIds: new Set(scope.studentIds ?? []),
        },
    permissions: new Map(
      grants.map(([code, mode, grantScope]) => [
        code as never,
        { mode, scope: grantScope },
      ]),
    ),
  } as ActiveAssignment;
}

const office = assignment('R1', [
  [PERMISSIONS.DATA_IMPORT_EXCEL, 'DIRECT', 'ALL'],
  [PERMISSIONS.VERSION_ASSIGN_COHORT, 'DIRECT', 'ALL'],
  [PERMISSIONS.STUDENT_VIEW_PROGRESS, 'DIRECT', 'ALL'],
]);
const director = assignment(
  'R3',
  [[PERMISSIONS.STUDENT_VIEW_PROGRESS, 'DIRECT', 'IN_SCOPE']],
  { programIds: ['p1'] },
);
const self = assignment(
  'R6',
  [[PERMISSIONS.STUDENT_VIEW_PROGRESS, 'DIRECT', 'IN_SCOPE']],
  { studentIds: ['s1'] },
);

describe('student import and enrollment writes', () => {
  it('require the office role to hold the grant itself', () => {
    expect(() =>
      assertStudentImport(new AccessContext('u', [office])),
    ).not.toThrow();
    expect(() =>
      assertStudentEnrollmentWrite(new AccessContext('u', [office])),
    ).not.toThrow();
  });

  it('refuse a broad grant held through a different role', () => {
    const other = assignment('R2', [
      [PERMISSIONS.DATA_IMPORT_EXCEL, 'DIRECT', 'ALL'],
    ]);
    expect(() =>
      assertStudentImport(new AccessContext('u', [other])),
    ).toThrow();
  });

  it('refuse the office role without a direct grant', () => {
    const viaRequest = assignment('R1', [
      [PERMISSIONS.DATA_IMPORT_EXCEL, 'VIA_REQUEST', 'ALL'],
    ]);
    expect(() =>
      assertStudentImport(new AccessContext('u', [viaRequest])),
    ).toThrow();
  });
});

describe('studentReadWhere', () => {
  it('leaves the office unrestricted when no program is asked for', () => {
    expect(
      studentReadWhere(new AccessContext('u', [office]), 'PROGRESS', undefined),
    ).toEqual({});
  });

  it('limits a director to directed programs', () => {
    const where = studentReadWhere(
      new AccessContext('d', [director]),
      'PROGRESS',
      undefined,
    );
    expect(JSON.stringify(where)).toContain('"in":["p1"]');
  });

  it('limits a student to their own account', () => {
    expect(
      studentReadWhere(
        new AccessContext('acct', [self]),
        'PROGRESS',
        undefined,
      ),
    ).toEqual({
      OR: [{ userId: 'acct' }],
    });
  });

  it('matches nobody when the purpose permission is missing', () => {
    expect(
      studentReadWhere(
        new AccessContext('acct', [self]),
        'GRADUATION',
        undefined,
      ),
    ).toEqual({
      id: { in: [] },
    });
  });
});

describe('assertStudentProgramRead', () => {
  const student = { id: 's1', userId: 'acct' };

  it('lets a student read only their own record', () => {
    expect(() =>
      assertStudentProgramRead(
        new AccessContext('acct', [self]),
        'PROGRESS',
        student,
        'p1',
      ),
    ).not.toThrow();
    expect(() =>
      assertStudentProgramRead(
        new AccessContext('other', [self]),
        'PROGRESS',
        student,
        'p1',
      ),
    ).toThrow(
      expect.objectContaining({
        message: STUDENT_ERRORS.STUDENT_NOT_FOUND.message,
      }),
    );
  });

  it('denies a director another program', () => {
    const access = new AccessContext('d', [director]);
    expect(() =>
      assertStudentProgramRead(access, 'PROGRESS', student, 'p1'),
    ).not.toThrow();
    expect(() =>
      assertStudentProgramRead(access, 'PROGRESS', student, 'p2'),
    ).toThrow();
  });
});

describe('staffStudentScope', () => {
  it('gives the office every student', () => {
    expect(staffStudentScope(new AccessContext('u', [office]))).toEqual({
      all: true,
    });
  });

  it('collects the programs of every directed assignment', () => {
    const second = assignment(
      'R3',
      [[PERMISSIONS.STUDENT_VIEW_PROGRESS, 'DIRECT', 'IN_SCOPE']],
      { programIds: ['p2'] },
    );
    const scope = staffStudentScope(new AccessContext('d', [director, second]));
    expect(scope).toEqual({ all: false, programIds: new Set(['p1', 'p2']) });
  });

  it('treats a director scoped to everything as unrestricted', () => {
    const everyone = assignment(
      'R3',
      [[PERMISSIONS.STUDENT_VIEW_PROGRESS, 'DIRECT', 'ALL']],
      { all: true },
    );
    expect(staffStudentScope(new AccessContext('d', [everyone]))).toEqual({
      all: true,
    });
  });

  it('refuses a student-only caller before any query', () => {
    expect(() =>
      staffStudentScope(new AccessContext('acct', [self])),
    ).toThrow();
  });

  it('refuses staff without the purpose permission', () => {
    expect(() =>
      staffStudentScope(new AccessContext('d', [director]), 'GRADUATION'),
    ).toThrow();
  });
});

describe('holdsStudentEnrollmentWrite', () => {
  it('is true only for the office role with the direct unrestricted grant', () => {
    expect(holdsStudentEnrollmentWrite(new AccessContext('u', [office]))).toBe(
      true,
    );
    expect(
      holdsStudentEnrollmentWrite(new AccessContext('d', [director])),
    ).toBe(false);
    const viaRequest = assignment('R1', [
      [PERMISSIONS.VERSION_ASSIGN_COHORT, 'VIA_REQUEST', 'ALL'],
    ]);
    expect(
      holdsStudentEnrollmentWrite(new AccessContext('u', [viaRequest])),
    ).toBe(false);
  });
});
