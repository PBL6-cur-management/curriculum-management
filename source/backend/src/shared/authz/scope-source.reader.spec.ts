import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ProgramStatus,
  ScopeSource,
  SubjectGroupMemberRole,
  SubjectGroupStatus,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ScopeSourceReader } from './scope-source.reader.js';

const TODAY = new Date('2026-10-19T00:00:00.000Z');

describe('ScopeSourceReader', () => {
  let findMany: ReturnType<typeof vi.fn>;
  let reader: ScopeSourceReader;

  beforeEach(() => {
    findMany = vi
      .fn()
      .mockResolvedValue([
        { subjectGroupId: 'group-1' },
        { subjectGroupId: 'group-2' },
      ]);
    reader = new ScopeSourceReader({
      subjectGroupMember: { findMany },
    } as unknown as PrismaService);
  });

  it('limits coordinator scope to active coordinator rows in active groups', async () => {
    expect(
      await reader.activeTargets(
        ScopeSource.SUBJECT_GROUP_COORDINATOR,
        'lecturer',
        TODAY,
      ),
    ).toEqual({ subjectGroupIds: ['group-1', 'group-2'] });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        lecturerId: 'lecturer',
        memberRole: SubjectGroupMemberRole.COORDINATOR,
        revokedAt: null,
        validFrom: { lte: TODAY },
        OR: [{ validTo: null }, { validTo: { gte: TODAY } }],
        subjectGroup: { status: SubjectGroupStatus.ACTIVE },
      },
      select: { subjectGroupId: true },
      distinct: ['subjectGroupId'],
    });
  });

  it('counts either role for member scope', async () => {
    expect(
      await reader.activeTargets(
        ScopeSource.SUBJECT_GROUP_MEMBER,
        'lecturer',
        TODAY,
      ),
    ).toEqual({ subjectGroupIds: ['group-1', 'group-2'] });
    const where = findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('memberRole');
    expect(where).toMatchObject({
      lecturerId: 'lecturer',
      revokedAt: null,
      subjectGroup: { status: SubjectGroupStatus.ACTIVE },
    });
  });

  it('limits director scope to active, unrevoked rows in active programs', async () => {
    const directorFindMany = vi
      .fn()
      .mockResolvedValue([{ programId: 'p1' }, { programId: 'p2' }]);
    const directorReader = new ScopeSourceReader({
      programDirectorAssignment: { findMany: directorFindMany },
    } as unknown as PrismaService);
    expect(
      await directorReader.activeTargets(
        ScopeSource.PROGRAM_DIRECTOR,
        'director',
        TODAY,
      ),
    ).toEqual({ programIds: ['p1', 'p2'] });
    expect(directorFindMany).toHaveBeenCalledWith({
      where: {
        directorId: 'director',
        revokedAt: null,
        validFrom: { lte: TODAY },
        OR: [{ validTo: null }, { validTo: { gte: TODAY } }],
        program: { status: ProgramStatus.ACTIVE },
      },
      select: { programId: true },
      distinct: ['programId'],
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('derives OWN_ENROLLMENT as the linked student only, never their programs (F-20 BE-06)', async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: 'student-1' });
    const studentReader = new ScopeSourceReader({
      student: { findUnique },
    } as unknown as PrismaService);
    expect(
      await studentReader.activeTargets(
        ScopeSource.OWN_ENROLLMENT,
        'user-1',
        TODAY,
      ),
    ).toEqual({ studentIds: ['student-1'] });
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
  });

  it('derives nothing for an account that is not linked to a student', async () => {
    const studentReader = new ScopeSourceReader({
      student: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService);
    expect(
      await studentReader.activeTargets(
        ScopeSource.OWN_ENROLLMENT,
        'staff',
        TODAY,
      ),
    ).toEqual({});
  });
});
