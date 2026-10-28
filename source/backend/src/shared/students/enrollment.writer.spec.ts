import type { Prisma } from '../../generated/prisma/client.js';
import { fromIsoDay } from '../time/today.js';
import {
  applyEnrollmentCommand,
  createAdmissionEnrollment,
  endStudentEnrollments,
  type StudentEnrollmentCommand,
} from './enrollment.writer.js';

const STUDENT_REVISION = '2026-01-01T00:00:00.000Z';
const ENROLLMENT_REVISION = '2026-01-02T00:00:00.000Z';

function semester(id: string, day: string) {
  return { id, startDate: fromIsoDay(day) };
}
function version(id = 'v2', programId = 'p2') {
  return {
    id,
    programId,
    status: 'ACTIVE',
    sourceRequestId: null,
    versionNumber: '1.0',
    decisionNumber: 'QD-1',
    publishedAt: new Date('2025-01-01'),
    effectiveSemester: semester('s-eff', '2025-09-01'),
  };
}

function client() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    programVersion: { findUnique: vi.fn().mockResolvedValue(version()) },
    semester: {
      findUnique: vi.fn().mockResolvedValue(semester('s-from', '2026-02-01')),
    },
    student: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'st',
        cohortId: 'c1',
        status: 'STUDYING',
        updatedAt: new Date(STUDENT_REVISION),
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    programEnrollment: {
      findUnique: vi.fn().mockResolvedValue({ programId: 'p1' }),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'new' }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}
const asTx = (db: ReturnType<typeof client>) =>
  db as unknown as Prisma.TransactionClient;

const primary = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  programId: 'p1',
  enrollmentType: 'PRIMARY',
  status: 'ACTIVE',
  updatedAt: new Date(ENROLLMENT_REVISION),
  fromSemester: semester('s-old', '2025-09-01'),
  ...over,
});

const command = (
  over: Partial<StudentEnrollmentCommand> = {},
): StudentEnrollmentCommand => ({
  operation: 'ASSIGN_EXCEPTION',
  targetVersionId: 'v2',
  fromSemesterId: 's-from',
  basisDecision: 'Quyết định 12',
  expectedStudentUpdatedAt: STUDENT_REVISION,
  ...over,
});

