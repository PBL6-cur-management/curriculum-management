import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import { applyEnrollmentCommand } from '../../shared/students/enrollment.writer.js';
import type { EnrollmentReconciler } from '../../shared/students/enrollment-reconciler.js';
import { StudentEnrollmentsService } from './student-enrollments.service.js';

vi.mock('../../shared/students/enrollment.writer.js', () => ({
  applyEnrollmentCommand: vi.fn(),
}));

const stamp = new Date('2026-01-02T03:04:05.678Z');
const semester = {
  id: 's1',
  semesterCode: '2025-1',
  academicYear: '2025-2026',
  termInYear: 1,
  startDate: new Date('2025-09-01T00:00:00.000Z'),
};

function officeAccess(): AccessContext {
  const grant = { mode: 'DIRECT', scope: 'ALL' };
  return {
    userId: 'office',
    has: (code: string) => code === PERMISSIONS.VERSION_ASSIGN_COHORT,
    assignments: [
      {
        roleCode: 'R1',
        permissions: new Map([[PERMISSIONS.VERSION_ASSIGN_COHORT, grant]]),
      },
    ],
  } as unknown as AccessContext;
}
function directorAccess(): AccessContext {
  return {
    userId: 'dir',
    has: () => true,
    assignments: [
      {
        roleCode: 'R3',
        permissions: new Map([
          [PERMISSIONS.VERSION_ASSIGN_COHORT, { mode: 'DIRECT', scope: 'ALL' }],
        ]),
      },
    ],
  } as unknown as AccessContext;
}

const command = {
  operation: 'ASSIGN_EXCEPTION',
  targetVersionId: 'v1',
  fromSemesterId: 's1',
  basisDecision: 'QĐ',
  expectedStudentUpdatedAt: stamp.toISOString(),
} as const;

describe('StudentEnrollmentsService', () => {
  let service: StudentEnrollmentsService;
  let reconcileStudent: ReturnType<typeof vi.fn>;
  let findUniqueOrThrow: ReturnType<typeof vi.fn>;
  let transaction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    reconcileStudent = vi
      .fn()
      .mockResolvedValue({ transitioned: 1, unchanged: 0, blocked: 0 });
    findUniqueOrThrow = vi.fn().mockResolvedValue({
      id: 'e1',
      studentId: 'st',
      program: { id: 'p1', programCode: 'KTPM' },
      cohort: { id: 'c1', cohortCode: 'K25', intakeYear: 2025 },
      appliedVersion: {
        id: 'v1',
        versionNumber: '1.0',
        status: 'ACTIVE',
        programName: 'KTPM',
      },
      admissionVersionId: 'v1',
      cohortAssignmentId: null,
      fromSemester: semester,
      untilSemester: null,
      previousEnrollmentId: null,
      enrollmentType: 'PRIMARY',
      isException: true,
      basisDecision: 'QĐ',
      status: 'ACTIVE',
      createdAt: stamp,
      updatedAt: stamp,
    });
    const tx = { programEnrollment: { findUniqueOrThrow } };
    transaction = vi.fn((run: (t: unknown) => unknown) => run(tx));
    vi.mocked(applyEnrollmentCommand).mockResolvedValue('e1');
    service = new StudentEnrollmentsService(
      { $transaction: transaction } as unknown as PrismaService,
      { reconcileStudent } as unknown as EnrollmentReconciler,
    );
  });

  it('applies the command with the caller as actor and returns only the new row', async () => {
    const dto = await service.create(officeAccess(), 'st', command);
    expect(applyEnrollmentCommand).toHaveBeenCalledWith(
      expect.anything(),
      'st',
      command,
      'office',
    );
    expect(dto).toMatchObject({ id: 'e1', isException: true });
    expect(dto).not.toHaveProperty('enrollments');
  });

  it('refuses a director before opening a transaction', async () => {
    await expect(
      service.create(directorAccess(), 'st', command),
    ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
    expect(transaction).not.toHaveBeenCalled();
    expect(applyEnrollmentCommand).not.toHaveBeenCalled();
  });

  it('lets a writer rejection reach the caller untouched', async () => {
    vi.mocked(applyEnrollmentCommand).mockRejectedValue(
      Object.assign(new Error('stale'), { code: 'ENROLLMENT_STATE_CHANGED' }),
    );
    await expect(
      service.create(officeAccess(), 'st', command),
    ).rejects.toMatchObject({ code: 'ENROLLMENT_STATE_CHANGED' });
    expect(findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('reconciles one student with the supplied revision token', async () => {
    const counts = await service.reconcile(officeAccess(), 'st', {
      expectedStudentUpdatedAt: stamp.toISOString(),
    });
    expect(counts).toEqual({ transitioned: 1, unchanged: 0, blocked: 0 });
    expect(reconcileStudent).toHaveBeenCalledWith('st', stamp.toISOString());
  });

  it('does not reconcile for a non-office caller', async () => {
    await expect(
      service.reconcile(directorAccess(), 'st', {
        expectedStudentUpdatedAt: stamp.toISOString(),
      }),
    ).rejects.toBeDefined();
    expect(reconcileStudent).not.toHaveBeenCalled();
  });
});
