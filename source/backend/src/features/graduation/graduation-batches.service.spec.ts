import { describe, expect, it, vi } from 'vitest';
import {
  AccessContext,
  type ActiveAssignment,
} from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { GRADUATION_ERRORS } from '../../shared/graduation/graduation.errors.js';
import { GraduationBatchesService } from './graduation-batches.service.js';
import { GraduationRosterReader } from './graduation-roster.reader.js';

const access = new AccessContext('reviewer', [
  {
    assignmentId: null,
    roleId: 'office',
    roleName: 'Office',
    scopeSource: 'NONE',
    scopeType: 'SYSTEM',
    scopeUnit: null,
    roleCode: 'R1',
    scope: { all: true },
    permissions: new Map([
      [PERMISSIONS.GRADUATION_AUDIT, { mode: 'DIRECT', scope: 'ALL' }],
    ]),
  } as ActiveAssignment,
]);
const filters = { semesterId: 'semester', programId: 'program' };
const preview = {
  filters: { ...filters, cohortId: null },
  studentCount: 1,
  enrollmentCount: 1,
  previewRevision: 'a'.repeat(64),
  items: [
    {
      studentId: 'student',
      programId: 'program',
      semesterId: 'semester',
      rosterEnrollmentId: 'enrollment',
      rosterIdentity: { studentCode: 'SYN001' },
    },
  ],
};
function build() {
  const tx = {
    graduationBatch: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'batch' }),
      findFirst: vi.fn().mockResolvedValue({
        id: 'batch',
        requestedById: 'reviewer',
        filters: preview.filters,
        studentCount: 1,
        enrollmentCount: 1,
        previewRevision: preview.previewRevision,
        status: 'QUEUED',
        failureCode: null,
        createdAt: new Date('2026-10-30'),
        startedAt: null,
        finishedAt: null,
      }),
    },
    graduationBatchItem: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ studentId: 'student', programId: 'program' }]),
      count: vi.fn().mockResolvedValue(0),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (work: (db: unknown) => unknown) => work(tx)),
  };
  const roster = { read: vi.fn().mockResolvedValue(preview) };
  const scheduler = { enqueueBatch: vi.fn().mockResolvedValue(undefined) };
  return {
    tx,
    prisma,
    roster,
    scheduler,
    service: new GraduationBatchesService(
      prisma as never,
      roster as never,
      scheduler as never,
    ),
  };
}