describe('createAdmissionEnrollment', () => {
  const assignment = {
    id: 'a1',
    cohort: { id: 'c1', cohortCode: 'K1', intakeYear: 2025 },
    version: {
      ...version('v1', 'p1'),
      effectiveSemester: semester('s', '2025-09-01'),
    },
    fromSemester: semester('s', '2025-09-01'),
    createdAt: new Date(),
  };
  const input = {
    studentId: 'st',
    programId: 'p1',
    cohortId: 'c1',
    admissionSemesterId: 's-from',
    assignment: assignment as never,
    actorId: null,
    source: 'SCHOOL_DB' as const,
  };

  it('pins the assignment version and records the nullable actor and source', async () => {
    const db = client();
    const id = await createAdmissionEnrollment(asTx(db), input);
    expect(id).toBe('new');
    expect(db.programEnrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          enrollmentType: 'PRIMARY',
          isException: false,
          appliedVersionId: 'v1',
          admissionVersionId: 'v1',
          cohortAssignmentId: 'a1',
          createdById: null,
        }),
      }),
    );
    expect(db.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dataSource: 'SCHOOL_DB' }),
      }),
    );
  });

  it('refuses a second primary chain and a mismatched assignment', async () => {
    const db = client();
    db.programEnrollment.findFirst.mockResolvedValue({ id: 'old' });
    await expect(
      createAdmissionEnrollment(asTx(db), input),
    ).rejects.toMatchObject({
      code: 'INVALID_ENROLLMENT_INTERVAL',
    });
    await expect(
      createAdmissionEnrollment(asTx(client()), {
        ...input,
        programId: 'other',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ENROLLMENT_INTERVAL' });
  });
});

describe('applyEnrollmentCommand', () => {
  it('creates a primary exception for a student with no primary enrollment', async () => {
    const db = client();
    const id = await applyEnrollmentCommand(asTx(db), 'st', command(), 'actor');
    expect(id).toBe('new');
    expect(db.programEnrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          enrollmentType: 'PRIMARY',
          isException: true,
          programId: 'p2',
          createdById: 'actor',
          previousEnrollmentId: null,
        }),
      }),
    );
    expect(db.student.update).toHaveBeenCalled();
  });

  it('rejects missing or extra fields for the chosen operation', async () => {
    const shapes = [
      command({ basisDecision: '   ' }),
      command({ sourceEnrollmentId: 'e1' }),
      command({ operation: 'TRANSFER' }),
    ];
    for (const shape of shapes) {
      await expect(
        applyEnrollmentCommand(asTx(client()), 'st', shape, 'actor'),
      ).rejects.toMatchObject({ code: 'ENROLLMENT_COMMAND_INVALID' });
    }
  });

  it('returns a conflict when the student revision moved', async () => {
    await expect(
      applyEnrollmentCommand(
        asTx(client()),
        'st',
        command({ expectedStudentUpdatedAt: '2026-01-05T00:00:00.000Z' }),
        'actor',
      ),
    ).rejects.toMatchObject({ code: 'ENROLLMENT_STATE_CHANGED' });
  });

  it('refuses a terminal student, a future start and a target effective after the start', async () => {
    const terminal = client();
    terminal.student.findUnique.mockResolvedValue({
      id: 'st',
      cohortId: 'c1',
      status: 'GRADUATED',
      updatedAt: new Date(STUDENT_REVISION),
    });
    await expect(
      applyEnrollmentCommand(asTx(terminal), 'st', command(), 'actor'),
    ).rejects.toMatchObject({ code: 'INVALID_ENROLLMENT_INTERVAL' });

    const future = client();
    future.semester.findUnique.mockResolvedValue(
      semester('s-from', '2999-01-01'),
    );
    await expect(
      applyEnrollmentCommand(asTx(future), 'st', command(), 'actor'),
    ).rejects.toMatchObject({ code: 'INVALID_ENROLLMENT_INTERVAL' });

    const early = client();
    early.semester.findUnique.mockResolvedValue(
      semester('s-from', '2025-01-01'),
    );
    await expect(
      applyEnrollmentCommand(asTx(early), 'st', command(), 'actor'),
    ).rejects.toMatchObject({ code: 'INVALID_ENROLLMENT_INTERVAL' });
  });

  it('adds a second major beside the primary and leaves the primary open', async () => {
    const db = client();
    db.programEnrollment.findMany.mockResolvedValue([primary()]);
    await applyEnrollmentCommand(
      asTx(db),
      'st',
      command({ operation: 'ADD_SECOND_MAJOR' }),
      'actor',
    );
    expect(db.programEnrollment.update).not.toHaveBeenCalled();
    expect(db.programEnrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ enrollmentType: 'SECOND_MAJOR' }),
      }),
    );
  });

  it('refuses a second major without a primary or into a program already studied', async () => {
    const none = client();
    await expect(
      applyEnrollmentCommand(
        asTx(none),
        'st',
        command({ operation: 'ADD_SECOND_MAJOR' }),
        'actor',
      ),
    ).rejects.toMatchObject({ code: 'INVALID_ENROLLMENT_INTERVAL' });
    const busy = client();
    busy.programEnrollment.findMany.mockResolvedValue([
      primary(),
      primary({ id: 'e2', programId: 'p2', enrollmentType: 'SECOND_MAJOR' }),
    ]);
    await expect(
      applyEnrollmentCommand(
        asTx(busy),
        'st',
        command({ operation: 'ADD_SECOND_MAJOR' }),
        'actor',
      ),
    ).rejects.toMatchObject({ code: 'INVALID_ENROLLMENT_INTERVAL' });
  });

  const transfer = () =>
    command({
      operation: 'TRANSFER',
      sourceEnrollmentId: 'e1',
      expectedEnrollmentUpdatedAt: ENROLLMENT_REVISION,
    });

  it('closes the source as transferred and links the successor', async () => {
    const db = client();
    db.programEnrollment.findMany.mockResolvedValue([primary()]);
    await applyEnrollmentCommand(asTx(db), 'st', transfer(), 'actor');
    expect(db.programEnrollment.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { status: 'TRANSFERRED', untilSemesterId: 's-from' },
    });
    expect(db.programEnrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          previousEnrollmentId: 'e1',
          enrollmentType: 'PRIMARY',
          isException: true,
        }),
      }),
    );
  });

  it('refuses a stale source revision and a source that already closed', async () => {
    const stale = client();
    stale.programEnrollment.findMany.mockResolvedValue([
      primary({ updatedAt: new Date('2026-01-09T00:00:00.000Z') }),
    ]);
    await expect(
      applyEnrollmentCommand(asTx(stale), 'st', transfer(), 'actor'),
    ).rejects.toMatchObject({ code: 'ENROLLMENT_STATE_CHANGED' });
    const closed = client();
    closed.programEnrollment.findMany.mockResolvedValue([
      primary({ status: 'TRANSFERRED' }),
    ]);
    await expect(
      applyEnrollmentCommand(asTx(closed), 'st', transfer(), 'actor'),
    ).rejects.toMatchObject({ code: 'INVALID_ENROLLMENT_INTERVAL' });
  });
});

describe('endStudentEnrollments', () => {
  it('ends every open enrollment at the status semester and touches the student', async () => {
    const db = client();
    db.programEnrollment.findMany.mockResolvedValue([primary()]);
    await endStudentEnrollments(asTx(db), 'st', 's-from');
    expect(db.programEnrollment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['e1'] }, status: 'ACTIVE' },
      data: { status: 'ENDED', untilSemesterId: 's-from' },
    });
    expect(db.student.update).toHaveBeenCalled();
  });

  it('does nothing without open enrollments and refuses to end before a start', async () => {
    const db = client();
    await endStudentEnrollments(asTx(db), 'st', 's-from');
    expect(db.programEnrollment.updateMany).not.toHaveBeenCalled();
    const early = client();
    early.programEnrollment.findMany.mockResolvedValue([
      primary({ fromSemester: semester('s-late', '2026-09-01') }),
    ]);
    await expect(
      endStudentEnrollments(asTx(early), 'st', 's-from'),
    ).rejects.toMatchObject({ code: 'INVALID_ENROLLMENT_INTERVAL' });
  });
});
