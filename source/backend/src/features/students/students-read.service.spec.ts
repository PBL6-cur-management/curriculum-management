import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AccessContext,
  type ActiveAssignment,
} from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import type { PrismaService } from '../../shared/prisma/prisma.service.js';
import type { AcademicResultsReader } from '../../shared/students/academic-results.reader.js';
import type { StudentAppliedVersionReader } from '../../shared/students/student-applied-version.reader.js';
import { STUDENT_ERRORS } from '../../shared/students/student.errors.js';
import { StudentsReadService } from './students-read.service.js';

function assignment(
  roleCode: string,
  codes: string[],
  programIds: string[] = [],
  all = false,
): ActiveAssignment {
  return {
    roleCode,
    scope: all
      ? { all: true }
      : {
          all: false,
          programIds: new Set(programIds),
          studentIds: new Set(),
          orgUnitIds: new Set(),
          subjectGroupIds: new Set(),
        },
    permissions: new Map(
      codes.map((code) => [code, { mode: 'DIRECT', scope: 'ALL' }]),
    ),
  } as unknown as ActiveAssignment;
}

const office = new AccessContext('office', [
  assignment(
    'R1',
    [PERMISSIONS.STUDENT_VIEW_PROGRESS, PERMISSIONS.VERSION_ASSIGN_COHORT],
    [],
    true,
  ),
]);
const director = new AccessContext('dir', [
  assignment('R3', [PERMISSIONS.STUDENT_VIEW_PROGRESS], ['p1']),
]);
const studentOnly = new AccessContext('acct', [
  assignment('R6', [PERMISSIONS.STUDENT_VIEW_PROGRESS]),
]);

const semester = { id: 'sem', startDate: new Date('2025-09-01T00:00:00.000Z') };
const page = { page: 1, pageSize: 20 };

describe('StudentsReadService', () => {
  let service: StudentsReadService;
  let studentFindMany: ReturnType<typeof vi.fn>;
  let studentCount: ReturnType<typeof vi.fn>;
  let studentFindFirst: ReturnType<typeof vi.fn>;
  let programFindMany: ReturnType<typeof vi.fn>;
  let transaction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    studentFindMany = vi.fn().mockResolvedValue([]);
    studentCount = vi.fn().mockResolvedValue(0);
    studentFindFirst = vi.fn().mockResolvedValue(null);
    programFindMany = vi.fn().mockResolvedValue([]);
    const tx = {
      semester: { findUnique: vi.fn().mockResolvedValue(semester) },
      student: {
        findMany: studentFindMany,
        count: studentCount,
        findFirst: studentFindFirst,
        findUnique: vi.fn().mockResolvedValue({ id: 'st' }),
      },
      program: { findMany: programFindMany },
      programEnrollment: { findMany: vi.fn().mockResolvedValue([]) },
      programVersion: { findMany: vi.fn().mockResolvedValue([]) },
    };
    transaction = vi.fn((run: (t: unknown) => unknown) => run(tx));
    service = new StudentsReadService(
      { $transaction: transaction } as unknown as PrismaService,
      {} as StudentAppliedVersionReader,
      {} as AcademicResultsReader,
    );
  });

  describe('list', () => {
    it('refuses a student-only caller before opening a transaction', async () => {
      await expect(
        service.list(studentOnly, { semesterId: 'sem', ...page }),
      ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
      expect(transaction).not.toHaveBeenCalled();
    });

    it('counts and lists with the same predicate', async () => {
      await service.list(director, { semesterId: 'sem', ...page });
      const listWhere = studentFindMany.mock.calls[0]![0].where;
      expect(studentCount).toHaveBeenCalledWith({ where: listWhere });
      expect(JSON.stringify(listWhere)).toContain('"in":["p1"]');
    });

    it('does not widen a director beyond directed programs when another program is named', async () => {
      await service.list(director, {
        semesterId: 'sem',
        programId: 'other',
        ...page,
      });
      const where = studentFindMany.mock.calls[0]![0].where;
      expect(where.id).toEqual({ in: [] });
    });

    it('leaves the office unrestricted without a program, and orders by name then id', async () => {
      await service.list(office, { semesterId: 'sem', ...page });
      const args = studentFindMany.mock.calls[0]![0];
      expect(args.where).toEqual({});
      expect(args.orderBy).toEqual([{ fullName: 'asc' }, { id: 'asc' }]);
    });

    it('applies the search text to code and name', async () => {
      await service.list(office, { semesterId: 'sem', q: 'an', ...page });
      const where = studentFindMany.mock.calls[0]![0].where;
      expect(where.OR).toHaveLength(2);
    });

    it('searches without a semester: no term check, a director still limited to directed programs', async () => {
      await service.list(director, { q: '102230239', ...page });
      const where = studentFindMany.mock.calls[0]![0].where;
      expect(JSON.stringify(where)).toContain('"in":["p1"]');
      expect(JSON.stringify(where)).not.toContain('fromSemester');
      expect(where.OR).toHaveLength(2);
    });
  });

  describe('detail', () => {
    it('requires a program for a director', async () => {
      await expect(
        service.detail(director, 'st', { semesterId: 'sem' }),
      ).rejects.toMatchObject({
        code: STUDENT_ERRORS.PROGRAM_CONTEXT_REQUIRED.code,
      });
      expect(transaction).not.toHaveBeenCalled();
    });

    it('reports a student outside the scope as not found', async () => {
      await expect(
        service.detail(director, 'st', { semesterId: 'sem', programId: 'p1' }),
      ).rejects.toMatchObject({
        code: STUDENT_ERRORS.STUDENT_NOT_FOUND.code,
      });
    });
  });

  describe('programOptions', () => {
    it('limits a director to directed programs', async () => {
      await service.programOptions(director, { semesterId: 'sem' });
      expect(programFindMany.mock.calls[0]![0].where).toEqual({
        id: { in: ['p1'] },
      });
    });

    it('lists all programs for the office including those without enrollments', async () => {
      programFindMany.mockResolvedValue([
        {
          id: 'new-program',
          programCode: 'NEW',
          versions: [{ programName: 'Chương trình mới' }],
        },
      ]);
      await expect(
        service.programOptions(office, { semesterId: 'sem' }),
      ).resolves.toEqual([
        {
          id: 'new-program',
          programCode: 'NEW',
          programName: 'Chương trình mới',
        },
      ]);
      expect(programFindMany.mock.calls[0]![0].where).toEqual({});
    });

    it('returns no options when the staff scope has no programs', async () => {
      await expect(
        service.programOptions(director, { semesterId: 'sem' }),
      ).resolves.toEqual([]);
    });
  });

  describe('enrollmentTargets', () => {
    it('is closed to a director', async () => {
      await expect(
        service.enrollmentTargets(director, 'st', {
          semesterId: 'sem',
          programId: 'p1',
        }),
      ).rejects.toBeDefined();
      expect(transaction).not.toHaveBeenCalled();
    });

    it('returns an empty list when the program has no issued version', async () => {
      await expect(
        service.enrollmentTargets(office, 'st', {
          semesterId: 'sem',
          programId: 'p1',
        }),
      ).resolves.toEqual([]);
    });
  });
});