describe('graduation batches', () => {
  it('previews counts without persisting roster or scheduling', async () => {
    const fixture = build();
    expect(await fixture.service.preview(access, filters)).toEqual({
      filters: preview.filters,
      studentCount: 1,
      enrollmentCount: 1,
      previewRevision: preview.previewRevision,
    });
    expect(fixture.tx.graduationBatch.create).not.toHaveBeenCalled();
    expect(fixture.scheduler.enqueueBatch).not.toHaveBeenCalled();
  });
  it('rejects changed preview before batch creation', async () => {
    const fixture = build();
    await expect(
      fixture.service.create(access, {
        ...filters,
        previewRevision: 'b'.repeat(64),
        requestKey: 'click',
      }),
    ).rejects.toMatchObject({ code: GRADUATION_ERRORS.STATE_CHANGED.code });
    expect(fixture.tx.graduationBatch.create).not.toHaveBeenCalled();
    expect(fixture.scheduler.enqueueBatch).not.toHaveBeenCalled();
  });
  it('rejects an empty roster rather than creating an invalid count', async () => {
    const fixture = build();
    fixture.roster.read.mockResolvedValue({
      ...preview,
      items: [],
      studentCount: 0,
      enrollmentCount: 0,
    });
    await expect(
      fixture.service.create(access, {
        ...filters,
        previewRevision: preview.previewRevision,
        requestKey: 'click',
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(fixture.tx.graduationBatch.create).not.toHaveBeenCalled();
  });
  it('persists before enqueue and survives queue outage as QUEUED', async () => {
    const fixture = build();
    fixture.scheduler.enqueueBatch.mockRejectedValue(new Error('offline'));
    expect(
      await fixture.service.create(access, {
        ...filters,
        previewRevision: preview.previewRevision,
        requestKey: 'click',
      }),
    ).toMatchObject({ id: 'batch', status: 'QUEUED', processedCount: 0 });
    expect(
      fixture.tx.graduationBatch.create.mock.invocationCallOrder[0],
    ).toBeLessThan(fixture.scheduler.enqueueBatch.mock.invocationCallOrder[0]!);
  });
  it('does not reveal a foreign creator batch', async () => {
    const fixture = build();
    fixture.tx.graduationBatch.findFirst.mockResolvedValue(null);
    await expect(
      fixture.service.detail(access, 'foreign'),
    ).rejects.toMatchObject({ code: GRADUATION_ERRORS.ACCESS_REVOKED.code });
  });
  it('rejects incompatible academic and operational item filters', async () => {
    const fixture = build();
    await expect(
      fixture.service.items(access, 'batch', {
        page: 1,
        pageSize: 20,
        conclusion: 'ELIGIBLE',
        outcome: 'ERROR',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('rejects same requester/key with different filters', async () => {
    const fixture = build();
    fixture.tx.graduationBatch.findUnique.mockResolvedValue({
      id: 'batch',
      filters: preview.filters,
      previewRevision: preview.previewRevision,
    });
    await expect(
      fixture.service.create(access, {
        ...filters,
        programId: 'other',
        previewRevision: preview.previewRevision,
        requestKey: 'click',
      }),
    ).rejects.toMatchObject({ code: GRADUATION_ERRORS.STATE_CHANGED.code });
    expect(fixture.roster.read).not.toHaveBeenCalled();
  });
});

describe('graduation roster', () => {
  const semester = {
    id: 'semester',
    semesterCode: 'SYN-SEM',
    startDate: new Date('2026-09-01'),
  };
  const enrollment = (id: string, programId: string) => ({
    id,
    studentId: 'student',
    programId,
    cohortId: 'cohort',
    student: { studentCode: 'SYN001', fullName: 'Sinh viên tổng hợp' },
    program: { programCode: programId },
    cohort: { cohortCode: 'SYN-C' },
    fromSemester: semester,
    untilSemester: null,
    fromSemesterId: semester.id,
    untilSemesterId: null,
    updatedAt: semester.startDate,
    appliedVersionId: 'version',
    admissionVersionId: 'version',
    appliedVersion: { programName: 'Chương trình tổng hợp' },
    isException: false,
    basisDecision: null,
  });
  it('keeps historical dual-major contexts but counts distinct students', async () => {
    const tx = {
      semester: { findUnique: vi.fn().mockResolvedValue(semester) },
      programEnrollment: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            enrollment('enrollment-a', 'program-a'),
            enrollment('enrollment-b', 'program-b'),
          ]),
      },
      programVersion: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 'version', programName: 'Tổng hợp' }]),
      },
    };
    const versions = {
      resolveManyForAccess: vi.fn(
        async (
          _access: unknown,
          _purpose: unknown,
          inputs: Array<{
            studentId: string;
            programId: string;
            semesterId: string;
          }>,
        ) =>
          inputs.map((input) => ({
            ...input,
            programVersionId: 'version',
            cohortAssignmentId: 'assignment',
          })),
      ),
    };
    const roster = await new GraduationRosterReader(versions as never).read(
      access,
      { semesterId: 'semester', cohortId: 'cohort' },
      tx as never,
    );
    expect(roster).toMatchObject({ studentCount: 1, enrollmentCount: 2 });
    expect(roster.items.map((item) => item.programId)).toEqual([
      'program-a',
      'program-b',
    ]);
    expect(tx.programEnrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ status: expect.anything() }),
      }),
    );
  });
  it('retains overlapping intervals as a single diagnostic context', async () => {
    const tx = {
      semester: { findUnique: vi.fn().mockResolvedValue(semester) },
      programEnrollment: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            enrollment('enrollment-a', 'program'),
            enrollment('enrollment-b', 'program'),
          ]),
      },
      programVersion: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const roster = await new GraduationRosterReader({} as never).read(
      access,
      filters,
      tx as never,
    );
    expect(roster.enrollmentCount).toBe(1);
    expect(roster.items[0]).toMatchObject({
      rosterEnrollmentId: null,
      rosterIdentity: { rosterDiagnostic: { code: 'ENROLLMENT_AMBIGUOUS' } },
    });
  });
});
