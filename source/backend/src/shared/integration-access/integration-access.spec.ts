import {
  assertStudentProgramRead,
  readsWithoutEnrollment,
  studentReadWhere,
} from '../students/student-access.js';
import {
  assertGraduationRead,
  assertGraduationWrite,
} from '../graduation/graduation-access.js';
import { PERMISSIONS } from '../authz/permission-codes.js';
import { integrationAccess } from './integration-access.js';
import {
  generateIntegrationKey,
  hashIntegrationKey,
} from './integration-key.js';

const target = { id: 'student-1', userId: 'user-1' };
const other = { id: 'student-2', userId: 'user-2' };

describe('integration access (F-21 BE-04)', () => {
  const access = integrationAccess('client-1', target.id);

  it('reads exactly the one student a call names, for every read purpose', () => {
    for (const purpose of ['PROGRESS', 'ELIGIBILITY', 'GRADUATION'] as const) {
      expect(() =>
        assertStudentProgramRead(access, purpose, target, 'p'),
      ).not.toThrow();
      expect(() =>
        assertStudentProgramRead(access, purpose, other, 'p'),
      ).toThrow();
      expect(readsWithoutEnrollment(access, purpose, target)).toBe(true);
      expect(readsWithoutEnrollment(access, purpose, other)).toBe(false);
    }
    expect(studentReadWhere(access, 'PROGRESS', undefined)).toEqual({
      OR: [{ id: { in: [target.id] } }],
    });
  });

  it('may read a live graduation answer but never save one, and holds no staff permission', () => {
    expect(() =>
      assertGraduationRead(access, {
        programIds: ['p'],
        studentIds: [target.id],
      }),
    ).not.toThrow();
    expect(() =>
      assertGraduationRead(access, {
        programIds: ['p'],
        studentIds: [other.id],
      }),
    ).toThrow();
    expect(() =>
      assertGraduationWrite(access, {
        programIds: ['p'],
        studentIds: [target.id],
      }),
    ).toThrow();
    expect(access.has(PERMISSIONS.PROGRAM_VIEW)).toBe(false);
    expect(access.has(PERMISSIONS.GRADUATION_AUDIT)).toBe(false);
  });

  it('issues random prefixed keys and stores only their SHA-256', () => {
    const first = generateIntegrationKey();
    const second = generateIntegrationKey();
    expect(first.key).toMatch(/^ddut_/);
    expect(first.key).not.toBe(second.key);
    expect(first.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIntegrationKey(first.key)).toBe(first.keyHash);
  });
});
