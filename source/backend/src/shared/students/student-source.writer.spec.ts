import type { Prisma } from '../../generated/prisma/client.js';
import {
  createAdmissionEnrollment,
  endStudentEnrollments,
} from './enrollment.writer.js';
import type {
  SourceWriteContext,
  StudentImportPlanRow,
} from './student-import.types.js';
import { writeStudentSource } from './student-source.writer.js';

vi.mock('./enrollment.writer.js', () => ({
  createAdmissionEnrollment: vi.fn().mockResolvedValue('enr'),
  endStudentEnrollments: vi.fn().mockResolvedValue(undefined),
}));

const EXCEL: SourceWriteContext = { source: 'EXCEL', actorId: 'u1' };
const REVISION = '2026-01-01T00:00:00.000Z';
const ASSIGNMENT = { id: 'ca' } as unknown as NonNullable<
  StudentImportPlanRow['admissionAssignment']
>;

const row = (
  over: Partial<StudentImportPlanRow> = {},
): StudentImportPlanRow => ({
  rowNumber: 2,
  action: 'CREATE',
  existingId: null,
  expectedUpdatedAt: null,
  programId: 'p1',
  admissionAssignment: ASSIGNMENT,
  profile: {
    studentCode: 'SV001',
    fullName: 'Nguyen Van A',
    cohortId: 'c1',
    major: '7480201',
    admissionSemesterId: 'sem1',
    statusSemesterId: 'sem1',
    status: 'STUDYING',
  },
  ...over,
});

const account = {
  studentCode: 'SV001',
  username: 'sv001',
  passwordHash: 'hash',
  temporaryPassword: 'tmp',
};

function client(
  current: Record<string, unknown> | null = null,
  enrollments = 0,
  clash: unknown = null,
) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    role: { findUnique: vi.fn().mockResolvedValue({ id: 'role-r6' }) },
    user: {
      findFirst: vi.fn().mockResolvedValue(clash),
      create: vi.fn().mockResolvedValue({ id: 'user-1' }),
    },
    student: {
      findUnique: vi.fn().mockResolvedValue(current),
      create: vi.fn().mockResolvedValue({ id: 'new-student' }),
      update: vi.fn().mockResolvedValue({}),
    },
    programEnrollment: { count: vi.fn().mockResolvedValue(enrollments) },
  };
}
const run = (
  db: ReturnType<typeof client>,
  rows: StudentImportPlanRow[],
  context = EXCEL,
  accounts = [account],
) =>
  writeStudentSource(
    db as unknown as Prisma.TransactionClient,
    { rows },
    context,
    accounts,
  );

const existing = (over: Record<string, unknown> = {}) => ({
  id: 'st1',
  dataSource: 'EXCEL',
  updatedAt: new Date(REVISION),
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('writeStudentSource', () => {
  it('creates the student, its account with the student role, and the admission enrollment', async () => {
    const db = client();
    const result = await run(db, [row()]);
    expect(result).toEqual({
      studentIds: ['new-student'],
      createdAccountCodes: ['SV001'],
    });
    expect(db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userCode: 'SV001',
          mustChangePassword: true,
          roleAssignments: {
            create: expect.objectContaining({
              roleId: 'role-r6',
              scopeType: 'SYSTEM',
            }),
          },
        }),
      }),
    );
    expect(db.student.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ dataSource: 'EXCEL', userId: 'user-1' }),
      select: { id: true },
    });
    expect(createAdmissionEnrollment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        studentId: 'new-student',
        source: 'EXCEL',
        actorId: 'u1',
      }),
    );
  });

  it('creates no account and no credentials for a synchronized profile', async () => {
    const db = client();
    const result = await run(
      db,
      [row()],
      { source: 'SCHOOL_DB', actorId: null },
      [],
    );
    expect(result.createdAccountCodes).toEqual([]);
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.student.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ dataSource: 'SCHOOL_DB', userId: null }),
      select: { id: true },
    });
  });

  it('skips the whole row when the stored profile is official, even if the plan said update', async () => {
    const db = client(existing({ dataSource: 'SCHOOL_DB' }));
    const result = await run(db, [
      row({ action: 'UPDATE', existingId: 'st1', expectedUpdatedAt: REVISION }),
    ]);
    expect(result.studentIds).toEqual([]);
    expect(db.student.update).not.toHaveBeenCalled();
    expect(createAdmissionEnrollment).not.toHaveBeenCalled();
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it('skips a planned preserve without reading anything', async () => {
    const db = client();
    await run(db, [row({ action: 'PRESERVE_SOURCE', existingId: 'st1' })]);
    expect(db.student.findUnique).not.toHaveBeenCalled();
  });

  it('updates in place, never re-pins an enrolled student and creates no second account', async () => {
    const db = client(existing(), 1);
    await run(db, [
      row({
        action: 'UPDATE',
        existingId: 'st1',
        expectedUpdatedAt: REVISION,
        admissionAssignment: null,
      }),
    ]);
    expect(db.student.update).toHaveBeenCalledTimes(1);
    expect(db.user.create).not.toHaveBeenCalled();
    expect(createAdmissionEnrollment).not.toHaveBeenCalled();
  });

  it('admits an existing student with no enrollment history once', async () => {
    const db = client(existing(), 0);
    await run(db, [
      row({
        action: 'UNCHANGED',
        existingId: 'st1',
        expectedUpdatedAt: REVISION,
      }),
    ]);
    expect(db.student.update).not.toHaveBeenCalled();
    expect(createAdmissionEnrollment).toHaveBeenCalledTimes(1);
  });

  it('closes open enrollments at the status semester for a terminal status', async () => {
    const db = client(existing(), 1);
    const profile = {
      ...row().profile,
      status: 'WITHDRAWN' as const,
      statusSemesterId: 'sem2',
    };
    await run(db, [
      row({
        action: 'UPDATE',
        existingId: 'st1',
        expectedUpdatedAt: REVISION,
        admissionAssignment: null,
        profile,
      }),
    ]);
    expect(endStudentEnrollments).toHaveBeenCalledWith(
      expect.anything(),
      'st1',
      'sem2',
    );
  });

  it('throws on a stale revision, a code that appeared, or an account owned by someone else', async () => {
    await expect(
      run(client(existing({ updatedAt: new Date('2026-02-02') })), [
        row({
          action: 'UPDATE',
          existingId: 'st1',
          expectedUpdatedAt: REVISION,
        }),
      ]),
    ).rejects.toMatchObject({ code: 'ENROLLMENT_STATE_CHANGED' });
    await expect(run(client(existing()), [row()])).rejects.toMatchObject({
      code: 'ENROLLMENT_STATE_CHANGED',
    });
    await expect(
      run(client(null, 0, { id: 'other' }), [row()]),
    ).rejects.toMatchObject({ code: 'ACCOUNT_IDENTITY_CONFLICT' });
  });

  it('requires the performing actor for Excel', async () => {
    await expect(
      run(client(), [row()], { source: 'EXCEL', actorId: null }),
    ).rejects.toThrow();
  });
});
