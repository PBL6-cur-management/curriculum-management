import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import {
  AccessContext,
  type ActiveAssignment,
} from '../authz/access-context.js';
import { PERMISSIONS } from '../authz/permission-codes.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AcademicResultsReader } from './academic-results.reader.js';
import { STUDENT_ROLES } from './student.constants.js';

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const lookup = {
  studentId: 'student',
  programId: 'program',
  semesterId: 'requested',
};
const director: ActiveAssignment = {
  assignmentId: 'assignment',
  roleId: 'director-role',
  roleCode: STUDENT_ROLES.DIRECTOR,
  roleName: 'Director',
  scopeSource: 'NONE',
  scopeType: 'SYSTEM',
  scopeUnit: null,
  scope: {
    all: false,
    orgUnitIds: new Set(),
    subjectGroupIds: new Set(),
    programIds: new Set([lookup.programId]),
    studentIds: new Set(),
  },
  permissions: new Map([
    [
      PERMISSIONS.STUDENT_VIEW_REGISTRATION_ELIGIBILITY,
      { mode: 'DIRECT', scope: 'SCOPED' },
    ],
  ]),
};
const access = new AccessContext('director', [director]);

interface Enrollment {
  fromSemester: { startDate: Date | null };
  untilSemester: { startDate: Date | null } | null;
}

function build(enrollments: Enrollment[]) {
  const db = {
    semester: {
      findUnique: vi.fn().mockResolvedValue({
        id: lookup.semesterId,
        startDate: day('2026-09-01'),
      }),
    },
    student: {
      findUnique: vi.fn().mockResolvedValue({
        id: lookup.studentId,
        userId: 'student-user',
      }),
    },
    programEnrollment: { findMany: vi.fn().mockResolvedValue(enrollments) },
    academicResult: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const transaction = vi.fn(
    async (run: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      run(db as unknown as Prisma.TransactionClient),
  );
  const reader = new AcademicResultsReader({
    $transaction: transaction,
  } as unknown as PrismaService);
  const facade = reader.forAccess(access, 'ELIGIBILITY');
  return {
    db,
    transaction,
    read: () =>
      facade.forStudent(lookup, db as unknown as Prisma.TransactionClient),
    readWithoutTransaction: () => facade.forStudent(lookup),
  };
}

describe('AcademicResultsReader enrollment boundaries', () => {
  it('does not authorize a director through an unknown end start', async () => {
    const { read, db, transaction } = build([
      {
        fromSemester: { startDate: day('2025-09-01') },
        untilSemester: { startDate: null },
      },
    ]);
    await expect(read()).rejects.toMatchObject({ code: 'STUDENT_NOT_FOUND' });
    expect(db.academicResult.findMany).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('does not authorize a director through an unknown from start', async () => {
    const { read, db } = build([
      { fromSemester: { startDate: null }, untilSemester: null },
    ]);
    await expect(read()).rejects.toMatchObject({ code: 'STUDENT_NOT_FOUND' });
    expect(db.academicResult.findMany).not.toHaveBeenCalled();
  });

  it('keeps an absent end semester open and uses the supplied transaction only', async () => {
    const { read, db, transaction } = build([
      {
        fromSemester: { startDate: day('2025-09-01') },
        untilSemester: null,
      },
    ]);
    await expect(read()).resolves.toEqual([]);
    expect(db.academicResult.findMany).toHaveBeenCalledWith({
      where: { studentId: lookup.studentId },
      include: { semester: { select: { startDate: true } } },
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('excludes the semester that ends a stay', async () => {
    const { read, db } = build([
      {
        fromSemester: { startDate: day('2025-09-01') },
        untilSemester: { startDate: day('2026-09-01') },
      },
    ]);
    await expect(read()).rejects.toMatchObject({ code: 'STUDENT_NOT_FOUND' });
    expect(db.academicResult.findMany).not.toHaveBeenCalled();
  });

  it('uses a valid covering interval even if another interval has unknown boundaries', async () => {
    const { read } = build([
      {
        fromSemester: { startDate: day('2025-09-01') },
        untilSemester: { startDate: null },
      },
      {
        fromSemester: { startDate: day('2026-09-01') },
        untilSemester: { startDate: day('2027-02-01') },
      },
    ]);
    await expect(read()).resolves.toEqual([]);
  });

  it('uses RepeatableRead when no transaction is supplied', async () => {
    const { readWithoutTransaction, transaction } = build([
      {
        fromSemester: { startDate: day('2025-09-01') },
        untilSemester: null,
      },
    ]);
    await expect(readWithoutTransaction()).resolves.toEqual([]);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  });
});
