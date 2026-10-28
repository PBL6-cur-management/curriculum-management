import { describe, expect, it, vi } from 'vitest';
import {
  AccessContext,
  type ActiveAssignment,
} from '../authz/access-context.js';
import { PERMISSIONS } from '../authz/permission-codes.js';
import { StudentAppliedVersionReader } from './student-applied-version.reader.js';

const office = {
  assignmentId: null,
  roleId: 'R1',
  roleCode: 'R1',
  roleName: 'R1',
  scopeSource: 'NONE',
  scopeType: 'SYSTEM',
  scopeUnit: null,
  scope: { all: true },
  permissions: new Map([
    [PERMISSIONS.STUDENT_VIEW_PROGRESS, { mode: 'DIRECT', scope: 'ALL' }],
  ]),
} as unknown as ActiveAssignment;
const access = new AccessContext('u', [office]);

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const semester = (id: string, start: string) => ({ id, startDate: day(start) });

function enrollment(over: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    studentId: 's1',
    programId: 'p1',
    cohortId: 'c1',
    isException: false,
    fromSemester: semester('sem1', '2025-09-01'),
    untilSemester: null,
    appliedVersion: null,
    ...over,
  };
}

function build(
  rows: unknown[],
  assignment: unknown = { id: 'a1', version: { id: 'v1' } },
) {
  const db = {
    semester: {
      findUnique: vi.fn().mockResolvedValue(semester('semQ', '2026-02-01')),
    },
    student: {
      findMany: vi.fn().mockResolvedValue([{ id: 's1', userId: null }]),
    },
    programEnrollment: { findMany: vi.fn().mockResolvedValue(rows) },
  };
  const cohortVersions = {
    forCohorts: vi
      .fn()
      .mockResolvedValue([{ cohort: { id: 'c1' }, assignment }]),
  };
  const reader = new StudentAppliedVersionReader(
    {} as never,
    cohortVersions as never,
  );
  const run = () =>
    reader
      .forAccess(access, 'PROGRESS')
      .resolveForStudent(
        { studentId: 's1', programId: 'p1', semesterId: 'semQ' },
        db as never,
      );
  return { run, cohortVersions };
}

describe('StudentAppliedVersionReader', () => {
  it('resolves a normal enrollment through the cohort assignment', async () => {
    const { run } = build([enrollment()]);
    await expect(run()).resolves.toMatchObject({
      source: 'COHORT',
      programVersionId: 'v1',
      cohortAssignmentId: 'a1',
      enrollmentId: 'e1',
    });
  });

  it('reports a missing cohort assignment as unresolved', async () => {
    const { run } = build([enrollment()], null);
    await expect(run()).rejects.toMatchObject({
      code: 'APPLIED_VERSION_UNRESOLVED',
    });
  });

  it('rejects when no enrollment covers the semester', async () => {
    const { run } = build([
      enrollment({ untilSemester: semester('semX', '2026-02-01') }),
    ]);
    await expect(run()).rejects.toMatchObject({ code: 'ENROLLMENT_NOT_FOUND' });
  });

  it('rejects overlapping enrollments instead of choosing one', async () => {
    const { run } = build([enrollment(), enrollment({ id: 'e2' })]);
    await expect(run()).rejects.toMatchObject({ code: 'ENROLLMENT_AMBIGUOUS' });
  });
});
